# BTC Derivatives & Order-Flow Analytics Terminal

A single-page, real-time Bitcoin (`BTCUSDT` perpetuals on Binance Futures and Bybit V5; `BTC` options on Deribit) market-structure and order-flow analytics terminal powered exclusively by free public exchange APIs.

## Architecture Overview

- **Backend:** Python 3.12, FastAPI, multiplexed WebSockets (`/ws/btc`), and SQLite (`aiosqlite` in WAL mode with `14d` default retention and `60d` retention for `>= $1M` whale prints)
- **Quant & Derivatives:** Analytical Black-76 Gamma / Dealer Net GEX (`+Call / -Put`), Call/Put Walls, Max Pain, OI-weighted swing liquidation projections with sweep mitigation, per-venue `100ms` whale burst aggregation, and `00:00 UTC` session CVD
- **Frontend:** React 19 SPA (`100vh × 100vw` viewport lock, `40px` header, `260px` drawer, 4 themes) with TradingView Lightweight Charts `5.3.0` and custom Canvas 2D `ISeriesPrimitive` overlays (`VRVPPrimitive`, `WhaleBubblesPrimitive`, `LiquidationPrimitive`, `OptionsWallsPrimitive`) + collapsible `LegendDrawer` & `GuideDrawer`
- **Deployment:** Docker + Fly.io (`fra` Frankfurt, persistent `/data` SQLite volume) for backend; Netlify static SPA hosting for frontend

---

## Local Development

### 1. Backend (FastAPI + SQLite WAL)

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS / Linux:      source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Verify health at `http://127.0.0.1:8000/api/v1/health`.

### 2. Frontend (React + Vite + Lightweight Charts v5)

```bash
cd frontend
npm install
npm run dev
```

Copy `.env.example` to `.env` if overriding `VITE_API_URL` or `VITE_WS_URL` (defaults point to `http://localhost:8000` and `ws://localhost:8000/ws/btc`).

---

## Verification Suite

Run all backend, frontend, anti-slop, and E2E smoke checks:

```bash
# Backend
cd backend && ruff check . && mypy app && pytest -v

# Frontend (includes antiSlopAudit.test.ts)
cd frontend && npx tsc --noEmit && npx vitest run && npm run build

# Full-stack in-process REST + /ws/btc smoke test
python scripts/smoke_e2e.py
```

---

## Production Deployment

### Backend on Fly.io (`fra` Frankfurt)

`fly.toml` pins `primary_region = "fra"` (avoids Binance US `HTTP 451` geo-blocks), disables auto-stop (`auto_stop_machines = "off"`), and mounts a persistent `/data` volume (`SQLITE_PATH = "/data/terminal.db"`).

```bash
# 1. Create the Fly app and 1GB persistent volume in Frankfurt (first deploy only)
fly apps create btc-analytics-terminal
fly volumes create btc_terminal_data --region fra --size 1

# 2. Set production CORS origins for your Netlify URL
fly secrets set CORS_ORIGINS='["https://your-site.netlify.app"]'

# 3. Deploy single-machine instance from repo root (--ha=false prevents unattached SQLite replicas)
fly deploy --config fly.toml --ha=false
```

Local container sanity build:

```bash
docker build -f backend/Dockerfile -t btc-terminal-backend .
```

### Frontend on Netlify

`netlify.toml` builds `frontend/dist` and configures SPA fallback redirects + security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`).

In Netlify Site Settings → Environment Variables, configure:

- `VITE_API_URL=https://btc-analytics-terminal.fly.dev`
- `VITE_WS_URL=wss://btc-analytics-terminal.fly.dev/ws/btc`

---

## Workspace & Orchestration Docs

- [`.agents/execution_plan/SUMMARY.md`](.agents/execution_plan/SUMMARY.md) — Execution plan index and section links
- [`.agents/execution_plan/EXECUTION_PLAN.md`](.agents/execution_plan/EXECUTION_PLAN.md) — Master execution plan and Architectural Decision Records (ADRs)
- [`.agents/subagents/SUBAGENTS.md`](.agents/subagents/SUBAGENTS.md) — Subagent roles and specifications
- [`.agents/PROJECT_HISTORY.md`](.agents/PROJECT_HISTORY.md) — Chronological milestone and state-change log
- [`.agents/TODO.md`](.agents/TODO.md) — Active task tracker
