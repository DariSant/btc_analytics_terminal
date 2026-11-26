"""Tests for async SQLite WAL repository, thresholds, batch flush, and retention."""

import asyncio
from pathlib import Path

from app.db.repository import TerminalRepository
from app.schemas import OptionsSurfaceSummary, RealizedLiquidation, StrikeMetrics, WhalePrint


async def test_wal_mode_and_ping(tmp_path: Path) -> None:
    db_file = tmp_path / "nested" / "terminal.db"
    repo = TerminalRepository(str(db_file), flush_interval_sec=0.05)
    await repo.initialize()
    try:
        assert await repo.get_journal_mode() == "wal"
        assert await repo.ping() is True
    finally:
        await repo.close()


async def test_threshold_filtering_and_batch_queries(tmp_path: Path) -> None:
    db_file = tmp_path / "terminal.db"
    repo = TerminalRepository(str(db_file), flush_interval_sec=0.05, batch_size=50)
    await repo.initialize()
    try:
        base_ms = 1_763_938_800_000
        # Below $250k threshold -> rejected
        small_whale = WhalePrint(
            ts_ms=base_ms,
            venue="binance",
            side="buy",
            price=95_000.0,
            size_btc=1.5,
            notional_usd=142_500.0,
        )
        assert repo.enqueue_whale(small_whale) is False

        small_liq = RealizedLiquidation(
            ts_ms=base_ms,
            venue="bybit",
            side="long_liq",
            price=94_000.0,
            size_btc=0.2,
            notional_usd=18_800.0,
        )
        assert repo.enqueue_liquidation(small_liq) is False

        # Above $250k threshold -> queued & flushed by timer
        w1 = WhalePrint(
            ts_ms=base_ms + 1_000,
            venue="binance",
            side="buy",
            price=95_000.0,
            size_btc=3.0,
            notional_usd=285_000.0,
        )
        w2 = WhalePrint(
            ts_ms=base_ms + 2_000,
            venue="bybit",
            side="sell",
            price=95_100.0,
            size_btc=6.0,
            notional_usd=570_600.0,
        )
        l1 = RealizedLiquidation(
            ts_ms=base_ms + 1_500,
            venue="binance",
            side="long_liq",
            price=94_500.0,
            size_btc=0.5,
            notional_usd=47_250.0,
        )
        assert repo.enqueue_whale(w1) is True
        assert repo.enqueue_whale(w2) is True
        assert repo.enqueue_liquidation(l1) is True

        await asyncio.sleep(0.12)

        whales_all = await repo.get_recent_whales(since_ms=base_ms, min_usd=250_000.0)
        assert whales_all == [w1, w2]

        whales_500k = await repo.get_recent_whales(since_ms=base_ms, min_usd=500_000.0)
        assert whales_500k == [w2]

        liqs = await repo.get_recent_liquidations(since_ms=base_ms)
        assert liqs == [l1]
    finally:
        await repo.close()


async def test_options_snapshot_and_retention_pruning(tmp_path: Path) -> None:
    db_file = tmp_path / "terminal.db"
    repo = TerminalRepository(str(db_file), flush_interval_sec=0.5)
    await repo.initialize()
    try:
        now_ms = 1_764_000_000_000
        old_ms = now_ms - (15 * 86_400 * 1000)
        fresh_ms = now_ms - (2 * 86_400 * 1000)

        repo.enqueue_whale(
            WhalePrint(
                ts_ms=old_ms,
                venue="binance",
                side="buy",
                price=90_000.0,
                size_btc=3.0,
                notional_usd=270_000.0,
            )
        )
        repo.enqueue_whale(
            WhalePrint(
                ts_ms=fresh_ms,
                venue="bybit",
                side="sell",
                price=94_000.0,
                size_btc=3.0,
                notional_usd=282_000.0,
            )
        )
        repo.enqueue_liquidation(
            RealizedLiquidation(
                ts_ms=old_ms,
                venue="binance",
                side="short_liq",
                price=91_000.0,
                size_btc=1.0,
                notional_usd=91_000.0,
            )
        )
        await repo.flush_now()

        old_snap = OptionsSurfaceSummary(
            expiry_key="ALL",
            underlying_price=90_000.0,
            call_wall=95_000.0,
            call_wall_oi=1_000.0,
            put_wall=85_000.0,
            put_wall_oi=900.0,
            max_pain=90_000.0,
            put_call_ratio=0.9,
            net_gex_usd=1_000_000.0,
            top_gex_strikes=[
                StrikeMetrics(strike=95_000.0, call_oi=1_000.0, put_oi=100.0, net_gex_usd=500_000.0)
            ],
        )
        await repo.save_options_snapshot(old_ms, old_snap)

        deleted = await repo.prune_expired(retention_days=14, now_ms=now_ms)
        assert deleted == 3

        whales = await repo.get_recent_whales(since_ms=0)
        assert len(whales) == 1
        assert whales[0].ts_ms == fresh_ms
        assert await repo.get_recent_liquidations(since_ms=0) == []
        assert await repo.get_latest_options_snapshot("ALL") is None

        # High-tier >= $1M whale prints survive 14d standard pruning up to 60d
        mega_mid_ms = now_ms - (30 * 86_400 * 1000)
        mega_ancient_ms = now_ms - (65 * 86_400 * 1000)
        repo.enqueue_whale(
            WhalePrint(
                ts_ms=mega_mid_ms,
                venue="binance",
                side="buy",
                price=92_000.0,
                size_btc=20.0,
                notional_usd=1_840_000.0,
            )
        )
        repo.enqueue_whale(
            WhalePrint(
                ts_ms=mega_ancient_ms,
                venue="bybit",
                side="sell",
                price=88_000.0,
                size_btc=15.0,
                notional_usd=1_320_000.0,
            )
        )
        await repo.flush_now()
        tier_deleted = await repo.prune_expired(retention_days=14, now_ms=now_ms)
        assert tier_deleted == 1
        surviving = await repo.get_recent_whales(since_ms=0)
        assert [w.ts_ms for w in surviving] == [mega_mid_ms, fresh_ms]
    finally:
        await repo.close()
