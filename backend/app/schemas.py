"""Canonical Pydantic v2 wire contracts for REST and /ws/btc."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

TimeframeLiteral = Literal["1m", "5m", "15m", "1h", "4h", "1d"]
VenueLiteral = Literal["binance", "bybit"]
TradeSideLiteral = Literal["buy", "sell"]
LiquidationSideLiteral = Literal["long_liq", "short_liq"]
LeverageTierLiteral = Literal[10, 25, 50, 100]

# Bounds separating integer UTC seconds (LWC UTCTimestamp) from integer UTC milliseconds.
MIN_UTC_MS = 1_000_000_000_000
MAX_UTC_SEC = 9_999_999_999


class StrictModel(BaseModel):
    """Base model forbidding undeclared extra fields on wire payloads."""

    model_config = ConfigDict(extra="forbid")


class CandleBar(StrictModel):
    """Normalized OHLCV bar with UTC second timestamp required by Lightweight Charts."""

    time: int = Field(
        ge=0,
        le=MAX_UTC_SEC,
        description="Candle open timestamp in integer UTC seconds",
    )
    open: float = Field(gt=0.0)
    high: float = Field(gt=0.0)
    low: float = Field(gt=0.0)
    close: float = Field(gt=0.0)
    volume_btc: float = Field(ge=0.0)
    quote_usd: float = Field(ge=0.0)
    taker_buy_usd: float = Field(ge=0.0)
    is_closed: bool = True


class WhalePrint(StrictModel):
    """Per-venue 100ms VWAP whale burst print (>= $100,000)."""

    ts_ms: int = Field(ge=MIN_UTC_MS, description="Event timestamp in integer UTC milliseconds")
    venue: VenueLiteral
    side: TradeSideLiteral
    price: float = Field(gt=0.0)
    size_btc: float = Field(gt=0.0)
    notional_usd: float = Field(gt=0.0)


class RealizedLiquidation(StrictModel):
    """Normalized forced liquidation order (>= $25,000)."""

    ts_ms: int = Field(ge=MIN_UTC_MS, description="Event timestamp in integer UTC milliseconds")
    venue: VenueLiteral
    side: LiquidationSideLiteral
    price: float = Field(gt=0.0)
    size_btc: float = Field(gt=0.0)
    notional_usd: float = Field(gt=0.0)


class LiquidationBand(StrictModel):
    """Unmitigated OI-weighted swing leverage liquidation cluster."""

    anchor_time: int = Field(
        ge=0,
        le=MAX_UTC_SEC,
        description="Origin pivot candle open timestamp in integer UTC seconds",
    )
    price: float = Field(gt=0.0)
    side: LiquidationSideLiteral
    leverage: LeverageTierLiteral
    intensity: float = Field(ge=0.0, le=1.0)


class StrikeMetrics(StrictModel):
    """Per-strike Deribit BTC options open interest and net dealer GEX."""

    strike: float = Field(gt=0.0)
    call_oi: float = Field(ge=0.0)
    put_oi: float = Field(ge=0.0)
    net_gex_usd: float


class ExpirySummary(StrictModel):
    """Metadata and OI share for an active Deribit options expiry scope."""

    expiry_key: str
    expiry_ts_ms: int | None = Field(default=None, ge=MIN_UTC_MS)
    total_oi_btc: float = Field(ge=0.0)
    oi_share_pct: float = Field(ge=0.0, le=100.0)


class OptionsSurfaceSummary(StrictModel):
    """Computed options dealer positioning summary for an expiry scope."""

    expiry_key: str
    underlying_price: float = Field(gt=0.0)
    call_wall: float = Field(ge=0.0)
    call_wall_oi: float = Field(ge=0.0)
    put_wall: float = Field(ge=0.0)
    put_wall_oi: float = Field(ge=0.0)
    max_pain: float = Field(ge=0.0)
    put_call_ratio: float = Field(ge=0.0)
    net_gex_usd: float
    top_gex_strikes: list[StrikeMetrics] = Field(default_factory=list)


class HeaderTelemetry(StrictModel):
    """Live 1Hz header telemetry snapshot."""

    mark_price: float = Field(ge=0.0)
    index_price: float = Field(ge=0.0)
    change_24h_pct: float
    funding_rate: float
    next_funding_ms: int = Field(ge=0)
    open_interest_usd: float = Field(ge=0.0)
    oi_change_24h_pct: float
    session_cvd_usd: float


class HealthResponse(StrictModel):
    """Response contract for GET /api/v1/health."""

    status: Literal["ok", "degraded"]
    uptime_sec: float = Field(ge=0.0)
    binance_ws: bool
    bybit_ws: bool
    deribit_last_sync_ms: int | None = Field(default=None, ge=MIN_UTC_MS)
    sqlite_ok: bool


class KlinesResponse(StrictModel):
    """Response contract for GET /api/v1/klines."""

    interval: TimeframeLiteral
    candles: list[CandleBar]
    predicted_liquidations: list[LiquidationBand]


class OverlaysHistoryResponse(StrictModel):
    """Response contract for GET /api/v1/overlays/history."""

    whales: list[WhalePrint]
    liquidations: list[RealizedLiquidation]


class OptionsResponse(StrictModel):
    """Response contract for GET /api/v1/options."""

    selected_expiry: str
    available_expiries: list[ExpirySummary]
    summary: OptionsSurfaceSummary


class WsClientCommand(StrictModel):
    """Inbound client command over /ws/btc."""

    type: Literal["set_timeframe"]
    interval: TimeframeLiteral


class WsKlineEvent(StrictModel):
    """Live candle update for client's subscribed timeframe."""

    type: Literal["kline"]
    interval: TimeframeLiteral
    candle: CandleBar


class WsWhaleEvent(StrictModel):
    """Global live whale print event."""

    type: Literal["whale"]
    data: WhalePrint


class WsLiquidationEvent(StrictModel):
    """Global live realized liquidation event."""

    type: Literal["liquidation"]
    data: RealizedLiquidation


class WsLiqBandsEvent(StrictModel):
    """Updated unmitigated predictive liquidation bands for a timeframe."""

    type: Literal["liq_bands"]
    interval: TimeframeLiteral
    bands: list[LiquidationBand]


class WsTelemetryEvent(StrictModel):
    """Global 1Hz header telemetry update."""

    type: Literal["telemetry"]
    data: HeaderTelemetry


class WsOptionsUpdateEvent(StrictModel):
    """Global 60s Deribit options surface refresh."""

    type: Literal["options_update"]
    available_expiries: list[ExpirySummary]
    surfaces_by_expiry: dict[str, OptionsSurfaceSummary]


WsServerEvent = Annotated[
    WsKlineEvent
    | WsWhaleEvent
    | WsLiquidationEvent
    | WsLiqBandsEvent
    | WsTelemetryEvent
    | WsOptionsUpdateEvent,
    Field(discriminator="type"),
]

WS_SERVER_EVENT_ADAPTER: TypeAdapter[WsServerEvent] = TypeAdapter(WsServerEvent)
