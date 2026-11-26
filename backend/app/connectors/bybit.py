"""Bybit V5 Linear perpetuals REST fallback & WebSocket connector."""

import asyncio
import contextlib
import json
import logging
from typing import Any

import httpx
from websockets.asyncio.client import ClientConnection

from app.connectors.base import ReconnectingWSConnector
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

BYBIT_INTERVAL_MAP: dict[TimeframeLiteral, str] = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "1h": "60",
    "4h": "240",
    "1d": "D",
}


def parse_bybit_rest_klines(rows: list[list[Any]]) -> list[CandleBar]:
    """Parse Bybit /v5/market/kline rows, sorting newest-first input into ascending order."""
    ordered = sorted(rows, key=lambda r: int(r[0]))
    candles: list[CandleBar] = []
    for row in ordered:
        open_price = float(row[1])
        high_price = float(row[2])
        low_price = float(row[3])
        close_price = float(row[4])
        volume_btc = float(row[5])
        quote_usd = float(row[6])
        # Bybit kline omits taker-buy split; estimate only during REST fallback.
        taker_ratio = 0.55 if close_price >= open_price else 0.45
        candles.append(
            CandleBar(
                time=int(row[0]) // 1000,
                open=open_price,
                high=high_price,
                low=low_price,
                close=close_price,
                volume_btc=volume_btc,
                quote_usd=quote_usd,
                taker_buy_usd=round(quote_usd * taker_ratio, 2),
                is_closed=True,
            )
        )
    return candles


def parse_bybit_public_trade(item: dict[str, Any]) -> tuple[TradeSideLiteral, float, float, int]:
    """Parse a Bybit publicTrade.BTCUSDT item into (side, price, size_btc, ts_ms)."""
    side: TradeSideLiteral = "buy" if str(item["S"]) == "Buy" else "sell"
    return side, float(item["p"]), float(item["v"]), int(item["T"])


def parse_bybit_liquidations(msg: dict[str, Any]) -> list[RealizedLiquidation]:
    """Parse Bybit allLiquidation.BTCUSDT using inverted position-side semantics."""
    raw_data = msg.get("data")
    items: list[dict[str, Any]]
    if isinstance(raw_data, list):
        items = [x for x in raw_data if isinstance(x, dict)]
    elif isinstance(raw_data, dict):
        items = [raw_data]
    else:
        return []

    results: list[RealizedLiquidation] = []
    for item in items:
        if item.get("s") != "BTCUSDT":
            continue
        raw_side = str(item.get("S", ""))
        if raw_side == "Buy":
            side = "long_liq"
        elif raw_side == "Sell":
            side = "short_liq"
        else:
            continue
        price = float(item["p"])
        size_btc = float(item["v"])
        ts_ms = int(item["T"])
        if price <= 0.0 or size_btc <= 0.0:
            continue
        results.append(
            RealizedLiquidation(
                ts_ms=ts_ms,
                venue="bybit",
                side=side,
                price=price,
                size_btc=size_btc,
                notional_usd=round(price * size_btc, 2),
            )
        )
    return results


class BybitConnector(ReconnectingWSConnector):
    """Bybit V5 Linear WS listener (20s client ping) + REST fallback."""

    def __init__(
        self,
        rest_url: str,
        ws_url: str,
        state: MarketState,
        whale_aggregator: WhaleBurstAggregator,
        repository: TerminalRepository | None = None,
        liq_min_usd: float = 25_000.0,
    ) -> None:
        super().__init__(uris=[ws_url])
        self._rest_url = rest_url.rstrip("/")
        self._state = state
        self._whale_agg = whale_aggregator
        self._repository = repository
        self._liq_min_usd = liq_min_usd
        self._ping_task: asyncio.Task[None] | None = None

    async def backfill_klines_and_telemetry(
        self,
        client: httpx.AsyncClient,
        include_klines: bool = True,
    ) -> None:
        """Fetch Bybit V5 tickers (for Bybit OI) and optional fallback klines across all 6 TFs."""
        ticker_resp = await client.get(
            f"{self._rest_url}/v5/market/tickers",
            params={"category": "linear", "symbol": "BTCUSDT"},
        )
        ticker_resp.raise_for_status()
        ticker_list = ticker_resp.json().get("result", {}).get("list", [])
        if ticker_list:
            t = ticker_list[0]
            self._state.bybit_oi_usd = float(t.get("openInterestValue") or 0.0)
            if not self._state.binance_available:
                self._state.mark_price = float(t.get("markPrice") or 0.0)
                self._state.index_price = float(t.get("indexPrice") or 0.0)
                self._state.funding_rate = float(t.get("fundingRate") or 0.0)
                self._state.next_funding_ms = int(t.get("nextFundingTime") or 0)
                self._state.change_24h_pct = float(t.get("price24hPcnt") or 0.0) * 100.0

        if include_klines:
            for tf in TIMEFRAMES:
                bybit_tf = BYBIT_INTERVAL_MAP[tf]
                resp = await client.get(
                    f"{self._rest_url}/v5/market/kline",
                    params={
                        "category": "linear",
                        "symbol": "BTCUSDT",
                        "interval": bybit_tf,
                        "limit": 1000,
                    },
                )
                resp.raise_for_status()
                rows = resp.json().get("result", {}).get("list", [])
                self._state.set_candles(tf, parse_bybit_rest_klines(rows))

    async def _on_connected(self, ws: ClientConnection) -> None:
        self._state.bybit_ws_connected = True
        sub_payload = {
            "op": "subscribe",
            "args": [
                "publicTrade.BTCUSDT",
                "allLiquidation.BTCUSDT",
                "tickers.BTCUSDT",
            ],
        }
        await ws.send(json.dumps(sub_payload))
        self._ping_task = asyncio.create_task(self._ping_loop(ws))

    async def _on_disconnected(self) -> None:
        self._state.bybit_ws_connected = False
        if self._ping_task is not None:
            self._ping_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._ping_task
            self._ping_task = None

    async def _ping_loop(self, ws: ClientConnection) -> None:
        try:
            while not self._stop_event.is_set():
                await asyncio.sleep(20.0)
                await ws.send('{"op":"ping"}')
        except asyncio.CancelledError:
            return
        except Exception as exc:
            logger.debug("Bybit ping loop ended: %s", exc)

    async def _handle_message(self, raw_msg: str) -> None:
        msg = json.loads(raw_msg)
        if not isinstance(msg, dict):
            return
        op = msg.get("op")
        if op in {"pong", "subscribe"}:
            return

        topic = str(msg.get("topic", ""))
        if topic == "publicTrade.BTCUSDT":
            for item in msg.get("data", []):
                if not isinstance(item, dict):
                    continue
                side, price, size_btc, ts_ms = parse_bybit_public_trade(item)
                self._state.record_trade_for_cvd("bybit", side, price, size_btc, ts_ms)
                await self._whale_agg.ingest_trade("bybit", side, price, size_btc, ts_ms)
        elif topic == "allLiquidation.BTCUSDT":
            for liq in parse_bybit_liquidations(msg):
                if liq.notional_usd >= self._liq_min_usd:
                    if self._repository is not None:
                        self._repository.enqueue_liquidation(liq)
                    if self._state.on_liquidation is not None:
                        await self._state.on_liquidation(liq)
        elif topic == "tickers.BTCUSDT":
            data = msg.get("data")
            if isinstance(data, dict):
                if "openInterestValue" in data:
                    self._state.bybit_oi_usd = float(data["openInterestValue"])
                if not self._state.binance_ws_connected:
                    if "markPrice" in data:
                        self._state.mark_price = float(data["markPrice"])
                    if "indexPrice" in data:
                        self._state.index_price = float(data["indexPrice"])
                    if "fundingRate" in data:
                        self._state.funding_rate = float(data["fundingRate"])
                    if "nextFundingTime" in data:
                        self._state.next_funding_ms = int(data["nextFundingTime"])
                    if "price24hPcnt" in data:
                        self._state.change_24h_pct = float(data["price24hPcnt"]) * 100.0
