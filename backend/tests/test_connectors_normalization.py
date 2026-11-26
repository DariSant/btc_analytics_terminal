"""Tests for Binance/Bybit normalization, 100ms whale VWAP, CVD backfill, and HTTP 451 fallback."""

import asyncio
from datetime import UTC, date, datetime
from pathlib import Path

import httpx

from app.connectors.binance import (
    BinanceConnector,
    compute_cvd_from_klines,
    parse_binance_agg_trade,
    parse_binance_force_order,
    parse_binance_ws_kline,
)
from app.connectors.bybit import (
    BybitConnector,
    parse_bybit_liquidations,
    parse_bybit_public_trade,
    parse_bybit_rest_klines,
)
from app.connectors.deribit import DeribitOptionsPoller
from app.db.repository import TerminalRepository
from app.engine.state import TIMEFRAMES, MarketState
from app.engine.whale_aggregator import WhaleBurstAggregator
from app.schemas import ExpirySummary, OptionsSurfaceSummary, WhalePrint


def test_trade_and_liquidation_side_polarity_parity() -> None:
    # Binance aggTrade: m=False -> aggressive buy; m=True -> aggressive sell
    b_buy = parse_binance_agg_trade({"m": False, "p": "95000.0", "q": "1.2", "T": 1763938810000})
    b_sell = parse_binance_agg_trade({"m": True, "p": "95010.0", "q": "0.8", "T": 1763938810100})
    assert b_buy[0] == "buy"
    assert b_sell[0] == "sell"

    # Bybit publicTrade
    y_buy = parse_bybit_public_trade({"S": "Buy", "p": "95000.0", "v": "1.2", "T": 1763938810000})
    y_sell = parse_bybit_public_trade(
        {"S": "Sell", "p": "95010.0", "v": "0.8", "T": 1763938810100}
    )
    assert y_buy[0] == "buy"
    assert y_sell[0] == "sell"

    # Binance forceOrder: S=SELL closes long -> long_liq; S=BUY closes short -> short_liq
    b_long_liq = parse_binance_force_order(
        {
            "e": "forceOrder",
            "o": {
                "s": "BTCUSDT",
                "S": "SELL",
                "st": 1,
                "p": "94180.0",
                "ap": "94210.5",
                "q": "1.25",
                "T": 1763938813100,
            },
        }
    )
    b_short_liq = parse_binance_force_order(
        {
            "e": "forceOrder",
            "o": {
                "s": "BTCUSDT",
                "S": "BUY",
                "p": "95200.0",
                "ap": "0",
                "q": "1.0",
                "T": 1763938813200,
            },
        }
    )
    assert b_long_liq is not None and b_long_liq.side == "long_liq"
    assert b_long_liq.price == 94210.5
    assert b_short_liq is not None and b_short_liq.side == "short_liq"
    assert b_short_liq.price == 95200.0

    # Non-USDT settled contract (st != 1) ignored
    assert (
        parse_binance_force_order(
            {
                "o": {
                    "s": "BTCUSDT",
                    "S": "SELL",
                    "st": 2,
                    "p": "94000.0",
                    "q": "1.0",
                    "T": 1763938813300,
                }
            }
        )
        is None
    )

    # Bybit allLiquidation INVERTED semantics (S=Buy -> long_liq, S=Sell -> short_liq), list & dict
    y_list = parse_bybit_liquidations(
        {
            "topic": "allLiquidation.BTCUSDT",
            "data": [
                {"T": 1763938813100, "s": "BTCUSDT", "S": "Buy", "v": "0.85", "p": "94100.0"},
                {"T": 1763938813200, "s": "BTCUSDT", "S": "Sell", "v": "1.10", "p": "95100.0"},
            ],
        }
    )
    assert len(y_list) == 2
    assert y_list[0].side == "long_liq"
    assert y_list[1].side == "short_liq"

    y_single = parse_bybit_liquidations(
        {
            "topic": "allLiquidation.BTCUSDT",
            "data": {"T": 1763938813300, "s": "BTCUSDT", "S": "Buy", "v": "0.5", "p": "94000.0"},
        }
    )
    assert len(y_single) == 1 and y_single[0].side == "long_liq"


def test_bybit_descending_kline_sort_and_binance_ws_kline() -> None:
    # Bybit returns newest-first; parser must output ascending UTC seconds.
    raw_bybit = [
        ["1763939100000", "94200", "94300", "94100", "94250", "10.0", "942500.0"],
        ["1763938800000", "94000", "94220", "93950", "94200", "12.0", "1130400.0"],
    ]
    bars = parse_bybit_rest_klines(raw_bybit)
    assert [b.time for b in bars] == [1763938800, 1763939100]
    assert bars[0].taker_buy_usd == round(1130400.0 * 0.55, 2)

    parsed = parse_binance_ws_kline(
        {
            "k": {
                "t": 1763938800000,
                "i": "5m",
                "o": "94000.0",
                "h": "94100.0",
                "l": "93900.0",
                "c": "94050.0",
                "v": "15.0",
                "q": "1410750.0",
                "Q": "800000.0",
                "x": False,
            }
        }
    )
    assert parsed is not None
    tf, bar = parsed
    assert tf == "5m"
    assert bar.time == 1763938800
    assert bar.is_closed is False


async def test_whale_burst_aggregator_vwap_and_venue_isolation() -> None:
    emitted: list[WhalePrint] = []

    async def on_emit(wp: WhalePrint) -> None:
        emitted.append(wp)

    agg = WhaleBurstAggregator(min_notional_usd=100_000.0, on_emit=on_emit)
    try:
        base_ms = 1_763_938_800_000
        # Two Binance buys within 50ms -> single VWAP print (>= $100k)
        await agg.ingest_trade("binance", "buy", 90_000.0, 1.0, base_ms)
        await agg.ingest_trade("binance", "buy", 92_000.0, 1.0, base_ms + 50)
        # Concurrent Bybit sell does not flush Binance bucket prematurely
        await agg.ingest_trade("bybit", "sell", 91_000.0, 0.5, base_ms + 60)

        # Wait past 120ms async timer flush
        await asyncio.sleep(0.18)

        # Binance bucket ($182k) emits; Bybit bucket ($45.5k) is below $100k threshold
        assert len(emitted) == 1
        assert emitted[0].venue == "binance"
        assert emitted[0].side == "buy"
        assert emitted[0].price == 91_000.0
        assert emitted[0].size_btc == 2.0
        assert emitted[0].notional_usd == 182_000.0

        # Side flip flushes prior >= $100k bucket immediately
        await agg.ingest_trade("bybit", "buy", 95_000.0, 1.5, base_ms + 500)
        await agg.ingest_trade("bybit", "sell", 95_100.0, 0.1, base_ms + 510)
        assert len(emitted) == 2
        assert emitted[1].venue == "bybit"
        assert emitted[1].side == "buy"
    finally:
        await agg.close()


async def test_session_cvd_single_source_and_midnight_rollover() -> None:
    d1 = date(2026, 11, 26)
    state = MarketState(initial_utc_date=d1)
    # Historical formula check: (2 * 600_000 - 1_000_000) + (2 * 300_000 - 800_000) = 0
    cvd_init = compute_cvd_from_klines(
        [
            [1764115200000, "94000", "94100", "93900", "94050", "10", 0, "1000000", 0, 0, "600000"],
            [1764115260000, "94050", "94060", "93950", "93980", "8", 0, "800000", 0, 0, "300000"],
        ]
    )
    assert cvd_init == 0.0
    state.seed_session_cvd(cvd_init, d1)

    ts_same_day = int(datetime(2026, 11, 26, 12, 0, 0, tzinfo=UTC).timestamp() * 1000)
    state.binance_ws_connected = True
    # Bybit ignored while Binance WS is connected
    state.record_trade_for_cvd("bybit", "buy", 95_000.0, 1.0, ts_same_day)
    assert state.session_cvd_usd == 0.0

    # Binance counted
    state.record_trade_for_cvd("binance", "buy", 95_000.0, 2.0, ts_same_day)
    assert state.session_cvd_usd == 190_000.0

    # Failover to Bybit when Binance WS disconnects
    state.binance_ws_connected = False
    state.record_trade_for_cvd("bybit", "sell", 95_000.0, 1.0, ts_same_day + 1000)
    assert state.session_cvd_usd == 95_000.0

    # Midnight UTC rollover resets cumulative delta before applying new day's trade
    ts_next_day = int(datetime(2026, 11, 27, 0, 0, 5, tzinfo=UTC).timestamp() * 1000)
    state.record_trade_for_cvd("bybit", "buy", 96_000.0, 1.0, ts_next_day)
    assert state.session_cvd_usd == 96_000.0


async def test_binance_backfill_and_http_451_fallback() -> None:
    # 1) Happy path mocked transport
    def happy_handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/fapi/v1/klines":
            interval = request.url.params.get("interval")
            if interval == "1m" and "startTime" in request.url.params:
                return httpx.Response(
                    200,
                    json=[
                        [
                            1764115200000,
                            "94000",
                            "94100",
                            "93900",
                            "94050",
                            "10",
                            0,
                            "1000000",
                            0,
                            0,
                            "650000",
                        ]
                    ],
                )
            return httpx.Response(
                200,
                json=[
                    [
                        1764115200000,
                        "94000",
                        "94100",
                        "93900",
                        "94050",
                        "10",
                        0,
                        "1000000",
                        0,
                        0,
                        "650000",
                    ]
                ],
            )
        if path == "/fapi/v1/premiumIndex":
            return httpx.Response(
                200,
                json={
                    "markPrice": "94100.5",
                    "indexPrice": "94090.0",
                    "lastFundingRate": "0.0001",
                    "nextFundingTime": 1764144000000,
                },
            )
        if path == "/fapi/v1/ticker/24hr":
            return httpx.Response(200, json={"priceChangePercent": "2.35"})
        if path == "/futures/data/openInterestHist":
            return httpx.Response(
                200,
                json=[
                    {"sumOpenInterestValue": "10000000000"},
                    {"sumOpenInterestValue": "10500000000"},
                ],
            )
        if path == "/v5/market/tickers":
            return httpx.Response(
                200,
                json={"result": {"list": [{"openInterestValue": "5000000000"}]}},
            )
        return httpx.Response(404)

    state_ok = MarketState()
    agg_ok = WhaleBurstAggregator(100_000.0, lambda _: asyncio.sleep(0))
    bybit_ok = BybitConnector(
        "https://api.bybit.com",
        "wss://stream.bybit.com/v5/public/linear",
        state_ok,
        agg_ok,
    )
    binance_ok = BinanceConnector(
        "https://fapi.binance.com",
        "wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade",
        state_ok,
        agg_ok,
    )
    ref_now = datetime(2026, 11, 26, 12, 0, tzinfo=UTC)
    async with httpx.AsyncClient(transport=httpx.MockTransport(happy_handler)) as client:
        await binance_ok.backfill_all(client, bybit_fallback=bybit_ok, now_utc=ref_now)
    await agg_ok.close()

    assert state_ok.binance_available is True
    for tf in TIMEFRAMES:
        assert len(state_ok.get_candles(tf)) == 1
    assert state_ok.open_interest_usd == 15_500_000_000.0
    assert state_ok.oi_change_24h_pct == 5.0
    assert state_ok.session_cvd_usd == 300_000.0  # 2 * 650k - 1000k

    # 2) HTTP 451 fallback path -> delegates cleanly to Bybit
    def geo_blocked_handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "fapi.binance.com":
            return httpx.Response(451, json={"msg": "Restricted location"})
        if request.url.path == "/v5/market/tickers":
            return httpx.Response(
                200,
                json={
                    "result": {
                        "list": [
                            {
                                "openInterestValue": "6000000000",
                                "markPrice": "94500.0",
                                "indexPrice": "94490.0",
                                "fundingRate": "0.00015",
                                "nextFundingTime": "1764144000000",
                                "price24hPcnt": "0.031",
                            }
                        ]
                    }
                },
            )
        if request.url.path == "/v5/market/kline":
            return httpx.Response(
                200,
                json={
                    "result": {
                        "list": [
                            ["1763939100000", "94200", "94300", "94100", "94250", "10", "942500"],
                            ["1763938800000", "94000", "94220", "93950", "94200", "12", "1130400"],
                        ]
                    }
                },
            )
        return httpx.Response(404)

    state_fb = MarketState()
    agg_fb = WhaleBurstAggregator(100_000.0, lambda _: asyncio.sleep(0))
    bybit_fb = BybitConnector(
        "https://api.bybit.com",
        "wss://stream.bybit.com/v5/public/linear",
        state_fb,
        agg_fb,
    )
    binance_fb = BinanceConnector(
        "https://fapi.binance.com",
        "wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade",
        state_fb,
        agg_fb,
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(geo_blocked_handler)) as client:
        await binance_fb.backfill_all(client, bybit_fallback=bybit_fb, now_utc=ref_now)
    await agg_fb.close()

    assert state_fb.binance_available is False
    assert state_fb.mark_price == 94_500.0
    assert round(state_fb.change_24h_pct, 2) == 3.10
    assert [c.time for c in state_fb.get_candles("5m")] == [1763938800, 1763939100]


async def test_deribit_poller_snapshot_and_timeout_recovery(tmp_path: Path) -> None:
    calls = 0

    def deribit_handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise httpx.ReadTimeout("Simulated Deribit timeout", request=request)
        return httpx.Response(
            200,
            json={
                "jsonrpc": "2.0",
                "result": [
                    {
                        "instrument_name": "BTC-27NOV26-100000-C",
                        "open_interest": 1200.0,
                        "mark_iv": 55.0,
                        "underlying_price": 95_000.0,
                    },
                    {
                        "instrument_name": "BTC-27NOV26-90000-P",
                        "open_interest": 900.0,
                        "mark_iv": 58.0,
                        "underlying_price": 95_000.0,
                    },
                    {
                        "instrument_name": "BTC-27NOV26-90000-100000-C",
                        "open_interest": 5000.0,
                        "mark_iv": 50.0,
                        "underlying_price": 95_000.0,
                    },
                ],
            },
        )

    repo = TerminalRepository(str(tmp_path / "deribit.db"), flush_interval_sec=0.5)
    await repo.initialize()
    state = MarketState()
    broadcasts: list[tuple[list[ExpirySummary], dict[str, OptionsSurfaceSummary]]] = []

    async def on_opt(
        expiries: list[ExpirySummary],
        surfaces: dict[str, OptionsSurfaceSummary],
    ) -> None:
        broadcasts.append((expiries, surfaces))

    state.on_options_update = on_opt
    now_sec = datetime(2026, 11, 26, 12, 0, tzinfo=UTC).timestamp()

    try:
        async with httpx.AsyncClient(transport=httpx.MockTransport(deribit_handler)) as client:
            poller = DeribitOptionsPoller(
                rest_url="https://www.deribit.com/api/v2",
                state=state,
                repository=repo,
                client=client,
            )
            # First call times out gracefully without raising
            assert await poller.poll_once(now_sec=now_sec) is False
            assert state.deribit_last_sync_ms is None

            # Second call succeeds, updates MarketState, fires callback, and saves 30m snapshot
            assert await poller.poll_once(now_sec=now_sec + 5.0) is True
            await poller.stop()

        assert state.deribit_last_sync_ms == int((now_sec + 5.0) * 1000)
        assert "ALL" in state.surfaces_by_expiry
        assert state.surfaces_by_expiry["ALL"].call_wall == 100_000.0
        assert len(broadcasts) == 1
        saved = await repo.get_latest_options_snapshot("ALL")
        assert saved is not None
        assert saved[1].call_wall == 100_000.0
    finally:
        await repo.close()
