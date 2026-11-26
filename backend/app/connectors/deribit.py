"""Deribit Public Options API v2 60s poller with 30-minute SQLite snapshot persistence."""

import asyncio
import contextlib
import logging
import time

import httpx

from app.db.repository import TerminalRepository
from app.engine.options_quant import compute_options_surfaces
from app.engine.state import MarketState

logger = logging.getLogger(__name__)


class DeribitOptionsPoller:
    """Polls Deribit BTC options book summary every 60s and persists 30m snapshots."""

    def __init__(
        self,
        rest_url: str,
        state: MarketState,
        repository: TerminalRepository | None = None,
        client: httpx.AsyncClient | None = None,
        poll_interval_sec: float = 60.0,
        snapshot_interval_sec: float = 1800.0,
    ) -> None:
        self._rest_url = rest_url.rstrip("/")
        self._state = state
        self._repository = repository
        self._external_client = client
        self._owned_client: httpx.AsyncClient | None = None
        self._poll_interval_sec = poll_interval_sec
        self._snapshot_interval_sec = snapshot_interval_sec
        self._last_snapshot_ts: float = 0.0
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._external_client is not None:
            return self._external_client
        if self._owned_client is None:
            self._owned_client = httpx.AsyncClient(timeout=10.0)
        return self._owned_client

    async def poll_once(self, now_sec: float | None = None) -> bool:
        """Fetch Deribit options summary once, update MarketState, and persist 30m snapshots."""
        ref_now = now_sec if now_sec is not None else time.time()
        client = self._get_client()
        try:
            resp = await client.get(
                f"{self._rest_url}/public/get_book_summary_by_currency",
                params={"currency": "BTC", "kind": "option"},
            )
            resp.raise_for_status()
            payload = resp.json()
            book_items = payload.get("result")
            if not isinstance(book_items, list):
                logger.warning("Unexpected Deribit payload format (missing result list)")
                return False

            expiries, surfaces = compute_options_surfaces(book_items, now_sec=ref_now)
            if not surfaces:
                return False

            sync_ms = int(ref_now * 1000)
            self._state.update_options(expiries, surfaces, sync_ms)

            if (
                self._repository is not None
                and (ref_now - self._last_snapshot_ts) >= self._snapshot_interval_sec
            ):
                keys_to_save = ["ALL"] + [
                    e.expiry_key for e in expiries if e.expiry_key != "ALL"
                ][:3]
                for key in keys_to_save:
                    summary = surfaces.get(key)
                    if summary is not None:
                        await self._repository.save_options_snapshot(sync_ms, summary)
                self._last_snapshot_ts = ref_now

            if self._state.on_options_update is not None:
                await self._state.on_options_update(expiries, surfaces)

            return True
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Deribit poll failed: %s", exc)
            return False

    def start(self) -> None:
        """Start background 60s polling loop."""
        if self._task is not None and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._poll_loop())

    async def _poll_loop(self) -> None:
        backoff = 5.0
        while not self._stop_event.is_set():
            ok = await self.poll_once()
            wait_sec = self._poll_interval_sec if ok else backoff
            backoff = 5.0 if ok else min(60.0, backoff * 2.0)
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._stop_event.wait(), timeout=wait_sec)

    async def stop(self) -> None:
        """Stop background poller and close internally owned HTTP client."""
        self._stop_event.set()
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        if self._owned_client is not None:
            await self._owned_client.aclose()
            self._owned_client = None
