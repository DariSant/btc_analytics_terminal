"""Reconnecting WebSocket base connector with exponential backoff and staleness watchdog."""

import asyncio
import contextlib
import logging
import random
from abc import ABC, abstractmethod

from websockets.asyncio.client import ClientConnection, connect

logger = logging.getLogger(__name__)


class ReconnectingWSConnector(ABC):
    """Base async WebSocket client with jittered backoff and 45s staleness watchdog."""

    def __init__(
        self,
        uris: list[str],
        stale_timeout_sec: float = 45.0,
        min_backoff_sec: float = 1.0,
        max_backoff_sec: float = 30.0,
    ) -> None:
        if not uris:
            raise ValueError("At least one WebSocket URI must be provided")
        self._uris = uris
        self._stale_timeout_sec = stale_timeout_sec
        self._min_backoff_sec = min_backoff_sec
        self._max_backoff_sec = max_backoff_sec
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._active_ws: ClientConnection | None = None

    def start(self) -> None:
        """Launch background WebSocket listener loop."""
        if self._task is not None and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        """Signal loop shutdown, close active socket, and await clean task exit."""
        self._stop_event.set()
        if self._active_ws is not None:
            with contextlib.suppress(Exception):
                await self._active_ws.close()
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    async def _run_loop(self) -> None:
        attempt = 0
        while not self._stop_event.is_set():
            uri = self._uris[attempt % len(self._uris)]
            try:
                async with connect(uri, ping_interval=20, ping_timeout=20) as ws:
                    self._active_ws = ws
                    attempt = 0
                    await self._on_connected(ws)
                    while not self._stop_event.is_set():
                        raw = await asyncio.wait_for(
                            ws.recv(),
                            timeout=self._stale_timeout_sec,
                        )
                        if isinstance(raw, bytes):
                            text = raw.decode("utf-8", errors="replace")
                        else:
                            text = raw
                        await self._handle_message(text)
            except asyncio.CancelledError:
                raise
            except TimeoutError:
                logger.warning(
                    "%s WebSocket stale (>%ss), reconnecting",
                    type(self).__name__,
                    self._stale_timeout_sec,
                )
            except Exception as exc:
                logger.warning("%s WebSocket error on %s: %s", type(self).__name__, uri, exc)
            finally:
                self._active_ws = None
                await self._on_disconnected()

            if self._stop_event.is_set():
                break

            base_delay = min(self._max_backoff_sec, self._min_backoff_sec * (2**attempt))
            jitter = random.uniform(0.0, 0.25 * base_delay)
            attempt += 1
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=base_delay + jitter,
                )

    @abstractmethod
    async def _on_connected(self, ws: ClientConnection) -> None:
        """Hook invoked immediately after WebSocket handshake succeeds."""

    @abstractmethod
    async def _on_disconnected(self) -> None:
        """Hook invoked when WebSocket disconnects or fails."""

    @abstractmethod
    async def _handle_message(self, raw_msg: str) -> None:
        """Process a single incoming text WebSocket frame."""
