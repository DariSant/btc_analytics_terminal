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

- [ ] **Build LWC v5.3+ Core Host (`SA-CHART` — Step 4.1)**: Create `frontend/src/components/UnifiedChart.tsx` and mount it in `frontend/src/App.tsx`.
  Use strict LWC v5 `addSeries(CandlestickSeries, ...)` and bottom `18%` `HistogramSeries` volume pane, imperative Zustand subscriptions (`.setData()` vs. `.update()`), `ResizeObserver`, and dynamic 4-theme updates without chart recreation.
  Action: Read `.agents/skills/lightweight_charts_v5_primitives/` and `.agents/skills/institutional_anti_slop_ui_theme_tokens/`, implement `UnifiedChart.tsx`, mount in `App.tsx`, and verify `cd frontend && npx tsc --noEmit && npm run build`. (`.agents/execution_plan/EXECUTION_PLAN.md#L512-L533`)

- [ ] **Build `VRVPPrimitive` & `WhaleBubblesPrimitive` (`SA-CHART` — Step 4.2)**: Implement `frontend/src/primitives/VRVPPrimitive.ts` and `frontend/src/primitives/WhaleBubblesPrimitive.ts` and attach them in `UnifiedChart.tsx`.
  Render right-docked 80-bin VRVP (`POC`/`VAH`/`VAL`) and area-scaled multi-venue whale bubbles ($R \in [4, 28]$) with crosshair hover HUD inside `useMediaCoordinateSpace`.
  Action: Implement both `ISeriesPrimitive<Time>` classes, wire toggles/min-USD filters, and verify `cd frontend && npx tsc --noEmit && npx vitest run && npm run build`. (`.agents/execution_plan/EXECUTION_PLAN.md#L536-L556`)

- [ ] **Build `LiquidationPrimitive` & `OptionsWallsPrimitive` (`SA-CHART` — Step 4.3)**: Implement `frontend/src/primitives/LiquidationPrimitive.ts` and `frontend/src/primitives/OptionsWallsPrimitive.ts` and attach them in `UnifiedChart.tsx`.
  Render unmitigated predictive leverage bands, hollow diamond/`x` realized liquidations, expiry-filtered Call/Put Walls, Max Pain ray, and left-edge top-5 GEX micro-bars.
  Action: Implement both primitives, wire expiry/layer/theme updates, and verify `cd frontend && npx tsc --noEmit && npx vitest run && npm run build`. (`.agents/execution_plan/EXECUTION_PLAN.md#L559-L581`)
