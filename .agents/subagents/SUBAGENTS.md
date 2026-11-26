# BTC Analytics Terminal — Subagent Roster & Operating Specifications

## 1. Subagent Operating Model & Global Governance

### 1.1 Sequential Single-Agent Execution Architecture

All subagents in this specification are engineered for **smaller, faster, or less capable coding models** operating **strictly sequentially** (one active subagent at a time) with full terminal/CLI access inside the shared `btc-terminal/` workspace.

* **Separation of Concerns:**
  * `.agents/execution_plan/EXECUTION_PLAN.md` defines *what* gets built and *when* (phased steps, mathematical formulas, wire contracts, and verification gates).
  * `.agents/subagents/SUBAGENTS.md` (this document) defines *who* builds each step—specifying every subagent's domain focus, required skills, per-summon workload, file-system boundaries, CLI rules, trap guardrails, and invocation prompt.
  * `skills/*/SKILL.md` provides surgical, copy-paste *how-to* implementation patterns loaded only by the subagents that need them so context windows remain lean and focused.
* **Stateless Re-Summoning:** Several subagents (`SA-ARCH`, `SA-INGEST`, `SA-UI`, `SA-CHART`, `SA-OPS`) are summoned multiple times across the project lifecycle. Each summon starts with a fresh context window and relies on repository files + `PROGRESS_LOG.md` + assigned `SKILL.md` files rather than conversational memory.

### 1.2 Universal Terminal & CLI Safety Rules (Mandatory for All Agents)

Less capable models with shell access frequently stall pipelines by running blocking processes or mutating unowned files. Every subagent MUST obey these six terminal rules:

1. **Zero Blocking Foreground Servers:** NEVER run `uvicorn app.main:app`, `npm run dev`, `vite`, `vitest` (in watch mode), or `pytest -f` directly in the foreground without a single-run flag or hard timeout. Always pass single-run flags (`npx vitest run`, `pytest`) or wrap transient server checks in `timeout 10s ...` or Python `try / finally` subprocess blocks that terminate child processes cleanly.
2. **Read Before Write:** Before modifying or creating any file, inspect `PROGRESS_LOG.md`, read your assigned `skills/<skill-name>/SKILL.md` file(s), and read the exact contract files (`backend/app/schemas.py`, `frontend/src/types/terminal.ts`, `backend/app/config.py`) from disk. Never guess field names from memory.
3. **Incremental Micro-Verification:** Never write more than 2 files without running the relevant linter or typechecker (`ruff check`, `mypy`, `npx tsc --noEmit`). Catching syntax or import errors after 1 file prevents cascading multi-file breakage.
4. **Zero Suppression Directives:** Using `# type: ignore`, `# noqa`, `as any`, `@ts-ignore`, `@ts-expect-error`, or weakening `tsconfig.json` / `pyproject.toml` strictness to force a green build is strictly prohibited and constitutes an automatic step failure.
5. **Zero Unpinned Package Hallucinations:** Subagents MUST NOT run `pip install` or `npm install` on arbitrary third-party packages outside those locked by `SA-ARCH` in Step 1.1 unless explicitly instructed in `.agents/execution_plan/EXECUTION_PLAN.md`.
6. **Offline Deterministic Unit Tests:** All `pytest` and `vitest` suites (Steps 1.1 through 5.1) MUST run $100\%$ offline using mocked HTTP transports (`httpx.MockTransport`) and fixture payloads. Live upstream network calls are only permitted as optional checks in `scripts/smoke_e2e.py` (Step 5.2).

### 1.3 Mandatory 5-Stage Execution Loop per Summon

Every time a subagent is summoned for Step $X.Y$, it MUST execute this exact sequence:

1. **ORIENT:** Read `PROGRESS_LOG.md`, read Step $X.Y$ in `.agents/execution_plan/EXECUTION_PLAN.md`, read every assigned `skills/*/SKILL.md` file listed in your profile, and inspect upstream contract files. Confirm the prerequisite step passed.
2. **IMPLEMENT:** Write or update only the **Target Files Owned** assigned to Step $X.Y$, adhering strictly to all formulas, patterns, and schemas in `.agents/execution_plan/EXECUTION_PLAN.md` and your assigned `SKILL.md` files.
3. **VERIFY:** Execute the exact **Mandatory CLI Verification** commands from Step $X.Y$. Fix any failure in owned files until every command exits with status code `0`.
4. **BOUNDARY AUDIT:** Run `git status --short` (if git is initialized) or verify file timestamps to ensure zero out-of-scope files were accidentally mutated and zero temporary junk files remain.
5. **HANDOFF LOG:** Append a structured completion block to `PROGRESS_LOG.md` and terminate cleanly.

### 1.4 Standard `PROGRESS_LOG.md` Entry & Escalation Format

Upon passing all CLI checks, append:

```text
## [STEP X.Y] — COMPLETE
- **Subagent:** SA-XXXX
- **Timestamp (UTC):** YYYY-MM-DDTHH:MM:SSZ
- **Skills Loaded:** list of skills/*/SKILL.md read (or None)
- **Files Created/Updated:** list of exact paths
- **Verification Results:** exact CLI commands run -> exit code 0 (X tests passed)
- **Notes for Downstream Agents:** concise 1-2 bullet summary of exported interfaces
```

**Escalation Rule (3-Strike Circuit Breaker):** If a subagent fails the same verification check `3` consecutive times due to a suspected upstream contract bug in a file it does **not** own, it MUST NOT edit the unowned file. Instead, it must revert partial broken edits in its own scope, log a `[STEP X.Y] — BLOCKED` entry in `PROGRESS_LOG.md` citing the exact file, line number, and error traceback, and halt for orchestrator review.

### 1.5 Agent Skills Directory Binding (`skills/*/SKILL.md`)

To keep context windows compact while preventing common framework and exchange bugs, only load the `SKILL.md` files mapped to the active subagent:

| Skill Directory Path | Purpose & Key Guardrails | Bound To Subagents |
| --- | --- | --- |
| `skills/exchange-stream-quirks/SKILL.md` | Binance vs. Bybit liquidation side inversion, `aggTrade` maker polarity, Bybit `20s` ping & descending REST kline sort, Deribit regex, `100ms` burst aggregator | `SA-INGEST` |
| `skills/derivatives-quant-formulas/SKILL.md` | Pure-Python Black-76 Gamma ($T$ & $\sigma$ floors), Net Dollar GEX polarity, Max Pain, 5-bar pivot liquidation projection + sweep mitigation, 80-bin VRVP $70\%$ Value Area | `SA-QUANT`, `SA-UI` |
| `skills/anti-slop-ui-tokens/SKILL.md` | Exact 4-theme hex matrix, `readThemeTokens()` Canvas bridge, `100vh` `40px`/`260px` geometry, `.font-mono-tabular`, banned CSS/Tailwind slop list | `SA-UI`, `SA-CHART`, `SA-OPS` |
| `skills/lwc-v5-primitives/SKILL.md` | Strict LWC v5 `chart.addSeries(CandlestickSeries, ...)`, zero-extra-dep `ISeriesPrimitive` boilerplate, Retina `useMediaCoordinateSpace`, `0.5px` lines, `snapTimestampToBar` | `SA-CHART`, `SA-OPS` |

---

## 2. Subagent Roster & Multi-Summon Matrix

| Subagent ID | Role Title | Assigned `SKILL.md` Files | Summoned In Steps | Summon Count | Verification Toolchain |
| --- | --- | --- | --- | --- | --- |
| **`SA-ARCH`** | Protocol & Workspace Architect | *(None — sets base contracts)* | Step 1.1, Step 1.2 | $2\times$ | `ruff`, `mypy`, `pytest`, `tsc --noEmit` |
| **`SA-INGEST`** | Async Exchange Ingestion & Persistence Engineer | `exchange-stream-quirks` | Step 2.1, Step 2.2, Step 2.4 | $3\times$ | `pytest` (`pytest-asyncio`), `ruff`, `mypy` |
| **`SA-QUANT`** | Derivatives & Market-Structure Quant Engineer | `derivatives-quant-formulas` | Step 2.3 | $1\times$ | `pytest` (math & benchmark assertions), `ruff`, `mypy` |
| **`SA-API`** | FastAPI Real-Time Stream & REST Orchestrator | *(Uses `schemas.py` directly)* | Step 2.5 | $1\times$ | `pytest` (`TestClient` / WS), `ruff`, `mypy` |
| **`SA-UI`** | Institutional Design System & React Shell Engineer | `anti-slop-ui-tokens`, `derivatives-quant-formulas` | Step 3.1, Step 3.2 | $2\times$ | `tsc --noEmit`, `vitest run`, `npm run build` |
| **`SA-CHART`** | Lightweight Charts v5 & Canvas Primitives Engineer | `lwc-v5-primitives`, `anti-slop-ui-tokens` | Step 4.1, Step 4.2, Step 4.3 | $3\times$ | `tsc --noEmit`, `vitest run`, `npm run build` |
| **`SA-OPS`** | DevOps, Deployment & End-to-End QA Engineer | `anti-slop-ui-tokens`, `lwc-v5-primitives` | Step 5.1, Step 5.2 | $2\times$ | `pytest`, `vitest run`, `npm run build`, `smoke_e2e.py` |

---

## 3. Detailed Subagent Profiles

### 3.1 `SA-ARCH` — Protocol & Workspace Architect

* **Assigned Skill Files:** None (authors the foundational schemas and toolchains).
* **Core Focus:** Deterministic monorepo scaffolding, strict compiler/linter configuration, SQLite relational schema design, and $100\%$ lossless schema symmetry between Python Pydantic v2 models and TypeScript strict interfaces.
* **Required Technical Skills:**
  * Python 3.12 packaging (`pyproject.toml`, `ruff`, `mypy` strict mode, `pydantic>=2.9`, `pydantic-settings>=2.6`).
  * TypeScript 5.6+ (`strict: true`, `noUncheckedIndexedAccess: true`, discriminated union types), Vite 6, React 19, Tailwind CSS.
  * SQLite DDL optimization (composite indexing for time-series range scans).
* **Summoned Workload Breakdown:**
  * **Summon #1 (Step 1.1 — Monorepo Scaffolding & Strict Toolchains):** Create `.gitignore`, `.env.example`, `PROGRESS_LOG.md`, `backend/pyproject.toml`, `backend/app/config.py`, and `frontend/` build configs (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` with `Inter` + `JetBrains Mono` fonts and `data-theme="oled-dark"`). Install backend and frontend dependencies and verify clean compilation.
  * **Summon #2 (Step 1.2 — Canonical Data Contracts, SQLite DDL & TypeScript Mirrors):** Author `backend/app/db/schema.sql`, `backend/app/schemas.py`, `frontend/src/types/terminal.ts`, and `backend/tests/test_schemas.py`. Lock every REST response and `/ws/btc` discriminated union frame.
* **CLI Permissions & Boundaries:**
  * **Allowed CLI:** Python venv/pip/uv commands, `npm install`, `ruff check`, `mypy`, `pytest`, `npx tsc --noEmit`.
  * **Write Ownership:** `.gitignore`, `.env.example`, `PROGRESS_LOG.md`, `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/schemas.py`, `backend/app/db/schema.sql`, `backend/tests/test_schemas.py`, `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/types/terminal.ts`.
  * **Prohibited ("Do Not Touch"):** Do not write connector logic, FastAPI routes, React components, or CSS styles.
* **Anti-Trap Guardrails (For Less Capable Models):**
  * **Time Unit Split:** `CandleBar.time` MUST be typed and documented as **integer UTC seconds** (required by Lightweight Charts `UTCTimestamp`), whereas `WhalePrint.ts_ms`, `RealizedLiquidation.ts_ms`, and SQLite `ts_ms` columns MUST be **integer UTC milliseconds**. Mixing seconds and milliseconds breaks chart coordinate mapping.
  * **NPM Package Trap:** Install `lightweight-charts@^5.3.0` ONLY. Do NOT add `@tradingview/lwc-plugin-*` or `fancy-canvas` packages to `package.json`, as all four overlays are built as native `ISeriesPrimitive` classes using `lightweight-charts` built-in types.
  * **Strict Extra Field Rejection:** Every Pydantic model in `schemas.py` must set `model_config = ConfigDict(extra="forbid")` so typos in downstream steps fail loudly during unit tests.
* **Pass/Fail Acceptance Criteria:**
  * `ruff check .`, `mypy app`, `pytest tests/test_schemas.py -v`, and `npx tsc --noEmit` all exit `0`.
  * Every field name in `frontend/src/types/terminal.ts` matches `backend/app/schemas.py` character-for-character (`snake_case` preserved on wire interfaces so zero fragile camelCase conversion layer is needed).
* **Invocation Prompt Template:**
  ```text
  You are SA-ARCH (Protocol & Workspace Architect). Read `.agents/subagents/SUBAGENTS.md` (Section 1 & Section 3.1), `PROGRESS_LOG.md`, and `.agents/execution_plan/EXECUTION_PLAN.md` (Sections 2, 3, and Step {STEP_ID}). Execute ONLY Step {STEP_ID}. Modify only the Target Files Owned for Step {STEP_ID}. Run every Mandatory CLI Verification command until exit code 0, enforce zero `any` or `# type: ignore`, and log your handoff in `PROGRESS_LOG.md`.
  ```

---

### 3.2 `SA-INGEST` — Async Exchange Ingestion & Persistence Engineer

* **Assigned Skill Files (MUST READ FIRST):** `skills/exchange-stream-quirks/SKILL.md`
* **Core Focus:** High-reliability `asyncio` market-data ingestion across Binance USDS-M Futures, Bybit V5 Linear, and Deribit v2 REST/WebSockets; venue side-normalization; `100ms` per-venue whale burst aggregation; `00:00 UTC` Session CVD tracking; and non-blocking `aiosqlite` WAL batch storage.
* **Required Technical Skills:**
  * Python `asyncio` concurrency (`Queue`, `Task`, `Event`, `wait_for`, structured cancellation).
  * `websockets>=13.1` client lifecycle, ping/pong keepalives, exponential backoff with jitter, staleness watchdogs.
  * `httpx.AsyncClient` connection pooling, HTTP status handling (`429`, `451`, `5xx`), and `httpx.MockTransport` testing.
  * `aiosqlite` in `WAL` mode, transactional batch flushing, time-based retention pruning.
* **Summoned Workload Breakdown:**
  * **Summon #1 (Step 2.1 — Async SQLite WAL Repository & Rolling Retention Worker):** Build `backend/app/db/repository.py` and `backend/tests/test_repository.py`. Enforce `PRAGMA journal_mode=WAL`, queued `1.0s` / `50`-row transactional batch writes (`whales` $\ge \$100,000$, `liquidations` $\ge \$25,000$), query methods, and `14`-day pruning.
  * **Summon #2 (Step 2.2 — Binance & Bybit Connectors, Whale Aggregator & Session CVD):** Read `skills/exchange-stream-quirks/SKILL.md` in full. Build `MarketState` (`1,500`-bar ring buffers across 6 timeframes + Session CVD), `WhaleBurstAggregator` (`100ms` per-venue window + `120ms` async flush timer), `ReconnectingWSConnector`, `BinanceConnector` (with `HTTP 451` fallback flag + `00:00 UTC` `1m` taker-buy CVD backfill), `BybitConnector` (`20s` `{"op": "ping"}` + ascending sort on REST fallback + inverted `allLiquidation` parser), and `test_connectors_normalization.py`.
  * **Summon #3 (Step 2.4 — Deribit 60s Poller & Tier-2 Snapshot Integration):** Read `skills/exchange-stream-quirks/SKILL.md` Section 2.D. Build `DeribitOptionsPoller` (`backend/app/connectors/deribit.py`), wire `60s` polling into `options_quant.compute_options_surfaces()` (built by `SA-QUANT` in Step 2.3) and `MarketState`, trigger `30`-minute SQLite snapshot writes, and extend `test_connectors_normalization.py`.
* **CLI Permissions & Boundaries:**
  * **Allowed CLI:** `pytest`, `ruff check`, `mypy`.
  * **Write Ownership:** `backend/app/db/__init__.py`, `backend/app/db/repository.py`, `backend/app/connectors/*`, `backend/app/engine/__init__.py`, `backend/app/engine/state.py`, `backend/app/engine/whale_aggregator.py`, `backend/tests/test_repository.py`, `backend/tests/test_connectors_normalization.py`.
  * **Prohibited ("Do Not Touch"):** Do NOT modify `backend/app/schemas.py`, `backend/app/engine/options_quant.py`, `backend/app/engine/liquidations.py`, or any `frontend/` file.
* **Anti-Trap Guardrails (For Less Capable Models):**
  * **Follow `skills/exchange-stream-quirks/SKILL.md` Verbatim:** Specifically enforce the Binance `forceOrder` (`SELL` $\rightarrow$ `"long_liq"`) vs. Bybit `allLiquidation` (`Buy` $\rightarrow$ `"long_liq"`) inversion, `aggTrade` `m == False` $\rightarrow$ `"buy"`, and ascending sort on Bybit REST `/v5/market/kline` fallback rows.
  * **Single-Source Live CVD:** Accumulate live Session CVD ticks from Binance `aggTrade` when `binance_ws_connected == True`, and switch live CVD accumulation to Bybit `publicTrade` **only** while Binance WS is disconnected. Never sum both trade streams into CVD simultaneously.
  * **Clean Async Loop Teardown:** Every background flush timer or ping loop MUST expose `.close()` / `.stop()` so `pytest-asyncio` exits with zero pending-task warnings.
* **Pass/Fail Acceptance Criteria:**
  * `pytest -v`, `ruff check app`, and `mypy app` exit `0` with zero warnings.
  * Unit tests explicitly verify WAL pragma, $\$100\text{k}$/$\$25\text{k}$ write thresholds, `100ms` VWAP burst aggregation per venue, Binance vs. Bybit liquidation side parity, Bybit descending-to-ascending kline sort, `00:00 UTC` CVD backfill + rollover, and `HTTP 451` fallback.
* **Invocation Prompt Template:**
  ```text
  You are SA-INGEST (Async Exchange Ingestion & Persistence Engineer). First read `.agents/subagents/SUBAGENTS.md` (Section 1 & Section 3.2), `skills/exchange-stream-quirks/SKILL.md`, `PROGRESS_LOG.md`, `backend/app/schemas.py`, and `.agents/execution_plan/EXECUTION_PLAN.md` (Section 3.1, 3.2, 3.3, and Step {STEP_ID}). Execute ONLY Step {STEP_ID} using strictly offline mocked transports in tests. Verify with `pytest -v && ruff check app && mypy app` and update `PROGRESS_LOG.md`.
  ```

---

### 3.3 `SA-QUANT` — Derivatives & Market-Structure Quant Engineer

* **Assigned Skill Files (MUST READ FIRST):** `skills/derivatives-quant-formulas/SKILL.md`
* **Core Focus:** Pure, side-effect-free, deterministic quantitative algorithms for Black-76 BTC options Gamma, Dealer Net GEX, Call/Put Walls, Max Pain, and OI-weighted swing-pivot liquidation bands with real-time price-sweep mitigation.
* **Required Technical Skills:**
  * Options pricing mathematics: Black-76 futures/crypto option model, standard normal PDF $\phi(d_1)$, dollar Gamma scaling, Max Pain strike optimization.
  * Market-structure microstructure: $N$-bar fractal pivot detection, Simple Moving Average volume filtering, isolated margin liquidation formulas, interval/price-bucket clustering.
  * High-performance pure Python (`math.log`, `math.exp`, `math.sqrt`, single-pass comprehensions) without `numpy` or `scipy` C-dependencies.
* **Summoned Workload Breakdown:**
  * **Summon #1 (Step 2.3 — Black-76 Options Quant Engine & Self-Mitigating Liquidation Clusters):** Read `skills/derivatives-quant-formulas/SKILL.md` in full. Implement `backend/app/engine/options_quant.py`, `backend/app/engine/liquidations.py`, and `backend/tests/test_quant_engines.py`.
* **CLI Permissions & Boundaries:**
  * **Allowed CLI:** `pytest tests/test_quant_engines.py -v`, `ruff check app/engine`, `mypy app/engine`.
  * **Write Ownership:** `backend/app/engine/options_quant.py`, `backend/app/engine/liquidations.py`, `backend/tests/test_quant_engines.py`.
  * **Prohibited ("Do Not Touch"):** Zero `asyncio`, zero `httpx`, zero `aiosqlite`, zero imports from `app/connectors` or `app/db`. Do not modify `pyproject.toml` to add `numpy` or `scipy`.
* **Anti-Trap Guardrails (For Less Capable Models):**
  * **Use Exact Guards from `skills/derivatives-quant-formulas/SKILL.md`:** Floor $T$ at $1 / 525960$ years (1 minute), floor $\sigma$ at $0.05$, guard $|d_1| > 12.0$, skip combo option tickers gracefully, and enforce both historical forward-bar mitigation ($j > i$) and real-time `filter_unmitigated_bands(bands, tick_low, tick_high)`.
* **Pass/Fail Acceptance Criteria:**
  * `pytest tests/test_quant_engines.py -v`, `ruff check app/engine`, and `mypy app/engine` exit `0`.
  * Unit tests verify Black-76 Gamma within $10^{-6}$ of closed-form reference values, `+Call GEX` vs. `-Put GEX` polarity, exact Max Pain calculation, immediate removal of swept 100x/50x bands while preserving untouched 25x/10x bands, and $< 25\text{ ms}$ runtime across an `800`-instrument synthetic Deribit book.
* **Invocation Prompt Template:**
  ```text
  You are SA-QUANT (Derivatives & Market-Structure Quant Engineer). First read `.agents/subagents/SUBAGENTS.md` (Section 1 & Section 3.3), `skills/derivatives-quant-formulas/SKILL.md`, `PROGRESS_LOG.md`, `backend/app/schemas.py`, and `.agents/execution_plan/EXECUTION_PLAN.md` (Section 3.1.C, Section 3.2 Formulas 3 & 4, and Step 2.3). Implement pure, deterministic Python functions in `options_quant.py` and `liquidations.py` using only the standard library `math` module (zero network/DB I/O, zero scipy/numpy). Verify all math invariants and runtime benchmarks via `pytest tests/test_quant_engines.py -v && ruff check app/engine && mypy app/engine`, then update `PROGRESS_LOG.md`.
  ```

---

### 3.4 `SA-API` — FastAPI Real-Time Stream & REST Orchestrator

* **Assigned Skill Files:** None (consumes `backend/app/schemas.py` and Phase 2 modules directly).
* **Core Focus:** Wiring the ingestion connectors, SQLite repository, and quant engines into a clean FastAPI ASGI application with instant REST backfill endpoints and a backpressure-isolated, rate-coalesced `/ws/btc` WebSocket broadcaster.
* **Required Technical Skills:**
  * FastAPI `lifespan` async context managers, dependency injection, `CORSMiddleware`, and typed response models.
  * ASGI WebSocket multiplexing, per-connection subscription state (`interval`), outbound rate coalescing (`4 Hz` kline throttling, `1 Hz` header telemetry), and `asyncio.wait_for` slow-consumer eviction.
  * FastAPI `TestClient` WebSocket testing and `httpx.AsyncClient` ASGI integration testing.
* **Summoned Workload Breakdown:**
  * **Summon #1 (Step 2.5 — FastAPI Lifecycle, REST Backfill & Multiplexed `/ws/btc` Hub):** Implement `backend/app/api/ws_hub.py`, `backend/app/api/routes.py`, `backend/app/main.py`, and `backend/tests/test_api_and_ws.py`.
* **CLI Permissions & Boundaries:**
  * **Allowed CLI:** `pytest`, `ruff check`, `mypy`. (NEVER run bare `uvicorn` without a timeout.)
  * **Write Ownership:** `backend/app/api/__init__.py`, `backend/app/api/ws_hub.py`, `backend/app/api/routes.py`, `backend/app/main.py`, `backend/tests/test_api_and_ws.py` *(plus minor callback hook wiring in `state.py` if required, preserving all existing tests)*.
  * **Prohibited ("Do Not Touch"):** Do not alter wire contracts in `schemas.py` or touch `frontend/`.
* **Anti-Trap Guardrails (For Less Capable Models):**
  * **Candle-Close Flush Rule:** When coalescing outbound `"kline"` WebSocket frames to max `4 Hz` (`250ms` interval), NEVER drop or overwrite a frame where `candle.is_closed == True`. Flush closed candles immediately before emitting the next bar's open tick.
  * **Test Isolation of Background Loops:** Support `create_app(enable_live_connectors: bool = True)` so `test_api_and_ws.py` injects deterministic state into `MarketState` and `TerminalRepository` without opening live sockets to Binance/Bybit/Deribit during offline tests.
  * **Dead-Socket Protection:** Iterate over a shallow copy of connected clients, wrap each `ws.send_json(...)` in `asyncio.wait_for(..., timeout=2.0)`, and evict stalled/disconnected sockets cleanly.
* **Pass/Fail Acceptance Criteria:**
  * Full backend test suite (`pytest -v`), `ruff check .`, and `mypy app` exit `0`.
  * `test_api_and_ws.py` proves all 4 REST endpoints conform to `schemas.py`, `/ws/btc` defaults to `"5m"`, sending `{"type": "set_timeframe", "interval": "15m"}` switches kline delivery exclusively to `"15m"`, and global `"whale"` / `"liquidation"` / `"telemetry"` events reach all connected clients.
* **Invocation Prompt Template:**
  ```text
  You are SA-API (FastAPI Real-Time Stream & REST Orchestrator). Read `.agents/subagents/SUBAGENTS.md` (Section 1 & Section 3.4), `PROGRESS_LOG.md`, `backend/app/schemas.py`, and `.agents/execution_plan/EXECUTION_PLAN.md` (Section 3.4 and Step 2.5). Wire the REST routes, `/ws/btc` ConnectionManager, and FastAPI lifespan cleanly. Never run blocking `uvicorn` in the shell—verify everything offline via `pytest -v && ruff check . && mypy app`, then update `PROGRESS_LOG.md`.
  ```

---

### 3.5 `SA-UI` — Institutional Design System & React Shell Engineer

* **Assigned Skill Files (MUST READ FIRST):** `skills/anti-slop-ui-tokens/SKILL.md` and `skills/derivatives-quant-formulas/SKILL.md` (Section 4 for 80-bin VRVP)
* **Core Focus:** Implementing the strict "Zero-Slop" Swiss institutional aesthetic, the 4-theme CSS custom-property system, deterministic client-side VRVP and timestamp-snapping utilities, bounded Zustand state management, resilient REST/WebSocket synchronization, and the `100vh` zero-scroll application chrome (`40px` header + `260px` collapsible right drawer).
* **Required Technical Skills:**
  * React 19 functional architecture, hooks, and render-isolation patterns (selector-based Zustand subscriptions).
  * Zustand v5 store design, bounded circular array slicing, `localStorage` theme persistence.
  * CSS Custom Properties, hairline `1px` grid layouts, strict `tabular-nums` monospace typography.
  * Vitest + `@testing-library/react` unit testing.
* **Summoned Workload Breakdown:**
  * **Summon #1 (Step 3.1 — 4-Theme Token Engine, Utilities, Zustand Store & WS/REST Sync):** Read `skills/anti-slop-ui-tokens/SKILL.md` and `skills/derivatives-quant-formulas/SKILL.md` (Section 4). Build `tokens.css` (including `readThemeTokens()`), `formatters.ts`, `timeSnap.ts`, `vrvpCalc.ts`, `useTerminalStore.ts`, `apiClient.ts`, `wsClient.ts`, and unit tests (`timeSnap.test.ts`, `vrvpCalc.test.ts`, `store.test.ts`).
  * **Summon #2 (Step 3.2 — `100vh` Zero-Scroll Shell: `40px` Header Strip & `260px` Control Drawer):** Read `skills/anti-slop-ui-tokens/SKILL.md` (Sections 2 & 3). Build `TopTelemetryBar.tsx`, `ControlDrawer.tsx`, `App.tsx`, and `main.tsx`.
* **CLI Permissions & Boundaries:**
  * **Allowed CLI:** `npx tsc --noEmit`, `npx vitest run`, `npm run build`. (NEVER run `npm run dev` or bare `npx vitest` watch mode.)
  * **Write Ownership:** `frontend/src/styles/tokens.css`, `frontend/src/utils/*`, `frontend/src/store/useTerminalStore.ts`, `frontend/src/services/*`, `frontend/src/components/TopTelemetryBar.tsx`, `frontend/src/components/ControlDrawer.tsx`, `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/__tests__/timeSnap.test.ts`, `frontend/src/__tests__/vrvpCalc.test.ts`, `frontend/src/__tests__/store.test.ts`.
  * **Prohibited ("Do Not Touch"):** Do not modify `backend/` files or `frontend/src/types/terminal.ts`, and do not build Lightweight Charts primitives (owned by `SA-CHART`).
* **Anti-Trap Guardrails (For Less Capable Models):**
  * **Obey `skills/anti-slop-ui-tokens/SKILL.md` Blacklist:** Zero `backdrop-filter`, `backdrop-blur`, `box-shadow`, `shadow-*`, `drop-shadow`, `linear-gradient`, `radial-gradient`, or `rounded-lg/xl/2xl/3xl`. Apply `.font-mono-tabular` to every numeric value.
  * **Race-Condition Prevention on Timeframe Switch:** Use an `AbortController` or monotonic `requestSeq` in `apiClient.ts` when switching intervals rapidly so stale `/klines` HTTP responses are discarded, and emit `{"type": "set_timeframe", "interval": tf}` over `/ws/btc` on switch and on socket reconnect.
* **Pass/Fail Acceptance Criteria:**
  * `npx tsc --noEmit`, `npx vitest run`, and `npm run build` all exit `0`.
  * `vrvpCalc.test.ts` proves total distributed buy + sell volume equals input visible candle quote volume within $10^{-6}$ and `VAL <= POC <= VAH` covers $\ge 70\%$ of volume.
  * `timeSnap.test.ts` proves `snapTimestampToBar` aligns arbitrary millisecond timestamps to exact candle open UTC seconds across all 6 intervals (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`).
* **Invocation Prompt Template:**
  ```text
  You are SA-UI (Institutional Design System & React Shell Engineer). First read `.agents/subagents/SUBAGENTS.md` (Section 1 & Section 3.5), `skills/anti-slop-ui-tokens/SKILL.md`, `skills/derivatives-quant-formulas/SKILL.md` (Section 4), `PROGRESS_LOG.md`, `frontend/src/types/terminal.ts`, and `.agents/execution_plan/EXECUTION_PLAN.md` (Section 4 and Step {STEP_ID}). Enforce strict zero-slop Swiss typography and exact 4-theme tokens. Never run watch-mode `vitest` or `npm run dev`—verify with `npx tsc --noEmit && npx vitest run && npm run build` and update `PROGRESS_LOG.md`.
  ```

---

### 3.6 `SA-CHART` — Lightweight Charts v5 & Canvas Primitives Engineer

* **Assigned Skill Files (MUST READ FIRST):** `skills/lwc-v5-primitives/SKILL.md` and `skills/anti-slop-ui-tokens/SKILL.md`
* **Core Focus:** Building the unified `60 FPS` TradingView Lightweight Charts v5.3+ viewport (`UnifiedChart.tsx`) and four custom HTML5 Canvas 2D `ISeriesPrimitive` classes (`VRVPPrimitive`, `WhaleBubblesPrimitive`, `LiquidationPrimitive`, `OptionsWallsPrimitive`) synchronized to live ticks, theme switches, timeframe changes, and drawer layer toggles.
* **Required Technical Skills:**
  * TradingView `lightweight-charts` v5.3+ TypeScript API (`createChart`, `addSeries(CandlestickSeries, ...)`, `addSeries(HistogramSeries, ...)`, `ISeriesPrimitive<Time>`, `IPrimitivePaneView`, `IPrimitivePaneRenderer`).
  * `useMediaCoordinateSpace` HiDPI Canvas 2D rendering, `0.5px` crisp hairline alignment, `requestAnimationFrame` throttling, `ResizeObserver`.
* **Summoned Workload Breakdown:**
  * **Summon #1 (Step 4.1 — Lightweight Charts v5.3+ Core Host, Volume Split & Live Sync):** Read `skills/lwc-v5-primitives/SKILL.md` (Section 1) and `skills/anti-slop-ui-tokens/SKILL.md` (Section 1). Build `UnifiedChart.tsx` and mount it inside `App.tsx`. Wire `CandlestickSeries` + bottom $18\%$ `HistogramSeries` volume pane, `.setData()` on backfill/TF switch vs. `.update()` on live ticks, `ResizeObserver` when the `260px` drawer toggles, and dynamic 4-theme re-theming.
  * **Summon #2 (Step 4.2 — Custom Primitives Part 1: `VRVPPrimitive` & `WhaleBubblesPrimitive`):** Read `skills/lwc-v5-primitives/SKILL.md` (Sections 2–4). Build and attach `VRVPPrimitive.ts` (right-docked 80-bin buy/sell profile + `POC` / `VAH` / `VAL` lines) and `WhaleBubblesPrimitive.ts` (area-scaled circles $R \in [4, 28]$ at `(snapTimestampToBar(ts_ms, tf), price)` with venue distinction and crosshair hover HUD readout).
  * **Summon #3 (Step 4.3 — Custom Primitives Part 2: `LiquidationPrimitive` & `OptionsWallsPrimitive`):** Read `skills/lwc-v5-primitives/SKILL.md` (Sections 2 & 3). Build and attach `LiquidationPrimitive.ts` (`16px` left-docked continuous vertical thermal bar + tag-free intensity-scaled peak horizontal Canvas heat projections expanding rightward from the left margin + hollow diamond/`x` realized liquidation markers) and `OptionsWallsPrimitive.ts` (expiry-reactive `Call Wall`, `Put Wall`, `Max Pain` rays + right-edge strike/GEX tags + top-5 GEX micro-bars offset right of the thermal bar).
* **CLI Permissions & Boundaries:**
  * **Allowed CLI:** `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
  * **Write Ownership:** `frontend/src/components/UnifiedChart.tsx`, `frontend/src/primitives/VRVPPrimitive.ts`, `frontend/src/primitives/WhaleBubblesPrimitive.ts`, `frontend/src/primitives/LiquidationPrimitive.ts`, `frontend/src/primitives/OptionsWallsPrimitive.ts`, and mounting `<UnifiedChart />` inside `frontend/src/App.tsx`.
  * **Prohibited ("Do Not Touch"):** Do not touch `backend/`, `tokens.css` banned properties, or `terminal.ts`.
* **Anti-Trap Guardrails (For Less Capable Models):**
  * **Follow `skills/lwc-v5-primitives/SKILL.md` Patterns Exactly:** Use `chart.addSeries(CandlestickSeries, ...)`, extract `type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0]` (never import `'fancy-canvas'` directly), draw inside `target.useMediaCoordinateSpace(...)`, snap timestamps via `snapTimestampToBar`, and keep `createChart()` mounted once via imperative Zustand `.subscribe(...)` updates.
* **Pass/Fail Acceptance Criteria:**
  * `npx tsc --noEmit`, `npx vitest run`, and `npm run build` exit `0`.
  * Zero v4 API strings exist in `frontend/src/`.
  * All 6 drawer switches (`Volume`, `VRVP`, `Whale Flow`, `Liquidation Levels`, `Put/Call Walls`, `Max Pain`), all 4 themes, all 4 whale USD pills, and the Deribit expiry selector instantaneously update the unified chart without recreating the chart instance.
* **Invocation Prompt Template:**
  ```text
  You are SA-CHART (Lightweight Charts v5 & Canvas Primitives Engineer). First read `.agents/subagents/SUBAGENTS.md` (Section 1 & Section 3.6), `skills/lwc-v5-primitives/SKILL.md`, `skills/anti-slop-ui-tokens/SKILL.md`, `PROGRESS_LOG.md`, `frontend/src/types/terminal.ts`, `frontend/src/store/useTerminalStore.ts`, and `.agents/execution_plan/EXECUTION_PLAN.md` (Section 3.2 Formulas 2 & 5, Section 4, and Step {STEP_ID}). Use strictly Lightweight Charts v5 APIs and `useMediaCoordinateSpace`, snap all overlay timestamps with `snapTimestampToBar`, and preserve 60 FPS via imperative updates without recreating the chart. Verify via `npx tsc --noEmit && npx vitest run && npm run build` and update `PROGRESS_LOG.md`.
  ```

---

### 3.7 `SA-OPS` — DevOps, Deployment & End-to-End QA Engineer

* **Assigned Skill Files (MUST READ FOR STEP 5.2):** `skills/anti-slop-ui-tokens/SKILL.md` and `skills/lwc-v5-primitives/SKILL.md` (Section 1 forbidden v4 table)
* **Core Focus:** Production containerization, geo-compliant Fly.io (`fra` Frankfurt) configuration with persistent SQLite WAL storage, Netlify static SPA hosting config, GitHub Actions CI automation, automated anti-slop codebase verification, and end-to-end full-stack REST + WebSocket smoke testing.
* **Required Technical Skills:**
  * Docker (`python:3.12-slim` hardening, non-root execution, layer caching, `HEALTHCHECK`).
  * Fly.io v2 infrastructure (`fly.toml`, single-machine persistent volume mounts, region pinning).
  * Netlify configuration (`netlify.toml` SPA redirects, security headers, build base paths).
  * GitHub Actions CI workflows and Python ASGI/WebSocket end-to-end integration testing.
* **Summoned Workload Breakdown:**
  * **Summon #1 (Step 5.1 — Dockerization, Fly.io `fra` Config, Netlify Config & CI Pipeline):** Author `backend/Dockerfile`, `.dockerignore`, `fly.toml`, `netlify.toml`, and `.github/workflows/ci.yml`.
  * **Summon #2 (Step 5.2 — Full-Stack Integration Smoke Harness & Anti-Slop Design Audit):** Read `skills/anti-slop-ui-tokens/SKILL.md` and `skills/lwc-v5-primitives/SKILL.md` (Section 1). Author `frontend/src/__tests__/antiSlopAudit.test.ts` (enforcing zero banned CSS/Tailwind tokens, all 4 theme hex palettes, `tabular-nums`, `40px`/`260px` geometry, and zero LWC v4 calls), `scripts/smoke_e2e.py` (testing full FastAPI REST + `/ws/btc` `set_timeframe` contract in-process), and root `README.md`.
* **CLI Permissions & Boundaries:**
  * **Allowed CLI:** `pytest`, `ruff check`, `mypy`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `python scripts/smoke_e2e.py`, `docker build` (if Docker daemon is available).
  * **Write Ownership:** `backend/Dockerfile`, `.dockerignore`, `fly.toml`, `netlify.toml`, `.github/workflows/ci.yml`, `frontend/src/__tests__/antiSlopAudit.test.ts`, `scripts/smoke_e2e.py`, `README.md`.
  * **Prohibited ("Do Not Touch"):** Do not rewrite application features unless fixing a genuine integration or anti-slop violation surfaced by `antiSlopAudit.test.ts` or `smoke_e2e.py` (document any exact line fixed in `PROGRESS_LOG.md`).
* **Anti-Trap Guardrails (For Less Capable Models):**
  * **Fly.io Region & Single-Machine SQLite Lock:** Set `primary_region = "fra"` (avoids Binance US `HTTP 451`), `min_machines_running = 1`, `auto_stop_machines = "off"`, mount `/data`, and document `fly deploy --ha=false` in `README.md` so Fly never spawns a second unattached SQLite machine.
  * **Self-Contained `smoke_e2e.py` Execution:** Use FastAPI `TestClient` (with `client.websocket_connect("/ws/btc")`) and pre-seeded deterministic `MarketState` / temporary SQLite DB so `smoke_e2e.py` completes in $< 5\text{ s}$ with zero orphaned `uvicorn` processes.
* **Pass/Fail Acceptance Criteria:**
  * `pytest -v`, `ruff check .`, `mypy app`, `npx tsc --noEmit`, `npx vitest run` (including `antiSlopAudit.test.ts`), `npm run build`, and `python scripts/smoke_e2e.py` ALL exit with code `0`.
* **Invocation Prompt Template:**
  ```text
  You are SA-OPS (DevOps, Deployment & End-to-End QA Engineer). First read `.agents/subagents/SUBAGENTS.md` (Section 1 & Section 3.7), `skills/anti-slop-ui-tokens/SKILL.md`, `skills/lwc-v5-primitives/SKILL.md` (Section 1), `PROGRESS_LOG.md`, and `.agents/execution_plan/EXECUTION_PLAN.md` (Section 1.2 ADR-01, Section 4, and Step {STEP_ID}). Execute Step {STEP_ID}. Ensure `fly.toml` pins `fra` Frankfurt and `/data` volume with `auto_stop_machines = "off"`, and ensure `smoke_e2e.py` terminates cleanly with zero background orphan processes. Run the complete backend + frontend + smoke verification suite until exit code 0, then append the final sign-off to `PROGRESS_LOG.md`.
  ```

---

## 4. Orchestrator Dispatch Sequence & Recovery Playbook

To execute the build from an empty folder to production-ready artifacts, summon the subagents in this exact 14-dispatch sequential order:

| Dispatch # | Plan Step | Summon Agent | Skills Loaded by Agent | Gate Check Before Advancing |
| --- | --- | --- | --- | --- |
| **1** | Step 1.1 | `SA-ARCH` | *(None)* | `ruff`, `mypy`, and `tsc --noEmit` exit `0`; `lightweight-charts >= 5.3.0` installed |
| **2** | Step 1.2 | `SA-ARCH` | *(None)* | `pytest tests/test_schemas.py` & `tsc --noEmit` exit `0`; 1:1 schema parity |
| **3** | Step 2.1 | `SA-INGEST` | `exchange-stream-quirks` | `pytest tests/test_repository.py` exits `0`; SQLite `WAL` mode verified |
| **4** | Step 2.2 | `SA-INGEST` | `exchange-stream-quirks` | `pytest tests/test_connectors_normalization.py` exits `0`; side polarity & CVD verified |
| **5** | Step 2.3 | `SA-QUANT` | `derivatives-quant-formulas` | `pytest tests/test_quant_engines.py` exits `0`; Black-76 & mitigation verified |
| **6** | Step 2.4 | `SA-INGEST` | `exchange-stream-quirks` | Full `backend` `pytest`, `ruff`, `mypy` exit `0`; Deribit 60s poller wired |
| **7** | Step 2.5 | `SA-API` | *(None)* | `pytest tests/test_api_and_ws.py` exits `0`; `/ws/btc` `set_timeframe` verified |
| **8** | Step 3.1 | `SA-UI` | `anti-slop-ui-tokens`, `derivatives-quant-formulas` | `tsc --noEmit` & `vitest run` exit `0`; `timeSnap`, `vrvpCalc`, & Zustand store verified |
| **9** | Step 3.2 | `SA-UI` | `anti-slop-ui-tokens` | `npm run build` exits `0`; `40px` header + `260px` drawer + 4 themes verified |
| **10** | Step 4.1 | `SA-CHART` | `lwc-v5-primitives`, `anti-slop-ui-tokens` | `npm run build` exits `0`; LWC v5 `CandlestickSeries` + `HistogramSeries` live |
| **11** | Step 4.2 | `SA-CHART` | `lwc-v5-primitives`, `anti-slop-ui-tokens` | `npm run build` exits `0`; `VRVPPrimitive` + `WhaleBubblesPrimitive` attached |
| **12** | Step 4.3 | `SA-CHART` | `lwc-v5-primitives`, `anti-slop-ui-tokens` | `npm run build` exits `0`; `LiquidationPrimitive` + `OptionsWallsPrimitive` attached |
| **13** | Step 5.1 | `SA-OPS` | *(None)* | `fly.toml` (`fra` + `/data`), `Dockerfile`, `netlify.toml`, `ci.yml` validated |
| **14** | Step 5.2 | `SA-OPS` | `anti-slop-ui-tokens`, `lwc-v5-primitives` | `antiSlopAudit.test.ts` + `scripts/smoke_e2e.py` + full backend/frontend suites exit `0` |

### Failure Recovery Procedure for the Orchestrator

If any dispatch fails or halts with `[STEP X.Y] — BLOCKED`:

1. Inspect `PROGRESS_LOG.md` and `git diff` to see whether the failure is local to Step $X.Y$ or caused by a contract mismatch in an earlier step.
2. If local to Step $X.Y$: reset uncommitted broken files in Step $X.Y$'s owned paths and re-summon the same subagent with the failed test output appended to its prompt.
3. If caused by an upstream schema/contract omission: summon `SA-ARCH` for a targeted hotfix on `schemas.py` + `terminal.ts`, re-run upstream tests, then resume Step $X.Y$.

---

## 5. Cross-Document Integrity Audit (`.agents/execution_plan/EXECUTION_PLAN.md` $\leftrightarrow$ `.agents/subagents/SUBAGENTS.md` $\leftrightarrow$ `skills/`)

Every file in the canonical monorepo tree (`.agents/execution_plan/EXECUTION_PLAN.md` Section 2) and every sequential step (`1.1` through `5.2`) has been verified for complete, non-overlapping subagent ownership and targeted skill support:

| Monorepo Path Group | Assigned Owner | Assigned Skill(s) | Step Created / Completed | Conflict / Gap Check |
| --- | --- | --- | --- | --- |
| `.gitignore`, `.env.example`, `PROGRESS_LOG.md`, `pyproject.toml`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `config.py` | `SA-ARCH` | — | Step 1.1 | Zero overlap; initialized first |
| `backend/app/schemas.py`, `backend/app/db/schema.sql`, `frontend/src/types/terminal.ts`, `test_schemas.py` | `SA-ARCH` | — | Step 1.2 | Immutable upstream contract for Phases 2–4 |
| `backend/app/db/repository.py`, `test_repository.py` | `SA-INGEST` | `exchange-stream-quirks` | Step 2.1 | Clean async boundary for persistence |
| `backend/app/connectors/{base,binance,bybit}.py`, `engine/{state,whale_aggregator}.py`, `test_connectors_normalization.py` | `SA-INGEST` | `exchange-stream-quirks` | Step 2.2 | Side polarity & Bybit kline sort guarded |
| `backend/app/engine/{options_quant,liquidations}.py`, `test_quant_engines.py` | `SA-QUANT` | `derivatives-quant-formulas` | Step 2.3 | Zero I/O pure math module ownership |
| `backend/app/connectors/deribit.py` + state/test extensions | `SA-INGEST` | `exchange-stream-quirks` | Step 2.4 | Consumes `SA-QUANT` pure functions cleanly |
| `backend/app/api/{ws_hub,routes}.py`, `backend/app/main.py`, `test_api_and_ws.py` | `SA-API` | — | Step 2.5 | Orchestrates completed Phase 2 modules |
| `frontend/src/styles/tokens.css`, `utils/*`, `store/*`, `services/*`, `{timeSnap,vrvpCalc,store}.test.ts` | `SA-UI` | `anti-slop-ui-tokens`, `derivatives-quant-formulas` | Step 3.1 | Exports typed store, VRVP & token bridge |
| `frontend/src/components/{TopTelemetryBar,ControlDrawer}.tsx`, `App.tsx`, `main.tsx` | `SA-UI` | `anti-slop-ui-tokens` | Step 3.2 | Leaves clean chart host slot for `SA-CHART` |
| `frontend/src/components/UnifiedChart.tsx`, `primitives/{VRVP,WhaleBubbles,Liquidation,OptionsWalls}Primitive.ts` | `SA-CHART` | `lwc-v5-primitives`, `anti-slop-ui-tokens` | Steps 4.1, 4.2, 4.3 | Exclusive ownership of LWC v5 & Canvas 2D |
| `backend/Dockerfile`, `.dockerignore`, `fly.toml`, `netlify.toml`, `.github/workflows/ci.yml` | `SA-OPS` | — | Step 5.1 | Infra & CI isolated from app logic |
| `frontend/src/__tests__/antiSlopAudit.test.ts`, `scripts/smoke_e2e.py`, `README.md` | `SA-OPS` | `anti-slop-ui-tokens`, `lwc-v5-primitives` | Step 5.2 | End-to-end contract & design gatekeeper |