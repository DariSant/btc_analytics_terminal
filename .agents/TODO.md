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

- *All planned tasks in `.agents/execution_plan/EXECUTION_PLAN.md` (Phases 1–5) are complete.*

## P2 — Soon / Medium Priority

### Release & Production Deployment

- [ ] **Deploy Production Stack (`fra` + Netlify)**: Provision Fly.io Frankfurt volume and Netlify environment variables.
  Create `btc_terminal_data` in `fra`, set `CORS_ORIGINS`, deploy single-machine (`--ha=false`), and configure `VITE_API_URL` / `VITE_WS_URL` on Netlify.
  Action: Follow the Production Deployment steps in `README.md` (`fly volumes create ...`, `fly deploy --config fly.toml --ha=false`). (`README.md`)
