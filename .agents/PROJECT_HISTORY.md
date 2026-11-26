# Project History & State Change Log

> **Purpose:** Chronological record of major milestones and architectural decisions across the project.  
> **Logging Guideline:** Updated during session wrap-up. Include only significant state changes that broadly affect the project, noting timestamp, category, concise description, and rationale.

---

## Log Format Standard

Each entry must record:

* **Timestamp**: ISO date or `YYYY-MM-DD HH:mm (Timezone)`.
* **Category**: One of:
  * `Architecture` — System topology, ADRs, data-flow contracts, or storage decisions.
  * `Ingestion` — Exchange WebSocket/REST feeds, backfill pipelines, or SQLite WAL persistence.
  * `Quant` — Derivatives math (Black-76 GEX, liquidation projections, CVD, VRVP).
  * `API` — FastAPI endpoints, `/ws/btc` multiplexing, or schema changes.
  * `Frontend / UI` — Design system, layout geometry, themes, or control drawer.
  * `Charting` — Lightweight Charts v5 integration or custom canvas `ISeriesPrimitive` layers.
  * `DevOps / QA` — Docker, Fly.io deployment, CI/CD, or end-to-end verification.
  * `Documentation` — Execution plans, subagent specs, skills, or project guidelines.
* **Change**: Concise summary of what was altered, added, or removed.
* **Rationale**: Objective or driving business/technical factor.

---

## Entries

### 2026-11-26 14:44 (CET) — Initial Workspace & Orchestration Configuration
* **Category**: `Documentation` / `Architecture`
* **Change**: Consolidated all workspace orchestration under `.agents/` (`AGENTS.md`, `PROJECT_HISTORY.md`, `TODO.md`, `execution_plan/SUMMARY.md`, `execution_plan/EXECUTION_PLAN.md`, `subagents/SUBAGENTS.md`), added `/wrap_up` and `/explain` skills under `.agents/skills/`, removed redundant root copies, and verified `.gitignore` and `README.md`.
* **Rationale**: Establishes a single-source-of-truth Antigravity workspace layout so agents orient via `SUMMARY.md` before loading targeted execution plan sections, with clean state tracking and session wrap-up governance.

### 2026-11-26 15:12 (CET) — Phase 1 Foundation & Phase 2 Backend, Quant & Streaming API
* **Category**: `Architecture` / `Ingestion` / `Quant` / `API`
* **Change**:
  - Completed Phase 1 (`Steps 1.1–1.2`): scaffolded Python 3.12 (`backend/`) and React 19 + Vite + Lightweight Charts `5.3.0` (`frontend/`) toolchains, SQLite WAL DDL (`schema.sql`), and 1:1 `snake_case` Pydantic v2 <-> TypeScript wire contracts (`schemas.py`, `terminal.ts`).
  - Completed Phase 2 (`Steps 2.1–2.5`): implemented `TerminalRepository` (`aiosqlite` WAL + 14-day retention), `MarketState` (6x1,500-bar ring buffers, single-source `00:00 UTC` Session CVD), `WhaleBurstAggregator` (`100ms` per-venue VWAP), Binance/Bybit connectors (`HTTP 451` fallback, inverted liquidation side parity, `20s` Bybit ping), pure-Python Black-76 options & auto-mitigated liquidation engines, `DeribitOptionsPoller`, and FastAPI REST + `/ws/btc` hub (`4 Hz` kline coalescing, `set_timeframe` routing).
  - Updated `.agents/AGENTS.md` (Section 8) to require automated gate verification and plain-language user verification guides at every milestone.
* **Rationale**: Establishes a fully tested (`20/20` pytest, `ruff`, `mypy`, `tsc` clean) backend and contract baseline prior to Phase 3 frontend UI implementation.
* **Next Step**: Phase 3 (`Step 3.1`) — 4-theme CSS token engine, client utilities (`timeSnap`, `vrvpCalc`), Zustand store, and REST/WS synchronization.
