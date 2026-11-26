# TODO

<!--
Standardized TODO Format Specification:
- Hierarchical subdivisions:
  1. Priority Tier: ## P1 — Immediate / High Priority | ## P2 — Soon / Medium Priority | ## P3 — Low / Backlog
  2. Functional Area: ### <Area / Module / Section>
- Strict Task Schema:
  - Header line: - [ ] **<Actionable Title>**: <Current state, problem, or objective>.
  - Body line:   <Short body text explanation detailing why, impact, or key context>.
  - Action line: Action: <Specific steps to execute or verify>. (`path/to/relevant_file_or_context`)
- Task Lifecycle Rule:
  When completed, extract durable operational knowledge to permanent documentation (e.g., PROJECT_GUIDELINES.md)
  and remove finished/obsolete tasks from this file to prevent clutter.
-->

## P1 — Immediate / High Priority

### Phase 1: Workspace Foundation & Cross-Stack Contracts (Step 1.1)

- [ ] **Scaffold Backend Python 3.12 Toolchain (`SA-ARCH`)**: Initialize `backend/pyproject.toml` and `backend/app/config.py`.
  Pin FastAPI, Uvicorn, WebSockets, httpx, aiosqlite, Pydantic, pytest, ruff, and mypy, and define `Settings(BaseSettings)` for exchange URLs, thresholds, and retention.
  Action: Create `backend/pyproject.toml`, `backend/app/__init__.py`, and `backend/app/config.py`, install dev dependencies, and run `cd backend && ruff check . && mypy app`. (`.agents/execution_plan/EXECUTION_PLAN.md#L310-L329`)

- [ ] **Scaffold Frontend React 19 + Vite + LWC v5 Toolchain (`SA-ARCH`)**: Initialize `frontend/package.json`, `tsconfig.json`, `vite.config.ts`, and `index.html`.
  Pin React 19, `lightweight-charts@^5.3.0`, Zustand, Tailwind v4, TypeScript, and Vitest; configure Inter & JetBrains Mono fonts and `data-theme="oled-dark"`.
  Action: Create frontend config files, run `npm install`, and verify `cd frontend && npx tsc --noEmit`. (`.agents/execution_plan/EXECUTION_PLAN.md#L310-L329`)

- [ ] **Create `.env.example` & `PROGRESS_LOG.md` (`SA-ARCH`)**: Document `VITE_API_URL` and `VITE_WS_URL` and initialize the subagent handoff log.
  Required by Step 1.1 pass/fail criteria and sequential handoff governance.
  Action: Create `.env.example` and `PROGRESS_LOG.md` at the repository root. (`.agents/execution_plan/EXECUTION_PLAN.md#L313-L326`)
