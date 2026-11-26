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

### 2026-11-26 16:22 (CET) — Phase 3 Frontend Foundation, 4-Theme System & Institutional Shell
* **Category**: `Frontend / UI`
* **Change**:
  - Completed Phase 3 (`Steps 3.1–3.2`): implemented `tokens.css` (4 themes: `oled-dark`, `midnight-navy`, `warm-off-white`, `pure-white`; `100vh × 100vw` overflow lock; `.font-mono-tabular`), `themeTokens.ts` (`readThemeTokens()` Canvas bridge), `timeSnap.ts`, `vrvpCalc.ts` (80-bin VRVP + `70%` Value Area), `formatters.ts`, `useTerminalStore.ts` (Zustand v5 with `1,500`-item caps), `apiClient.ts` (`AbortController`/sequence-guarded `TerminalSyncController`), and `wsClient.ts` (`1s`–`15s` reconnect + resync).
  - Assembled the zero-scroll shell in `TopTelemetryBar.tsx` (`40px`), `ControlDrawer.tsx` (`260px` collapsible), `App.tsx`, and `main.tsx`, verified via `tsc --noEmit`, `vitest run` (`16/16` across 4 suites), `npm run build`, and an anti-slop token scan.
* **Rationale**: Establishes the zero-slop UI chrome, deterministic client quant utilities, and live state/stream sync layer ready for Phase 4 Lightweight Charts v5 integration.
* **Next Step**: Phase 4 (`Step 4.1`) — `UnifiedChart.tsx` Lightweight Charts v5.3+ core host, bottom `18%` volume pane, `ResizeObserver`, and imperative tick/theme sync.

### 2026-11-26 18:05 (CET) — Phase 4 Unified Charting, Left-Margin Thermal Strip, Whale Escalation & Field Guide
* **Category**: `Charting` / `Frontend / UI` / `Quant` / `Documentation`
* **Change**:
  - Completed Phase 4 (`Steps 4.1–4.3`): implemented `UnifiedChart.tsx` (strict Lightweight Charts v5.3+ `CandlestickSeries` + bottom `18%` `HistogramSeries` volume, `ResizeObserver`, 4-theme sync, imperative `.setData()` / `.update()`), `BaseOverlayPrimitive.ts`, `VRVPPrimitive.ts` (80-bin profile + `POC`/`VAH`/`VAL`), `OptionsWallsPrimitive.ts` (`Call Wall`, `Put Wall`, `Max Pain`, left-edge top-5 GEX micro-bars), `LiquidationPrimitive.ts` (`16px` left-docked continuous thermal bar + tag-free intensity/length-scaled top-4 Canvas `createLinearGradient` plumes + hollow diamond/`x` realized markers), and `WhaleBubblesPrimitive.ts`.
  - Refined Whale Flow (`feat/whale-bubble-escalation`): removed `$100k` tier and `bar_delta` markers; raised backend floor (`WHALE_MIN_USD = 250_000`) with `60d` retention for `>= $1M` prints; removed Whale Filter UI in `ControlDrawer.tsx` in favor of fixed per-TF floors (`$250k` on `1m` up to `$10M` on `1d`), `0.25%` intra-bar clustering (`xN`), visible-candle density budgeting (`[6, 36]` bubbles), relative radius scaling, and `< 3.5px/bar` zoom auto-hide.
  - Added collapsible accordion `LegendDrawer.tsx` (all 5 sections collapsed by default with triangle toggles; shrinks to `160px` rail when deep guide opens) and `3×`-width `GuideDrawer.tsx` (`min(760px, 56vw)`) with theme-reactive SVG diagrams and trading implications (auto-collapses `ControlDrawer`).
  - Updated `.agents/execution_plan/EXECUTION_PLAN.md`, `SUMMARY.md`, `SUBAGENTS.md`, `TODO.md`, and `skill_lightweight_charts_v5_primitives.md` to reflect the left-margin thermal strip and `LegendDrawer`.
* **Rationale**: Delivers an uncluttered `60 FPS` institutional chart across all timeframes (`1m`–`1d`) and zoom levels while providing progressive disclosure documentation directly inside the terminal.
* **Next Step**: Phase 5 (`Step 5.1`) — Dockerization, Fly.io (`fra`), Netlify config, CI pipeline, and E2E/anti-slop verification (`Step 5.2`).


### 2026-11-26 18:31 (CET) — Phase 5 Deployment Topology, CI/CD & E2E / Anti-Slop Verification
* **Category**: `DevOps / QA` / `Documentation`
* **Change**:
  - Completed Phase 5 (`Steps 5.1–5.2`) on `feat/phase-5-ops-qa`: added `backend/Dockerfile` (`python:3.12-slim`, non-root `appuser`, `/data`, `/api/v1/health` `HEALTHCHECK`), `.dockerignore`, `fly.toml` (`primary_region = "fra"`, `auto_stop_machines = "off"`, `min_machines_running = 1`, `/data` mount), `netlify.toml` (SPA fallback + security headers), and `.github/workflows/ci.yml` (`backend`, `frontend`, `smoke` jobs).
  - Implemented `frontend/src/__tests__/antiSlopAudit.test.ts` (with `node-shims.d.ts` for strict `tsc` without `@types/node`), `scripts/smoke_e2e.py` (in-process REST + `/ws/btc` `set_timeframe` contract check), and updated `README.md` with local dev, verification, Fly.io (`--ha=false`), and Netlify runbooks.
* **Rationale**: Completes all 5 phases of `EXECUTION_PLAN.md` with automated anti-slop, LWC v5 API, and end-to-end wire-contract verification (`20/20` pytest, `ruff`, `mypy`, `tsc`, `30/30` vitest, `vite build`, `smoke_e2e.py` all green).
* **Next Step**: Merge `feat/phase-5-ops-qa` into `main` when ready and deploy to Fly.io (`fra`) + Netlify.