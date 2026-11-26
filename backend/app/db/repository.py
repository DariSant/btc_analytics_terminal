"""Async SQLite WAL repository with queued batch writes and rolling retention."""

import asyncio
import contextlib
import json
import time
from pathlib import Path
from typing import cast

import aiosqlite

from app.schemas import (
    LiquidationSideLiteral,
    OptionsSurfaceSummary,
    RealizedLiquidation,
    StrikeMetrics,
    TradeSideLiteral,
    VenueLiteral,
    WhalePrint,
)

SCHEMA_PATH = Path(__file__).with_name("schema.sql")

_QueueItem = tuple[str, tuple[object, ...]]


class TerminalRepository:
    """Non-blocking SQLite WAL storage for Tier-2 whale, liquidation, and options history."""

    def __init__(
        self,
        db_path: str,
        whale_min_usd: float = 100_000.0,
        liq_min_usd: float = 25_000.0,
        flush_interval_sec: float = 1.0,
        batch_size: int = 50,
    ) -> None:
        self._db_path = db_path
        self._whale_min_usd = whale_min_usd
        self._liq_min_usd = liq_min_usd
        self._flush_interval_sec = flush_interval_sec
        self._batch_size = batch_size
        self._conn: aiosqlite.Connection | None = None
        self._queue: asyncio.Queue[_QueueItem] = asyncio.Queue()
        self._wake_event: asyncio.Event = asyncio.Event()
        self._flush_lock: asyncio.Lock = asyncio.Lock()
        self._flush_task: asyncio.Task[None] | None = None
        self._closed = False

    def _require_conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("TerminalRepository is not initialized")
        return self._conn

    async def initialize(self) -> None:
        """Open SQLite connection in WAL mode, apply DDL, and start batch flush worker."""
        if self._db_path != ":memory:":
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = await aiosqlite.connect(self._db_path)
        await conn.execute("PRAGMA journal_mode=WAL;")
        await conn.execute("PRAGMA synchronous=NORMAL;")
        await conn.execute("PRAGMA temp_store=MEMORY;")
        await conn.execute("PRAGMA busy_timeout=5000;")
        schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
        await conn.executescript(schema_sql)
        await conn.commit()
        self._conn = conn
        self._closed = False
        self._flush_task = asyncio.create_task(self._flush_loop())

    async def get_journal_mode(self) -> str:
        """Return active SQLite journal_mode pragma."""
        conn = self._require_conn()
        async with conn.execute("PRAGMA journal_mode;") as cursor:
            row = await cursor.fetchone()
            return str(row[0]).lower() if row is not None else ""

    def enqueue_whale(self, whale: WhalePrint) -> bool:
        """Queue whale print for transactional batch insert if above USD threshold."""
        if self._closed or whale.notional_usd < self._whale_min_usd:
            return False
        self._queue.put_nowait(
            (
                "whale",
                (
                    whale.ts_ms,
                    whale.venue,
                    whale.side,
                    whale.price,
                    whale.size_btc,
                    whale.notional_usd,
                ),
            )
        )
        if self._queue.qsize() >= self._batch_size:
            self._wake_event.set()
        return True

    def enqueue_liquidation(self, liq: RealizedLiquidation) -> bool:
        """Queue realized liquidation for transactional batch insert if above USD threshold."""
        if self._closed or liq.notional_usd < self._liq_min_usd:
            return False
        self._queue.put_nowait(
            (
                "liquidation",
                (
                    liq.ts_ms,
                    liq.venue,
                    liq.side,
                    liq.price,
                    liq.size_btc,
                    liq.notional_usd,
                ),
            )
        )
        if self._queue.qsize() >= self._batch_size:
            self._wake_event.set()
        return True

    async def _flush_loop(self) -> None:
        while not self._closed:
            self._wake_event.clear()
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._wake_event.wait(), timeout=self._flush_interval_sec)
            await self.flush_now()

    async def flush_now(self) -> int:
        """Drain queued records and persist them in a single transaction."""
        if self._conn is None or self._queue.empty():
            return 0
        async with self._flush_lock:
            whale_rows: list[tuple[object, ...]] = []
            liq_rows: list[tuple[object, ...]] = []
            while not self._queue.empty():
                kind, row = self._queue.get_nowait()
                if kind == "whale":
                    whale_rows.append(row)
                else:
                    liq_rows.append(row)
                self._queue.task_done()

            total = len(whale_rows) + len(liq_rows)
            if total == 0:
                return 0

            conn = self._require_conn()
            if whale_rows:
                await conn.executemany(
                    """
                    INSERT INTO whale_trades (ts_ms, venue, side, price, size_btc, notional_usd)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    whale_rows,
                )
            if liq_rows:
                await conn.executemany(
                    """
                    INSERT INTO liquidations (ts_ms, venue, side, price, size_btc, notional_usd)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    liq_rows,
                )
            await conn.commit()
            return total

    async def save_options_snapshot(self, ts_ms: int, summary: OptionsSurfaceSummary) -> None:
        """Persist an options surface snapshot for historical analysis."""
        conn = self._require_conn()
        strikes_json = json.dumps([s.model_dump() for s in summary.top_gex_strikes])
        await conn.execute(
            """
            INSERT INTO options_snapshots (
                ts_ms, expiry_key, underlying_price, call_wall, put_wall,
                max_pain, put_call_ratio, net_gex_usd, strikes_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ts_ms,
                summary.expiry_key,
                summary.underlying_price,
                summary.call_wall,
                summary.put_wall,
                summary.max_pain,
                summary.put_call_ratio,
                summary.net_gex_usd,
                strikes_json,
            ),
        )
        await conn.commit()

    async def get_recent_whales(
        self,
        since_ms: int,
        min_usd: float = 100_000.0,
        limit: int = 2000,
    ) -> list[WhalePrint]:
        """Fetch recent whale prints matching time and USD bounds in chronological order."""
        conn = self._require_conn()
        async with conn.execute(
            """
            SELECT ts_ms, venue, side, price, size_btc, notional_usd
            FROM whale_trades
            WHERE ts_ms >= ? AND notional_usd >= ?
            ORDER BY ts_ms DESC
            LIMIT ?
            """,
            (since_ms, min_usd, limit),
        ) as cursor:
            rows = list(await cursor.fetchall())

        rows.reverse()
        return [
            WhalePrint(
                ts_ms=int(r[0]),
                venue=cast(VenueLiteral, str(r[1])),
                side=cast(TradeSideLiteral, str(r[2])),
                price=float(r[3]),
                size_btc=float(r[4]),
                notional_usd=float(r[5]),
            )
            for r in rows
        ]

    async def get_recent_liquidations(
        self,
        since_ms: int,
        limit: int = 2000,
    ) -> list[RealizedLiquidation]:
        """Fetch recent realized liquidations in chronological order."""
        conn = self._require_conn()
        async with conn.execute(
            """
            SELECT ts_ms, venue, side, price, size_btc, notional_usd
            FROM liquidations
            WHERE ts_ms >= ?
            ORDER BY ts_ms DESC
            LIMIT ?
            """,
            (since_ms, limit),
        ) as cursor:
            rows = list(await cursor.fetchall())

        rows.reverse()
        return [
            RealizedLiquidation(
                ts_ms=int(r[0]),
                venue=cast(VenueLiteral, str(r[1])),
                side=cast(LiquidationSideLiteral, str(r[2])),
                price=float(r[3]),
                size_btc=float(r[4]),
                notional_usd=float(r[5]),
            )
            for r in rows
        ]

    async def get_latest_options_snapshot(
        self,
        expiry_key: str,
    ) -> tuple[int, OptionsSurfaceSummary] | None:
        """Return latest stored options snapshot for the given expiry key."""
        conn = self._require_conn()
        async with conn.execute(
            """
            SELECT ts_ms, expiry_key, underlying_price, call_wall, put_wall,
                   max_pain, put_call_ratio, net_gex_usd, strikes_json
            FROM options_snapshots
            WHERE expiry_key = ?
            ORDER BY ts_ms DESC
            LIMIT 1
            """,
            (expiry_key,),
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            return None

        raw_strikes = json.loads(str(row[8]))
        strikes = [StrikeMetrics.model_validate(item) for item in raw_strikes]
        summary = OptionsSurfaceSummary(
            expiry_key=str(row[1]),
            underlying_price=float(row[2]),
            call_wall=float(row[3]),
            call_wall_oi=0.0,
            put_wall=float(row[4]),
            put_wall_oi=0.0,
            max_pain=float(row[5]),
            put_call_ratio=float(row[6]),
            net_gex_usd=float(row[7]),
            top_gex_strikes=strikes,
        )
        return int(row[0]), summary

    async def prune_expired(self, retention_days: int = 14, now_ms: int | None = None) -> int:
        """Delete rows older than retention_days across all Tier-2 tables."""
        conn = self._require_conn()
        ref_ms = now_ms if now_ms is not None else int(time.time() * 1000)
        cutoff_ms = ref_ms - (retention_days * 86_400 * 1000)
        deleted = 0
        for table in ("whale_trades", "liquidations", "options_snapshots"):
            cursor = await conn.execute(f"DELETE FROM {table} WHERE ts_ms < ?", (cutoff_ms,))
            deleted += cursor.rowcount if cursor.rowcount > 0 else 0
        await conn.commit()
        return deleted

    async def ping(self) -> bool:
        """Verify SQLite connection responsiveness."""
        if self._conn is None:
            return False
        async with self._conn.execute("SELECT 1;") as cursor:
            row = await cursor.fetchone()
            return row is not None and row[0] == 1

    async def close(self) -> None:
        """Flush remaining buffered items, stop worker loop, and close SQLite connection."""
        self._closed = True
        self._wake_event.set()
        if self._flush_task is not None:
            self._flush_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._flush_task
            self._flush_task = None
        await self.flush_now()
        if self._conn is not None:
            await self._conn.close()
            self._conn = None
