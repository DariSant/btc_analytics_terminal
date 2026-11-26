"""FastAPI application factory, lifespan orchestrator, and CORS configuration."""

import asyncio
import contextlib
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.ws_hub import ConnectionManager
from app.config import Settings, get_settings
from app.connectors.binance import BinanceConnector
from app.connectors.bybit import BybitConnector
from app.connectors.deribit import DeribitOptionsPoller
from app.db.repository import TerminalRepository
from app.engine.state import MarketState
from app.engine.whale_aggregator import WhaleBurstAggregator
from app.schemas import RealizedLiquidation, WhalePrint

logger = logging.getLogger(__name__)


async def _telemetry_loop(state: MarketState, ws_hub: ConnectionManager) -> None:
    try:
        while True:
            await asyncio.sleep(1.0)
            await ws_hub.broadcast_telemetry(state.to_header_telemetry())
    except asyncio.CancelledError:
        return


async def _retention_loop(repo: TerminalRepository, retention_days: int) -> None:
    try:
        while True:
            await asyncio.sleep(3600.0)
            deleted = await repo.prune_expired(retention_days=retention_days)
            if deleted > 0:
                logger.info("Pruned %d expired SQLite rows (>%dd)", deleted, retention_days)
    except asyncio.CancelledError:
        return


def create_app(
    settings: Settings | None = None,
    enable_live_connectors: bool = True,
    initial_state: MarketState | None = None,
    repository: TerminalRepository | None = None,
) -> FastAPI:
    """Construct configured FastAPI ASGI app with isolated test support."""
    cfg = settings or get_settings()
    state = initial_state or MarketState()
    ws_hub = ConnectionManager()
    repo = repository or TerminalRepository(
        db_path=cfg.SQLITE_PATH,
        whale_min_usd=cfg.WHALE_MIN_USD,
        liq_min_usd=cfg.LIQ_MIN_USD,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.started_at = time.monotonic()
        app.state.terminal_state = state
        app.state.repository = repo
        app.state.ws_hub = ws_hub

        await repo.initialize()

        async def handle_whale(whale: WhalePrint) -> None:
            repo.enqueue_whale(whale)
            await ws_hub.broadcast_whale(whale)

        async def handle_liquidation(liq: RealizedLiquidation) -> None:
            await ws_hub.broadcast_liquidation(liq)

        state.on_kline = ws_hub.publish_kline
        state.on_whale = handle_whale
        state.on_liquidation = handle_liquidation
        state.on_liq_bands = ws_hub.broadcast_liq_bands
        state.on_options_update = ws_hub.broadcast_options

        whale_agg = WhaleBurstAggregator(min_notional_usd=cfg.WHALE_MIN_USD, on_emit=handle_whale)
        http_client: httpx.AsyncClient | None = None
        binance: BinanceConnector | None = None
        bybit: BybitConnector | None = None
        deribit: DeribitOptionsPoller | None = None
        telemetry_task: asyncio.Task[None] | None = None
        retention_task: asyncio.Task[None] | None = None

        if enable_live_connectors:
            http_client = httpx.AsyncClient(timeout=15.0)
            bybit = BybitConnector(
                rest_url=cfg.BYBIT_REST_URL,
                ws_url=cfg.BYBIT_WS_URL,
                state=state,
                whale_aggregator=whale_agg,
                repository=repo,
                liq_min_usd=cfg.LIQ_MIN_USD,
            )
            binance = BinanceConnector(
                rest_url=cfg.BINANCE_REST_URL,
                ws_url=cfg.BINANCE_WS_URL,
                state=state,
                whale_aggregator=whale_agg,
                repository=repo,
                liq_min_usd=cfg.LIQ_MIN_USD,
            )
            deribit = DeribitOptionsPoller(
                rest_url=cfg.DERIBIT_REST_URL,
                state=state,
                repository=repo,
                client=http_client,
            )
            with contextlib.suppress(Exception):
                await binance.backfill_all(http_client, bybit_fallback=bybit)
            with contextlib.suppress(Exception):
                await deribit.poll_once()

            binance.start()
            bybit.start()
            deribit.start()
            telemetry_task = asyncio.create_task(_telemetry_loop(state, ws_hub))
            retention_task = asyncio.create_task(_retention_loop(repo, cfg.RETENTION_DAYS))

        try:
            yield
        finally:
            for task in (telemetry_task, retention_task):
                if task is not None and not task.done():
                    task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await task
            if deribit is not None:
                await deribit.stop()
            if binance is not None:
                await binance.stop()
            if bybit is not None:
                await bybit.stop()
            await whale_agg.close()
            if http_client is not None:
                await http_client.aclose()
            await ws_hub.close()
            await repo.close()

    application = FastAPI(
        title="BTC Analytics Terminal API",
        version="0.1.0",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["*"],
    )
    application.include_router(router)
    return application


app = create_app()
