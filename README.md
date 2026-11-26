# BTC Derivatives & Order-Flow Analytics Terminal

A single-page, real-time Bitcoin (`BTCUSDT` perpetuals on Binance Futures and Bybit V5; `BTC` options on Deribit) market-structure and order-flow analytics terminal powered exclusively by free public exchange APIs.

## Architecture Overview

- **Backend:** Python, FastAPI, WebSockets (`/ws/btc`), and SQLite (`aiosqlite` in WAL mode)
- **Quant & Derivatives:** Analytical Black-76 Gamma / GEX, OI-weighted swing liquidation projections, per-venue whale burst aggregation, and `00:00 UTC` session CVD
- **Frontend:** React SPA (`100vh` × `100vw` viewport lock) with TradingView Lightweight Charts v5 and custom canvas `ISeriesPrimitive` overlays
- **Deployment:** Docker and Fly.io (`fra`)

## Repository Contents

- [`.agents/execution_plan/SUMMARY.md`](.agents/execution_plan/SUMMARY.md) — Execution plan index and section links
- [`.agents/execution_plan/EXECUTION_PLAN.md`](.agents/execution_plan/EXECUTION_PLAN.md) — Master execution plan and Architectural Decision Records (ADRs)
- [`.agents/subagents/SUBAGENTS.md`](.agents/subagents/SUBAGENTS.md) — Subagent roles and specifications
- [`.agents/PROJECT_HISTORY.md`](.agents/PROJECT_HISTORY.md) — Chronological milestone and state-change log
- [`.agents/TODO.md`](.agents/TODO.md) — Active task tracker
- [`.agents/`](.agents/) — Workspace rules, skills, and workflows
