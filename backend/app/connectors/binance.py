"""Binance USDS-M Futures REST backfill & combined WebSocket stream connector."""

import json
import logging
from datetime import UTC, datetime, time
from typing import Any

import httpx
from websockets.asyncio.client import ClientConnection

from app.connectors.base import ReconnectingWSConnector
from app.connectors.bybit import BybitConnector
from app.db.repository import TerminalRepository
from app.engine.state import TIMEFRAMES, MarketState
from app.engine.whale_aggregator import WhaleBurstAggregator
from app.schemas import (
    CandleBar,
    RealizedLiquidation,
    TimeframeLiteral,
    TradeSideLiteral,
)

logger = logging.getLogger(__name__)
_TF_LOOKUP: dict[str, TimeframeLiteral] = {tf: tf for tf in TIMEFRAMES}


def parse_binance_rest_klines(rows: list[list[Any]]) -> list[CandleBar]:
    """Parse Binance /fapi/v1/klines rows (ascending ms) into CandleBar models."""
    candles: list[CandleBar] = []
    for row in rows:
        candles.append(
            CandleBar(
                time=int(row[0]) // 1000,
                open=float(row[1]),
                high=float(row[2]),
                low=float(row[3]),
                close=float(row[4]),
                volume_btc=float(row[5]),
                quote_usd=float(row[7]),
                taker_buy_usd=float(row[10]),
                is_closed=True,
            )
        )
    return candles


def compute_cvd_from_klines(rows: list[list[Any]]) -> float:
    """Compute 00:00 UTC Session CVD from Binance 1m klines via taker-buy quote volume."""
    total = 0.0
    for row in rows:
        quote_usd = float(row[7])
        taker_buy_usd = float(row[10])
        total += (2.0 * taker_buy_usd) - quote_usd
    return total


def parse_binance_agg_trade(data: dict[str, Any]) -> tuple[TradeSideLiteral, float, float, int]:
    """Parse Binance aggTrade payload: isBuyerMaker=False -> buy, True -> sell."""
    side: TradeSideLiteral = "sell" if bool(data["m"]) else "buy"
    return side, float(data["p"]), float(data["q"]), int(data["T"])


def parse_binance_force_order(data: dict[str, Any]) -> RealizedLiquidation | None:
    """Parse Binance forceOrder payload: S=SELL -> long_liq, S=BUY -> short_liq."""
    order = data.get("o")
    if not isinstance(order, dict) or order.get("s") != "BTCUSDT":
        return None
    if "st" in order and int(order["st"]) != 1:
        return None

    raw_side = str(order.get("S", ""))
    if raw_side == "SELL":
        side = "long_liq"
    elif raw_side == "BUY":
        side = "short_liq"
    else:
        return None

    avg_price = float(order.get("ap") or 0.0)
    price = avg_price if avg_price > 0.0 else float(order["p"])
    size_btc = float(order["q"])
    ts_ms = int(order["T"])
    if price <= 0.0 or size_btc <= 0.0:
        return None

    return RealizedLiquidation(
        ts_ms=ts_ms,
        venue="binance",
        side=side,
        price=price,
        size_btc=size_btc,
        notional_usd=round(price * size_btc, 2),
    )


def parse_binance_ws_kline(data: dict[str, Any]) -> tuple[TimeframeLiteral, CandleBar] | None:
    """Parse Binance WebSocket kline_{tf} event payload."""
    k = data.get("k")
    if not isinstance(k, dict):
        return None
    raw_tf = str(k.get("i", ""))
    tf = _TF_LOOKUP.get(raw_tf)
    if tf is None:
        return None
    bar = CandleBar(
        time=int(k["t"]) // 1000,
        open=float(k["o"]),
        high=float(k["h"]),
        low=float(k["l"]),
        close=float(k["c"]),
        volume_btc=float(k["v"]),
        quote_usd=float(k["q"]),
        taker_buy_usd=float(k["Q"]),
        is_closed=bool(k["x"]),
    )
    return tf, bar


def _build_handshake_fallback_uri(primary_ws_url: str) -> str:
    if "/market/stream?" in primary_ws_url:
        return primary_ws_url.replace("/market/stream?", "/stream?", 1)
    return primary_ws_url


class BinanceConnector(ReconnectingWSConnector):
    """Binance USDS-M Futures connector with HTTP 451 fallback and 00:00 UTC CVD backfill."""

    def __init__(
        self,
        rest_url: str,
        ws_url: str,
        state: MarketState,
        whale_aggregator: WhaleBurstAggregator,
        repository: TerminalRepository | None = None,
        liq_min_usd: float = 25_000.0,
    ) -> None:
        fallback_ws = _build_handshake_fallback_uri(ws_url)
        uris = [ws_url] if fallback_ws == ws_url else [ws_url, fallback_ws]
        super().__init__(uris=uris)
        self._rest_url = rest_url.rstrip("/")
        self._state = state
        self._whale_agg = whale_aggregator
        self._repository = repository
        self._liq_min_usd = liq_min_usd

    async def backfill_all(
        self,
        client: httpx.AsyncClient,
        bybit_fallback: BybitConnector | None = None,
        now_utc: datetime | None = None,
    ) -> None:
        """Backfill 6 timeframe histories, telemetry, OI, and 00:00 UTC Session CVD."""
        ref_now = now_utc or datetime.now(UTC)
        try:
            for tf in TIMEFRAMES:
                resp = await client.get(
                    f"{self._rest_url}/fapi/v1/klines",
                    params={"symbol": "BTCUSDT", "interval": tf, "limit": 1500},
                )
                resp.raise_for_status()
                self._state.set_candles(tf, parse_binance_rest_klines(resp.json()))

            prem_resp = await client.get(
                f"{self._rest_url}/fapi/v1/premiumIndex",
                params={"symbol": "BTCUSDT"},
            )
            prem_resp.raise_for_status()
            prem = prem_resp.json()
            self._state.mark_price = float(prem.get("markPrice") or 0.0)
            self._state.index_price = float(prem.get("indexPrice") or 0.0)
            self._state.funding_rate = float(prem.get("lastFundingRate") or 0.0)
            self._state.next_funding_ms = int(prem.get("nextFundingTime") or 0)

            ticker_resp = await client.get(
                f"{self._rest_url}/fapi/v1/ticker/24hr",
                params={"symbol": "BTCUSDT"},
            )
            ticker_resp.raise_for_status()
            self._state.change_24h_pct = float(ticker_resp.json().get("priceChangePercent") or 0.0)

            oi_resp = await client.get(
                f"{self._rest_url}/futures/data/openInterestHist",
                params={"symbol": "BTCUSDT", "period": "5m", "limit": 289},
            )
            oi_resp.raise_for_status()
            oi_rows = oi_resp.json()
            if isinstance(oi_rows, list) and oi_rows:
                latest_oi = float(oi_rows[-1]["sumOpenInterestValue"])
                oldest_oi = float(oi_rows[0]["sumOpenInterestValue"])
                self._state.binance_oi_usd = latest_oi
                if oldest_oi > 0.0:
                    self._state.oi_change_24h_pct = ((latest_oi - oldest_oi) / oldest_oi) * 100.0

            await self._backfill_session_cvd(client, ref_now)
            self._state.binance_available = True
            if bybit_fallback is not None:
                await bybit_fallback.backfill_klines_and_telemetry(client, include_klines=False)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 451 or exc.response.status_code >= 500:
                logger.warning(
                    "Binance REST unavailable (HTTP %s); falling back to Bybit",
                    exc.response.status_code,
                )
                self._state.binance_available = False
                if bybit_fallback is not None:
                    await bybit_fallback.backfill_klines_and_telemetry(client, include_klines=True)
            else:
                raise
        except httpx.RequestError as exc:
            logger.warning("Binance REST request error (%s); falling back to Bybit", exc)
            self._state.binance_available = False
            if bybit_fallback is not None:
                await bybit_fallback.backfill_klines_and_telemetry(client, include_klines=True)

    async def _backfill_session_cvd(self, client: httpx.AsyncClient, ref_now: datetime) -> None:
        utc_midnight = datetime.combine(ref_now.date(), time.min, tzinfo=UTC)
        start_ms = int(utc_midnight.timestamp() * 1000)
        end_ms = int(ref_now.timestamp() * 1000)
        rows: list[list[Any]] = []
        cursor_ms = start_ms
        while cursor_ms <= end_ms:
            resp = await client.get(
                f"{self._rest_url}/fapi/v1/klines",
                params={
                    "symbol": "BTCUSDT",
                    "interval": "1m",
                    "startTime": cursor_ms,
                    "endTime": end_ms,
                    "limit": 1500,
                },
            )
            resp.raise_for_status()
            batch = resp.json()
            if not isinstance(batch, list) or not batch:
                break
            rows.extend(batch)
            if len(batch) < 1500:
                break
            cursor_ms = int(batch[-1][0]) + 60_000
        self._state.seed_session_cvd(compute_cvd_from_klines(rows), ref_now.date())

    async def _on_connected(self, ws: ClientConnection) -> None:
        self._state.binance_ws_connected = True

    async def _on_disconnected(self) -> None:
        self._state.binance_ws_connected = False

    async def _handle_message(self, raw_msg: str) -> None:
        envelope = json.loads(raw_msg)
        if not isinstance(envelope, dict):
            return
        stream = str(envelope.get("stream", ""))
        data = envelope.get("data")
        if not isinstance(data, dict):
            return

        if stream == "btcusdt@aggTrade":
            side, price, size_btc, ts_ms = parse_binance_agg_trade(data)
            self._state.record_trade_for_cvd("binance", side, price, size_btc, ts_ms)
            await self._whale_agg.ingest_trade("binance", side, price, size_btc, ts_ms)
        elif stream == "btcusdt@forceOrder":
            liq = parse_binance_force_order(data)
            if liq is not None and liq.notional_usd >= self._liq_min_usd:
                if self._repository is not None:
                    self._repository.enqueue_liquidation(liq)
                if self._state.on_liquidation is not None:
                    await self._state.on_liquidation(liq)
        elif stream == "btcusdt@markPrice@1s":
            self._state.mark_price = float(data.get("p") or self._state.mark_price)
            self._state.index_price = float(data.get("i") or self._state.index_price)
            self._state.funding_rate = float(data.get("r") or self._state.funding_rate)
            self._state.next_funding_ms = int(data.get("T") or self._state.next_funding_ms)
        elif stream.startswith("btcusdt@kline_"):
            parsed = parse_binance_ws_kline(data)
            if parsed is not None:
                tf, bar = parsed
                prev_bands = self._state.predicted_liq_bands[tf]
                self._state.upsert_candle(tf, bar)
                if self._state.on_kline is not None:
                    await self._state.on_kline(tf, bar)
                new_bands = self._state.predicted_liq_bands[tf]
                if new_bands != prev_bands and self._state.on_liq_bands is not None:
                    await self._state.on_liq_bands(tf, new_bands)
