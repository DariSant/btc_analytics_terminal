"""Multiplexed /ws/btc ConnectionManager with 4Hz kline coalescing and slow-client eviction."""

import asyncio
import contextlib
import logging
import time
from typing import Any

from fastapi import WebSocket
from pydantic import ValidationError

from app.schemas import (
    CandleBar,
    ExpirySummary,
    HeaderTelemetry,
    LiquidationBand,
    OptionsSurfaceSummary,
    RealizedLiquidation,
    TimeframeLiteral,
    WhalePrint,
    WsClientCommand,
    WsKlineEvent,
    WsLiqBandsEvent,
    WsLiquidationEvent,
    WsOptionsUpdateEvent,
    WsTelemetryEvent,
    WsWhaleEvent,
)

logger = logging.getLogger(__name__)

KLINE_THROTTLE_SEC = 0.25  # Max 4 Hz outbound kline cadence per interval
SEND_TIMEOUT_SEC = 2.0


class ConnectionManager:
    """Manages /ws/btc client subscriptions, coalesced klines, and safe broadcasts."""

    def __init__(self) -> None:
        self._clients: dict[WebSocket, TimeframeLiteral] = {}
        self._last_kline_sent: dict[TimeframeLiteral, float] = {}
        self._pending_klines: dict[TimeframeLiteral, CandleBar] = {}
        self._kline_flush_tasks: dict[TimeframeLiteral, asyncio.Task[None]] = {}

    @property
    def client_count(self) -> int:
        """Return count of active WebSocket clients."""
        return len(self._clients)

    async def connect(self, websocket: WebSocket) -> None:
        """Accept WebSocket handshake and register default 5m subscription."""
        await websocket.accept()
        self._clients[websocket] = "5m"

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove WebSocket client from active subscriptions."""
        self._clients.pop(websocket, None)

    def get_subscription(self, websocket: WebSocket) -> TimeframeLiteral | None:
        """Return currently subscribed interval for a client."""
        return self._clients.get(websocket)

    def handle_client_text(self, websocket: WebSocket, raw_text: str) -> TimeframeLiteral | None:
        """Parse and apply inbound WsClientCommand without crashing on malformed frames."""
        try:
            cmd = WsClientCommand.model_validate_json(raw_text)
        except ValidationError:
            logger.debug("Ignored invalid /ws/btc client message: %s", raw_text[:120])
            return None
        if websocket in self._clients:
            self._clients[websocket] = cmd.interval
            return cmd.interval
        return None

    async def _send_to_clients(
        self,
        payload: dict[str, Any],
        target_interval: TimeframeLiteral | None = None,
    ) -> None:
        if not self._clients:
            return
        stale: list[WebSocket] = []
        for ws, subscribed_tf in list(self._clients.items()):
            if target_interval is not None and subscribed_tf != target_interval:
                continue
            try:
                await asyncio.wait_for(ws.send_json(payload), timeout=SEND_TIMEOUT_SEC)
            except (TimeoutError, Exception):
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)

    async def publish_kline(self, interval: TimeframeLiteral, candle: CandleBar) -> None:
        """Broadcast kline at max 4 Hz per interval, flushing closed candles immediately."""
        if candle.is_closed:
            pending_task = self._kline_flush_tasks.pop(interval, None)
            if pending_task is not None and not pending_task.done():
                pending_task.cancel()
            self._pending_klines.pop(interval, None)
            self._last_kline_sent[interval] = time.monotonic()
            event = WsKlineEvent(type="kline", interval=interval, candle=candle)
            await self._send_to_clients(event.model_dump(mode="json"), target_interval=interval)
            return

        now = time.monotonic()
        last_sent = self._last_kline_sent.get(interval, 0.0)
        if (now - last_sent) >= KLINE_THROTTLE_SEC:
            self._pending_klines.pop(interval, None)
            self._last_kline_sent[interval] = now
            event = WsKlineEvent(type="kline", interval=interval, candle=candle)
            await self._send_to_clients(event.model_dump(mode="json"), target_interval=interval)
            return

        self._pending_klines[interval] = candle
        existing = self._kline_flush_tasks.get(interval)
        if existing is None or existing.done():
            delay = max(0.01, KLINE_THROTTLE_SEC - (now - last_sent))
            self._kline_flush_tasks[interval] = asyncio.create_task(
                self._flush_pending_kline(interval, delay)
            )

    async def _flush_pending_kline(self, interval: TimeframeLiteral, delay: float) -> None:
        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            return
        candle = self._pending_klines.pop(interval, None)
        self._kline_flush_tasks.pop(interval, None)
        if candle is None:
            return
        self._last_kline_sent[interval] = time.monotonic()
        event = WsKlineEvent(type="kline", interval=interval, candle=candle)
        await self._send_to_clients(event.model_dump(mode="json"), target_interval=interval)

    async def broadcast_whale(self, whale: WhalePrint) -> None:
        """Broadcast global whale print to all connected clients."""
        event = WsWhaleEvent(type="whale", data=whale)
        await self._send_to_clients(event.model_dump(mode="json"))

    async def broadcast_liquidation(self, liq: RealizedLiquidation) -> None:
        """Broadcast global realized liquidation to all connected clients."""
        event = WsLiquidationEvent(type="liquidation", data=liq)
        await self._send_to_clients(event.model_dump(mode="json"))

    async def broadcast_liq_bands(
        self,
        interval: TimeframeLiteral,
        bands: list[LiquidationBand],
    ) -> None:
        """Broadcast updated predictive liquidation bands to interval subscribers."""
        event = WsLiqBandsEvent(type="liq_bands", interval=interval, bands=bands)
        await self._send_to_clients(event.model_dump(mode="json"), target_interval=interval)

    async def broadcast_telemetry(self, telemetry: HeaderTelemetry) -> None:
        """Broadcast 1Hz HeaderTelemetry snapshot to all connected clients."""
        event = WsTelemetryEvent(type="telemetry", data=telemetry)
        await self._send_to_clients(event.model_dump(mode="json"))

    async def broadcast_options(
        self,
        available_expiries: list[ExpirySummary],
        surfaces_by_expiry: dict[str, OptionsSurfaceSummary],
    ) -> None:
        """Broadcast 60s Deribit options surface refresh to all connected clients."""
        event = WsOptionsUpdateEvent(
            type="options_update",
            available_expiries=available_expiries,
            surfaces_by_expiry=surfaces_by_expiry,
        )
        await self._send_to_clients(event.model_dump(mode="json"))

    async def close(self) -> None:
        """Cancel pending kline coalescing tasks cleanly."""
        for task in list(self._kline_flush_tasks.values()):
            if not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
        self._kline_flush_tasks.clear()
        self._pending_klines.clear()
