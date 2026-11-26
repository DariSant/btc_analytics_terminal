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

### Phase 3: Frontend 4-Theme Engine, Utilities, Store & WS/REST Sync (Step 3.1)

- [ ] **Implement 4-Theme Tokens, `timeSnap`, `vrvpCalc`, Store & Clients (`SA-UI`)**: Create `frontend/src/styles/tokens.css`, `utils/*`, `store/useTerminalStore.ts`, `services/*`, and Vitest suites.
  Enforce exact 4-theme CSS variables (`readThemeTokens()`), zero banned CSS/Tailwind slop, 80-bin VRVP 70% Value Area math, `snapTimestampToBar`, and AbortController/reconnect sync.
  Action: Read `skills/institutional_anti_slop_ui_theme_tokens` and `skills/derivatives_market_structure_quant_math`, build modules + tests, and run `cd frontend && npx tsc --noEmit && npx vitest run`. (`.agents/execution_plan/EXECUTION_PLAN.md#L462-L486`)

- [ ] **Assemble `100vh` Zero-Scroll Chrome (`SA-UI` — Step 3.2)**: Build `TopTelemetryBar.tsx` (`40px`), `ControlDrawer.tsx` (`260px` collapsible), `App.tsx`, and `main.tsx`.
  Wire live telemetry readouts, timeframe pills, 4-theme switcher, layer toggles, whale USD pills, and Deribit expiry selector, then verify `npm run build`. (`.agents/execution_plan/EXECUTION_PLAN.md#L487-L509`)
