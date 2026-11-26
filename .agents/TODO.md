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

### Phase 4: Unified Lightweight Charts v5 Host & Canvas Primitives

- [x] **Build LWC v5.3+ Core Host (`SA-CHART` — Step 4.1)**: Create `frontend/src/components/UnifiedChart.tsx` and mount it in `frontend/src/App.tsx`.
  Use strict LWC v5 `addSeries(CandlestickSeries, ...)` and bottom `18%` `HistogramSeries` volume pane, imperative Zustand subscriptions (`.setData()` vs. `.update()`), `ResizeObserver`, and dynamic 4-theme updates without chart recreation.
  Action: Read `.agents/skills/lightweight_charts_v5_primitives/` and `.agents/skills/institutional_anti_slop_ui_theme_tokens/`, implement `UnifiedChart.tsx`, mount in `App.tsx`, and verify `cd frontend && npx tsc --noEmit && npm run build`. (`.agents/execution_plan/EXECUTION_PLAN.md#L512-L533`)

- [x] **Build `VRVPPrimitive` & `WhaleBubblesPrimitive` (`SA-CHART` — Step 4.2)**: Implement `frontend/src/primitives/VRVPPrimitive.ts` and `frontend/src/primitives/WhaleBubblesPrimitive.ts` and attach them in `UnifiedChart.tsx`.
  Render right-docked 80-bin VRVP (`POC`/`VAH`/`VAL`) and area-scaled multi-venue whale bubbles ($R \in [4, 28]$) with crosshair hover HUD inside `useMediaCoordinateSpace`.
  Action: Implement both `ISeriesPrimitive<Time>` classes, wire toggles/min-USD filters, and verify `cd frontend && npx tsc --noEmit && npx vitest run && npm run build`. (`.agents/execution_plan/EXECUTION_PLAN.md#L536-L556`)

- [x] **Build `LiquidationPrimitive` & `OptionsWallsPrimitive` (`SA-CHART` — Step 4.3)**: Implement `frontend/src/primitives/LiquidationPrimitive.ts` and `frontend/src/primitives/OptionsWallsPrimitive.ts` and attach them in `UnifiedChart.tsx`.
  Render a `16px` left-docked vertical thermal bar showing continuous liquidation density across every price level, tag-free horizontal Canvas heat projections expanding rightward from the left margin with both strength and length scaled by liquidation intensity, hollow diamond/`x` realized liquidations, expiry-filtered Call/Put Walls, Max Pain ray, and top-5 GEX micro-bars offset cleanly from the left bar.
  Action: Implement both primitives, wire expiry/layer/theme updates, and verify `cd frontend && npx tsc --noEmit && npx vitest run && npm run build`. (`.agents/execution_plan/EXECUTION_PLAN.md#L559-L583`)

### Phase 5: Deployment Topology, CI/CD & End-to-End Verification

- [ ] **Dockerize & Configure Fly.io (`fra`), Netlify & CI (`SA-OPS` — Step 5.1)**: Create `backend/Dockerfile`, `.dockerignore`, `fly.toml`, `netlify.toml`, and `.github/workflows/ci.yml`.
  Pin Fly.io `primary_region = "fra"` with `auto_stop_machines = "off"` and `/data` SQLite WAL mount, configure Netlify SPA redirects/security headers, and wire backend + frontend CI checks.
  Action: Implement all 5 infra/CI files and verify `fly.toml` region check plus backend/frontend test and build suites. (`.agents/execution_plan/EXECUTION_PLAN.md#L587-L612`)

- [ ] **Build Full-Stack Smoke Harness & Anti-Slop Audit (`SA-OPS` — Step 5.2)**: Create `frontend/src/__tests__/antiSlopAudit.test.ts`, `scripts/smoke_e2e.py`, and root `README.md`.
  Enforce zero banned CSS/Tailwind tokens, all 4 theme hex palettes, `tabular-nums`, `40px`/`260px` geometry, and zero LWC v4 calls, plus verify FastAPI REST and `/ws/btc` `set_timeframe` end-to-end.
  Action: Implement audit test, smoke script, and runbook, then run full backend, frontend, and `python scripts/smoke_e2e.py` verification. (`.agents/execution_plan/EXECUTION_PLAN.md#L613-L635`)
