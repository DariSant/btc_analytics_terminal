"""Self-contained full-stack REST + /ws/btc smoke harness (zero orphan processes)."""

from __future__ import annotations

import asyncio
import sys
import tempfile
import time
from pathlib import Path
from typing import cast

from fastapi.testclient import TestClient


def run_smoke() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    backend_dir = repo_root / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    from app.api.ws_hub import ConnectionManager
    from app.config import Settings
    from app.db.repository import TerminalRepository
    from app.engine.state import MarketState
    from app.main import create_app
    from app.schemas import (
        WS_SERVER_EVENT_ADAPTER,
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

    started = time.perf_counter()
    state = MarketState()
    state.binance_ws_connected = True
    state.bybit_ws_connected = True
    state.mark_price = 95_250.0
    state.index_price = 95_220.0
    state.change_24h_pct = 1.84
    state.funding_rate = 0.0001
    state.next_funding_ms = 1_764_144_000_000
    state.binance_oi_usd = 12_400_000_000.0
    state.bybit_oi_usd = 6_200_000_000.0
    state.session_cvd_usd = 52_500_000.0
    state.deribit_last_sync_ms = 1_764_115_200_000

    base_5m = CandleBar(
        time=1_764_115_200,
        open=94_900.0,
        high=95_300.0,
        low=94_850.0,
        close=95_250.0,
        volume_btc=32.5,
        quote_usd=3_095_625.0,
        taker_buy_usd=1_750_000.0,
        is_closed=True,
    )
    state.set_candles("5m", [base_5m])
    state.predicted_liq_bands["5m"] = [
        LiquidationBand(
            anchor_time=1_764_115_200,
            price=93_400.0,
            side="long_liq",
            leverage=50,
            intensity=0.85,
        )
    ]

    expiry = ExpirySummary(
        expiry_key="2026-12-27",
        expiry_ts_ms=1_798_358_400_000,
        total_oi_btc=2_400.0,
        oi_share_pct=100.0,
    )
    surface = OptionsSurfaceSummary(
        expiry_key="ALL",
        underlying_price=95_250.0,
        call_wall=100_000.0,
        call_wall_oi=1_500.0,
        put_wall=90_000.0,
        put_wall_oi=900.0,
        max_pain=95_000.0,
        put_call_ratio=0.6,
        net_gex_usd=5_200_000.0,
        top_gex_strikes=[
            StrikeMetrics(
                strike=100_000.0,
                call_oi=1_500.0,
                put_oi=120.0,
                net_gex_usd=3_400_000.0,
            )
        ],
    )
    state.update_options([expiry], {"ALL": surface, "2026-12-27": surface}, 1_764_115_200_000)

    with tempfile.TemporaryDirectory(prefix="btc_terminal_smoke_") as tmp_dir:
        db_path = Path(tmp_dir) / "smoke.db"
        repo = TerminalRepository(str(db_path), flush_interval_sec=0.5)
        app = create_app(
            settings=Settings(SQLITE_PATH=str(db_path)),
            enable_live_connectors=False,
            initial_state=state,
            repository=repo,
        )

        with TestClient(app) as client:
            portal = client.portal
            assert portal is not None

            whale = WhalePrint(
                ts_ms=1_764_115_210_000,
                venue="binance",
                side="buy",
                price=95_260.0,
                size_btc=4.0,
                notional_usd=381_040.0,
            )
            liq = RealizedLiquidation(
                ts_ms=1_764_115_215_000,
                venue="bybit",
                side="short_liq",
                price=95_320.0,
                size_btc=1.2,
                notional_usd=114_384.0,
            )
            repo.enqueue_whale(whale)
            repo.enqueue_liquidation(liq)
            portal.call(repo.flush_now)

            health = HealthResponse.model_validate(client.get("/api/v1/health").json())
            assert health.status == "ok" and health.sqlite_ok is True

            klines = KlinesResponse.model_validate(
                client.get("/api/v1/klines?interval=5m&limit=100").json()
            )
            assert klines.interval == "5m" and len(klines.candles) == 1
            assert len(klines.predicted_liquidations) == 1

            options = OptionsResponse.model_validate(
                client.get("/api/v1/options?expiry=ALL").json()
            )
            assert options.summary.call_wall == 100_000.0

            history = OverlaysHistoryResponse.model_validate(
                client.get("/api/v1/overlays/history?since_ms=0&min_whale_usd=250000").json()
            )
            assert history.whales == [whale]
            assert history.liquidations == [liq]

            ws_hub = cast(ConnectionManager, app.state.ws_hub)
            with client.websocket_connect("/ws/btc") as ws:
                ws.send_json({"type": "set_timeframe", "interval": "15m"})
                portal.call(asyncio.sleep, 0.05)

                portal.call(
                    ws_hub.publish_kline,
                    "1m",
                    CandleBar(
                        time=1_764_115_260,
                        open=95_200.0,
                        high=95_240.0,
                        low=95_190.0,
                        close=95_210.0,
                        volume_btc=1.5,
                        quote_usd=142_815.0,
                        taker_buy_usd=80_000.0,
                        is_closed=True,
                    ),
                )

                portal.call(
                    ws_hub.publish_kline,
                    "15m",
                    CandleBar(
                        time=1_764_115_200,
                        open=94_900.0,
                        high=95_350.0,
                        low=94_850.0,
                        close=95_300.0,
                        volume_btc=45.0,
                        quote_usd=4_288_500.0,
                        taker_buy_usd=2_400_000.0,
                        is_closed=True,
                    ),
                )
                kline_evt = WS_SERVER_EVENT_ADAPTER.validate_python(ws.receive_json())
                assert kline_evt.type == "kline" and kline_evt.interval == "15m"

                portal.call(ws_hub.broadcast_telemetry, state.to_header_telemetry())
                tel_evt = WS_SERVER_EVENT_ADAPTER.validate_python(ws.receive_json())
                assert tel_evt.type == "telemetry" and tel_evt.data.mark_price == 95_250.0

                portal.call(ws_hub.broadcast_whale, whale)
                whale_evt = WS_SERVER_EVENT_ADAPTER.validate_python(ws.receive_json())
                assert whale_evt.type == "whale"

                portal.call(ws_hub.broadcast_liquidation, liq)
                liq_evt = WS_SERVER_EVENT_ADAPTER.validate_python(ws.receive_json())
                assert liq_evt.type == "liquidation"

    elapsed = time.perf_counter() - started
    print(f"[SMOKE E2E] PASS: REST + /ws/btc contracts verified in {elapsed:.2f}s")


if __name__ == "__main__":
    run_smoke()
