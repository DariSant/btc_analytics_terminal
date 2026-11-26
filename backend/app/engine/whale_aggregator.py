"""Per-venue 100ms whale burst aggregator computing VWAP WhalePrint events."""

import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from app.schemas import TradeSideLiteral, VenueLiteral, WhalePrint


@dataclass
class _BurstBucket:
    side: TradeSideLiteral
    window_start_ms: int
    last_ts_ms: int
    total_btc: float
    total_usd: float


class WhaleBurstAggregator:
    """Aggregates consecutive same-side fills per venue inside a 100ms window."""

    def __init__(
        self,
        min_notional_usd: float,
        on_emit: Callable[[WhalePrint], Awaitable[None]],
    ) -> None:
        self._min_usd = min_notional_usd
        self._on_emit = on_emit
        self._buckets: dict[VenueLiteral, _BurstBucket | None] = {
            "binance": None,
            "bybit": None,
        }
        self._flush_tasks: dict[VenueLiteral, asyncio.Task[None] | None] = {
            "binance": None,
            "bybit": None,
        }

    async def ingest_trade(
        self,
        venue: VenueLiteral,
        side: TradeSideLiteral,
        price: float,
        size_btc: float,
        ts_ms: int,
    ) -> None:
        """Ingest one trade fill and flush prior bucket if side flips or >100ms elapsed."""
        if price <= 0.0 or size_btc <= 0.0:
            return
        notional = price * size_btc
        bucket = self._buckets[venue]
        if bucket is not None and (
            bucket.side != side or (ts_ms - bucket.window_start_ms) > 100
        ):
            await self._flush(venue)
            bucket = None

        if bucket is None:
            self._buckets[venue] = _BurstBucket(
                side=side,
                window_start_ms=ts_ms,
                last_ts_ms=ts_ms,
                total_btc=size_btc,
                total_usd=notional,
            )
            self._schedule_timer(venue)
        else:
            bucket.last_ts_ms = ts_ms
            bucket.total_btc += size_btc
            bucket.total_usd += notional

    def _schedule_timer(self, venue: VenueLiteral) -> None:
        existing = self._flush_tasks[venue]
        if existing is not None and not existing.done():
            existing.cancel()
        self._flush_tasks[venue] = asyncio.create_task(self._delayed_flush(venue))

    async def _delayed_flush(self, venue: VenueLiteral) -> None:
        try:
            await asyncio.sleep(0.12)
            await self._flush(venue)
        except asyncio.CancelledError:
            return

    async def _flush(self, venue: VenueLiteral) -> None:
        bucket = self._buckets[venue]
        self._buckets[venue] = None
        if bucket is None or bucket.total_btc <= 0.0 or bucket.total_usd < self._min_usd:
            return
        vwap = bucket.total_usd / bucket.total_btc
        await self._on_emit(
            WhalePrint(
                ts_ms=bucket.last_ts_ms,
                venue=venue,
                side=bucket.side,
                price=round(vwap, 2),
                size_btc=round(bucket.total_btc, 6),
                notional_usd=round(bucket.total_usd, 2),
            )
        )

    async def close(self) -> None:
        """Cancel pending timers and flush any remaining open venue buckets."""
        venues: tuple[VenueLiteral, VenueLiteral] = ("binance", "bybit")
        for venue in venues:
            task = self._flush_tasks[venue]
            if task is not None and not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            self._flush_tasks[venue] = None
            await self._flush(venue)
