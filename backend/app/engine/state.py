"""In-memory ring buffers, single-source 00:00 UTC Session CVD, and live telemetry state."""

from collections import deque
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime

from app.engine.liquidations import (
    compute_predictive_liquidation_bands,
    filter_unmitigated_bands,
)
from app.schemas import (
    CandleBar,
    ExpirySummary,
    HeaderTelemetry,
    LiquidationBand,
    OptionsSurfaceSummary,
    RealizedLiquidation,
    TimeframeLiteral,
    TradeSideLiteral,
    VenueLiteral,
    WhalePrint,
)

TIMEFRAMES: tuple[TimeframeLiteral, ...] = ("1m", "5m", "15m", "1h", "4h", "1d")


class MarketState:
    """Thread/task-safe single-process state for candles, telemetry, CVD, and options."""

    def __init__(self, initial_utc_date: date | None = None) -> None:
        self.candles: dict[TimeframeLiteral, deque[CandleBar]] = {
            tf: deque(maxlen=1500) for tf in TIMEFRAMES
        }
        self.predicted_liq_bands: dict[TimeframeLiteral, list[LiquidationBand]] = {
            tf: [] for tf in TIMEFRAMES
        }

        self.binance_available: bool = True
        self.binance_ws_connected: bool = False
        self.bybit_ws_connected: bool = False
        self.deribit_last_sync_ms: int | None = None

        self.mark_price: float = 0.0
        self.index_price: float = 0.0
        self.change_24h_pct: float = 0.0
        self.funding_rate: float = 0.0
        self.next_funding_ms: int = 0
        self.binance_oi_usd: float = 0.0
        self.bybit_oi_usd: float = 0.0
        self.oi_change_24h_pct: float = 0.0
        self.session_cvd_usd: float = 0.0
        self._cvd_utc_date: date = initial_utc_date or datetime.now(UTC).date()

        self.available_expiries: list[ExpirySummary] = []
        self.surfaces_by_expiry: dict[str, OptionsSurfaceSummary] = {}

        # Optional async broadcast hooks wired by FastAPI lifespan / Deribit poller.
        self.on_kline: Callable[[TimeframeLiteral, CandleBar], Awaitable[None]] | None = None
        self.on_whale: Callable[[WhalePrint], Awaitable[None]] | None = None
        self.on_liquidation: Callable[[RealizedLiquidation], Awaitable[None]] | None = None
        self.on_liq_bands: (
            Callable[[TimeframeLiteral, list[LiquidationBand]], Awaitable[None]] | None
        ) = None
        self.on_options_update: (
            Callable[[list[ExpirySummary], dict[str, OptionsSurfaceSummary]], Awaitable[None]]
            | None
        ) = None

    @property
    def open_interest_usd(self) -> float:
        """Combined USD open interest across Binance and Bybit."""
        return self.binance_oi_usd + self.bybit_oi_usd

    def set_candles(self, interval: TimeframeLiteral, bars: list[CandleBar]) -> None:
        """Replace timeframe ring buffer with chronologically sorted candles."""
        dq = self.candles[interval]
        dq.clear()
        sorted_bars = sorted(bars, key=lambda b: b.time)
        dq.extend(sorted_bars[-1500:])
        self.recompute_liquidation_bands(interval)

    def upsert_candle(self, interval: TimeframeLiteral, bar: CandleBar) -> None:
        """Update current bar or append a newer bar while preserving chronological order."""
        dq = self.candles[interval]
        if not dq:
            dq.append(bar)
        else:
            last = dq[-1]
            if bar.time == last.time:
                dq[-1] = bar
            elif bar.time > last.time:
                dq.append(bar)
            else:
                return

        if bar.is_closed:
            self.recompute_liquidation_bands(interval)
        else:
            self.mitigate_liquidation_bands(interval, bar.low, bar.high)

    def recompute_liquidation_bands(self, interval: TimeframeLiteral) -> list[LiquidationBand]:
        """Recompute predictive liquidation bands for a timeframe."""
        bars = list(self.candles[interval])
        bands = compute_predictive_liquidation_bands(
            bars,
            oi_delta_pct=self.oi_change_24h_pct / 100.0,
            current_price=self.mark_price if self.mark_price > 0.0 else None,
        )
        self.predicted_liq_bands[interval] = bands
        return bands

    def mitigate_liquidation_bands(
        self,
        interval: TimeframeLiteral,
        tick_low: float,
        tick_high: float,
    ) -> bool:
        """Remove swept predictive bands immediately; return True if any band was removed."""
        existing = self.predicted_liq_bands[interval]
        if not existing:
            return False
        surviving = filter_unmitigated_bands(existing, tick_low, tick_high)
        if len(surviving) != len(existing):
            self.predicted_liq_bands[interval] = surviving
            return True
        return False

    def get_candles(self, interval: TimeframeLiteral, limit: int = 1500) -> list[CandleBar]:
        """Return up to limit most recent candles in ascending chronological order."""
        dq = self.candles[interval]
        if limit <= 0:
            return []
        if limit >= len(dq):
            return list(dq)
        return list(dq)[-limit:]

    def seed_session_cvd(self, cvd_usd: float, utc_date: date) -> None:
        """Seed 00:00 UTC Session CVD from startup historical 1m taker-buy backfill."""
        self.session_cvd_usd = cvd_usd
        self._cvd_utc_date = utc_date

    def check_cvd_rollover(self, now_utc: datetime | None = None) -> bool:
        """Reset Session CVD to 0.0 when the UTC calendar date rolls past 00:00 UTC."""
        current_date = (now_utc or datetime.now(UTC)).date()
        if current_date > self._cvd_utc_date:
            self.session_cvd_usd = 0.0
            self._cvd_utc_date = current_date
            return True
        return False

    def record_trade_for_cvd(
        self,
        venue: VenueLiteral,
        side: TradeSideLiteral,
        price: float,
        size_btc: float,
        ts_ms: int,
    ) -> None:
        """Accumulate Session CVD from one active perp source (Binance, or Bybit on failover)."""
        if venue == "binance" and not self.binance_ws_connected:
            return
        if venue == "bybit" and self.binance_ws_connected:
            return

        trade_dt = datetime.fromtimestamp(ts_ms / 1000.0, tz=UTC)
        self.check_cvd_rollover(trade_dt)
        notional = price * size_btc
        if side == "buy":
            self.session_cvd_usd += notional
        else:
            self.session_cvd_usd -= notional

    def update_options(
        self,
        available_expiries: list[ExpirySummary],
        surfaces_by_expiry: dict[str, OptionsSurfaceSummary],
        sync_ms: int,
    ) -> None:
        """Atomically swap computed Deribit options surfaces."""
        self.available_expiries = available_expiries
        self.surfaces_by_expiry = surfaces_by_expiry
        self.deribit_last_sync_ms = sync_ms

    def to_header_telemetry(self) -> HeaderTelemetry:
        """Build 1Hz HeaderTelemetry snapshot."""
        self.check_cvd_rollover()
        return HeaderTelemetry(
            mark_price=round(self.mark_price, 2),
            index_price=round(self.index_price, 2),
            change_24h_pct=round(self.change_24h_pct, 4),
            funding_rate=self.funding_rate,
            next_funding_ms=self.next_funding_ms,
            open_interest_usd=round(self.open_interest_usd, 2),
            oi_change_24h_pct=round(self.oi_change_24h_pct, 4),
            session_cvd_usd=round(self.session_cvd_usd, 2),
        )
