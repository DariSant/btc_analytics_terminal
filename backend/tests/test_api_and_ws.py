"""Offline integration tests for REST backfill endpoints and multiplexed /ws/btc hub."""

import asyncio
from pathlib import Path
from typing import cast

from fastapi.testclient import TestClient

from app.api.ws_hub import ConnectionManager
from app.config import Settings
from app.db.repository import TerminalRepository
from app.engine.state import MarketState
from app.main import create_app
from app.schemas import (
    CandleBar,
    ExpirySummary,
    HealthResponse,
    KlinesResponse,
    LiquidationBand,
    OptionsResponse,
    OptionsSurfaceSummary,
    OverlaysHistoryResponse,
    RealizedLiquidation,
    StrikeMetrics,
    WhalePrint,
)


def _seed_state() -> MarketState:
    state = MarketState()
    state.binance_ws_connected = True
    state.bybit_ws_connected = True
    state.mark_price = 95_000.0
    state.index_price = 94_980.0
    state.change_24h_pct = 2.5
    state.funding_rate = 0.0001
    state.next_funding_ms = 1_764_144_000_000
    state.binance_oi_usd = 12_000_000_000.0
    state.bybit_oi_usd = 6_000_000_000.0
    state.session_cvd_usd = 45_000_000.0
    state.deribit_last_sync_ms = 1_764_115_200_000

    c_5m = CandleBar(
        time=1_764_115_200,
        open=94_800.0,
        high=95_100.0,
        low=94_750.0,
        close=95_000.0,
        volume_btc=25.0,
        quote_usd=2_375_000.0,
        taker_buy_usd=1_300_000.0,
        is_closed=True,
    )
    state.set_candles("5m", [c_5m])
    state.predicted_liq_bands["5m"] = [
        LiquidationBand(
            anchor_time=1_764_115_200,
            price=93_500.0,
            side="long_liq",
            leverage=50,
            intensity=0.8,
        )
    ]

    expiry = ExpirySummary(
        expiry_key="2026-12-27",
        expiry_ts_ms=1_798_358_400_000,
        total_oi_btc=1_500.0,
        oi_share_pct=100.0,
    )
    surface = OptionsSurfaceSummary(
        expiry_key="ALL",
        underlying_price=95_000.0,
        call_wall=100_000.0,
        call_wall_oi=1_000.0,
        put_wall=90_000.0,
        put_wall_oi=500.0,
        max_pain=95_000.0,
        put_call_ratio=0.5,
        net_gex_usd=4_500_000.0,
        top_gex_strikes=[
            StrikeMetrics(
                strike=100_000.0,
                call_oi=1_000.0,
                put_oi=50.0,
                net_gex_usd=3_000_000.0,
            )
        ],
    )
    state.update_options([expiry], {"ALL": surface, "2026-12-27": surface}, 1_764_115_200_000)
    return state


def test_rest_endpoints_conform_to_schemas(tmp_path: Path) -> None:
    state = _seed_state()
    repo = TerminalRepository(str(tmp_path / "api.db"), flush_interval_sec=0.5)
    app = create_app(
        settings=Settings(SQLITE_PATH=str(tmp_path / "api.db")),
        enable_live_connectors=False,
        initial_state=state,
        repository=repo,
    )

    with TestClient(app) as client:
        # Seed SQLite history cleanly via running event loop helper
        whale = WhalePrint(
            ts_ms=1_764_115_205_000,
            venue="binance",
            side="buy",
            price=95_010.0,
            size_btc=3.0,
            notional_usd=285_030.0,
        )
        liq = RealizedLiquidation(
            ts_ms=1_764_115_206_000,
            venue="bybit",
            side="short_liq",
            price=95_100.0,
            size_btc=1.0,
            notional_usd=95_100.0,
        )
        repo.enqueue_whale(whale)
        repo.enqueue_liquidation(liq)
        client.portal.call(repo.flush_now)

        health_res = client.get("/api/v1/health")
        assert health_res.status_code == 200
        health = HealthResponse.model_validate(health_res.json())
        assert health.status == "ok" and health.sqlite_ok is True

        klines_res = client.get("/api/v1/klines?interval=5m&limit=100")
        assert klines_res.status_code == 200
        klines = KlinesResponse.model_validate(klines_res.json())
        assert len(klines.candles) == 1
        assert len(klines.predicted_liquidations) == 1

        overlays_res = client.get("/api/v1/overlays/history?since_ms=0&min_whale_usd=100000")
        assert overlays_res.status_code == 200
        overlays = OverlaysHistoryResponse.model_validate(overlays_res.json())
        assert overlays.whales == [whale]
        assert overlays.liquidations == [liq]

        opt_res = client.get("/api/v1/options?expiry=ALL")
        assert opt_res.status_code == 200
        opts = OptionsResponse.model_validate(opt_res.json())
        assert opts.summary.call_wall == 100_000.0


def test_ws_btc_set_timeframe_routing_and_closed_candle_flush(tmp_path: Path) -> None:
    state = _seed_state()
    app = create_app(
        settings=Settings(SQLITE_PATH=str(tmp_path / "ws.db")),
        enable_live_connectors=False,
        initial_state=state,
    )

    with TestClient(app) as client:
        ws_hub = cast(ConnectionManager, app.state.ws_hub)
        with client.websocket_connect("/ws/btc") as ws:
            # Switch subscription from default "5m" to "15m"
            ws.send_json({"type": "set_timeframe", "interval": "15m"})
            # Wait briefly for receive loop to process frame
            client.portal.call(asyncio.sleep, 0.05)
            assert ws_hub.client_count == 1

            # Emit a "1m" kline -> MUST NOT arrive on "15m"-subscribed client
            c_1m = CandleBar(
                time=1_764_115_260,
                open=95_000.0,
                high=95_020.0,
                low=94_990.0,
                close=95_010.0,
                volume_btc=2.0,
                quote_usd=190_000.0,
                taker_buy_usd=100_000.0,
                is_closed=True,
            )
            client.portal.call(ws_hub.publish_kline, "1m", c_1m)

            # Emit a "15m" closed kline -> MUST arrive immediately
            c_15m = CandleBar(
                time=1_764_115_200,
                open=94_900.0,
                high=95_100.0,
                low=94_850.0,
                close=95_050.0,
                volume_btc=12.0,
                quote_usd=1_140_000.0,
                taker_buy_usd=650_000.0,
                is_closed=True,
            )
            client.portal.call(ws_hub.publish_kline, "15m", c_15m)
            msg_kline = ws.receive_json()
            assert msg_kline["type"] == "kline"
            assert msg_kline["interval"] == "15m"
            assert msg_kline["candle"]["close"] == 95_050.0

            # Global whale & telemetry events still arrive regardless of interval
            whale = WhalePrint(
                ts_ms=1_764_115_210_000,
                venue="binance",
                side="buy",
                price=95_050.0,
                size_btc=2.5,
                notional_usd=237_625.0,
            )
            client.portal.call(ws_hub.broadcast_whale, whale)
            msg_whale = ws.receive_json()
            assert msg_whale["type"] == "whale"
            assert msg_whale["data"]["notional_usd"] == 237_625.0

            client.portal.call(ws_hub.broadcast_telemetry, state.to_header_telemetry())
            msg_tel = ws.receive_json()
            assert msg_tel["type"] == "telemetry"
            assert msg_tel["data"]["mark_price"] == 95_000.0
