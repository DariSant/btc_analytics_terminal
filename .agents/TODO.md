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

### Phase 5: Deployment Topology, CI/CD & End-to-End Verification

- [ ] **Dockerize & Configure Fly.io (`fra`), Netlify & CI (`SA-OPS` — Step 5.1)**: Create `backend/Dockerfile`, `.dockerignore`, `fly.toml`, `netlify.toml`, and `.github/workflows/ci.yml`.
  Pin Fly.io `primary_region = "fra"` with `auto_stop_machines = "off"` and `/data` SQLite WAL mount, configure Netlify SPA redirects/security headers, and wire backend + frontend CI checks.
  Action: Implement all 5 infra/CI files and verify `fly.toml` region check plus backend/frontend test and build suites. (`.agents/execution_plan/EXECUTION_PLAN.md#L587-L612`)

- [ ] **Build Full-Stack Smoke Harness & Anti-Slop Audit (`SA-OPS` — Step 5.2)**: Create `frontend/src/__tests__/antiSlopAudit.test.ts`, `scripts/smoke_e2e.py`, and root `README.md`.
  Enforce zero banned CSS/Tailwind tokens, all 4 theme hex palettes, `tabular-nums`, `40px`/`260px` geometry, and zero LWC v4 calls, plus verify FastAPI REST and `/ws/btc` `set_timeframe` end-to-end.
  Action: Implement audit test, smoke script, and runbook, then run full backend, frontend, and `python scripts/smoke_e2e.py` verification. (`.agents/execution_plan/EXECUTION_PLAN.md#L613-L635`)
