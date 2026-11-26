"""FastAPI REST backfill routes and /ws/btc WebSocket endpoint."""

import time
from typing import Annotated, cast

from fastapi import APIRouter, Query, Request, WebSocket, WebSocketDisconnect

from app.api.ws_hub import ConnectionManager
from app.db.repository import TerminalRepository
from app.engine.state import MarketState
from app.schemas import (
    HealthResponse,
    KlinesResponse,
    OptionsResponse,
    OptionsSurfaceSummary,
    OverlaysHistoryResponse,
    TimeframeLiteral,
)

router = APIRouter()


def _get_state(request: Request) -> MarketState:
    return cast(MarketState, request.app.state.terminal_state)


def _get_repo(request: Request) -> TerminalRepository:
    return cast(TerminalRepository, request.app.state.repository)


def _get_started_at(request: Request) -> float:
    return float(request.app.state.started_at)


@router.get("/api/v1/health", response_model=HealthResponse)
async def get_health(request: Request) -> HealthResponse:
    """Return service health, connector status, and SQLite responsiveness."""
    state = _get_state(request)
    repo = _get_repo(request)
    sqlite_ok = await repo.ping()
    uptime_sec = round(max(0.0, time.monotonic() - _get_started_at(request)), 2)
    return HealthResponse(
        status="ok" if sqlite_ok else "degraded",
        uptime_sec=uptime_sec,
        binance_ws=state.binance_ws_connected,
        bybit_ws=state.bybit_ws_connected,
        deribit_last_sync_ms=state.deribit_last_sync_ms,
        sqlite_ok=sqlite_ok,
    )


@router.get("/api/v1/klines", response_model=KlinesResponse)
async def get_klines(
    request: Request,
    interval: Annotated[TimeframeLiteral, Query()] = "5m",
    limit: Annotated[int, Query(ge=1, le=1500)] = 1500,
) -> KlinesResponse:
    """Return historical candles and surviving predictive liquidation bands for interval."""
    state = _get_state(request)
    candles = state.get_candles(interval, limit=limit)
    bands = state.predicted_liq_bands.get(interval, [])
    return KlinesResponse(
        interval=interval,
        candles=candles,
        predicted_liquidations=bands,
    )


@router.get("/api/v1/overlays/history", response_model=OverlaysHistoryResponse)
async def get_overlays_history(
    request: Request,
    since_ms: Annotated[int | None, Query(ge=0)] = None,
    min_whale_usd: Annotated[float, Query(ge=0.0)] = 250_000.0,
) -> OverlaysHistoryResponse:
    """Return persisted Tier-2 whale prints and realized liquidations since timestamp."""
    repo = _get_repo(request)
    ref_since = since_ms if since_ms is not None else int(time.time() * 1000) - 86_400_000
    whales = await repo.get_recent_whales(since_ms=ref_since, min_usd=min_whale_usd)
    liquidations = await repo.get_recent_liquidations(since_ms=ref_since)
    return OverlaysHistoryResponse(whales=whales, liquidations=liquidations)


@router.get("/api/v1/options", response_model=OptionsResponse)
async def get_options(
    request: Request,
    expiry: Annotated[str, Query()] = "ALL",
) -> OptionsResponse:
    """Return Deribit BTC options surface summary and active expiry breakdown."""
    state = _get_state(request)
    summary = state.surfaces_by_expiry.get(expiry) or state.surfaces_by_expiry.get("ALL")
    selected = expiry if expiry in state.surfaces_by_expiry else "ALL"
    if summary is None:
        summary = OptionsSurfaceSummary(
            expiry_key=selected,
            underlying_price=state.mark_price if state.mark_price > 0.0 else 1.0,
            call_wall=0.0,
            call_wall_oi=0.0,
            put_wall=0.0,
            put_wall_oi=0.0,
            max_pain=0.0,
            put_call_ratio=0.0,
            net_gex_usd=0.0,
            top_gex_strikes=[],
        )
    return OptionsResponse(
        selected_expiry=selected,
        available_expiries=state.available_expiries,
        summary=summary,
    )


@router.websocket("/ws/btc")
async def websocket_btc(websocket: WebSocket) -> None:
    """Multiplexed real-time terminal stream supporting set_timeframe commands."""
    ws_hub = cast(ConnectionManager, websocket.app.state.ws_hub)
    await ws_hub.connect(websocket)
    try:
        while True:
            raw_text = await websocket.receive_text()
            ws_hub.handle_client_text(websocket, raw_text)
    except WebSocketDisconnect:
        pass
    finally:
        ws_hub.disconnect(websocket)
