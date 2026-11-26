# Execution Plan Summary & Navigation Index

> **Agent Instruction:** Always read this summary first to orient yourself, then read **only the relevant section(s)** of [EXECUTION_PLAN.md](EXECUTION_PLAN.md) using the line-range links below. Do **not** read the entire execution plan on every task.

---

## 1. Executive Overview & Governance ([Section 1](EXECUTION_PLAN.md#L3-L52))
- **Product Scope & Core Mandates** ([1.1](EXECUTION_PLAN.md#L5-L14)): Read-only `BTCUSDT` perpetuals (Binance Futures, Bybit V5) + `BTC` options (Deribit) SPA; `100vh × 100vw` viewport lock; single Lightweight Charts v5.3+ instance; institutional zero-slop UI.
- **Architectural Decision Records (ADRs)** ([1.2](EXECUTION_PLAN.md#L15-L29)):
  - `ADR-01`: Fly.io (`fra` Frankfurt) + persistent volume SQLite (`aiosqlite` WAL mode).
  - `ADR-02`: Hybrid REST backfill + multiplexed `/ws/btc` with client `set_timeframe`.
  - `ADR-03`: Pure-Python analytical Black-76 Gamma & standard dealer GEX sign (`+Call` / `-Put`).
  - `ADR-04`: OI-weighted swing leverage projections (`10x`, `25x`, `50x`, `100x`) with auto-mitigation & left-docked `16px` thermal bar + tag-free intensity-scaled peak projections.
  - `ADR-05`: Per-venue `100ms` whale burst aggregation & custom `ISeriesPrimitive` bubbles.
  - `ADR-06`: Client-side 80-bin VRVP & `00:00 UTC` taker-buy backfilled Session CVD.
  - `ADR-07`: Standardized `40px` header strip & `calc(100vh - 40px)` canvas.
- **Subagent Roster** ([1.3](EXECUTION_PLAN.md#L30-L44)): `SA-ARCH`, `SA-INGEST`, `SA-QUANT`, `SA-API`, `SA-UI`, `SA-CHART`, `SA-OPS` (see [SUBAGENTS.md](../subagents/SUBAGENTS.md)).
- **Sequential Execution & Handoff Rules** ([1.4](EXECUTION_PLAN.md#L45-L52)): Strict CLI gatekeeping, file ownership boundaries, zero placeholder rule, `PROGRESS_LOG.md` handoff.

## 2. Canonical Monorepo Directory Topology ([Section 2](EXECUTION_PLAN.md#L53-L144))
- Full `btc-terminal/` folder structure across `.github/workflows/`, `backend/`, and `frontend/`.

## 3. Data Contracts, Exchange Normalization & Quant Specs ([Section 3](EXECUTION_PLAN.md#L145-L273))
- **External Exchange Endpoints & Traps** ([3.1](EXECUTION_PLAN.md#L147-L190)):
  - Binance USDS-M Futures ([A](EXECUTION_PLAN.md#L150-L167))
  - Bybit V5 Linear Perpetuals ([B](EXECUTION_PLAN.md#L168-L182))
  - Deribit Public Options API v2 ([C](EXECUTION_PLAN.md#L183-L190))
- **Quantitative Engine Formulas** ([3.2](EXECUTION_PLAN.md#L191-L239)):
  1. Session CVD `00:00 UTC` Anchor ([Formula 1](EXECUTION_PLAN.md#L193-L199))
  2. Per-Venue `100ms` Whale Burst Aggregation ([Formula 2](EXECUTION_PLAN.md#L200-L209))
  3. Predictive Liquidation Clusters & Sweep Mitigation ([Formula 3](EXECUTION_PLAN.md#L210-L219))
  4. Deribit Options: Black-76 Gamma, Net GEX, Walls & Max Pain ([Formula 4](EXECUTION_PLAN.md#L220-L230))
  5. Client-Side 80-Bin VRVP ([Formula 5](EXECUTION_PLAN.md#L231-L239))
- **SQLite WAL Schema & Retention** ([3.3](EXECUTION_PLAN.md#L240-L249))
- **REST & `/ws/btc` Wire Contracts** ([3.4](EXECUTION_PLAN.md#L250-L273)): REST routes ([L252-L258](EXECUTION_PLAN.md#L252-L258)) and WebSocket messages ([L259-L273](EXECUTION_PLAN.md#L259-L273)).

## 4. Anti-Slop Design System & Viewport Geometry ([Section 4](EXECUTION_PLAN.md#L274-L303))
- **Viewport Lock (`100vh × 100vw`)** ([4.1](EXECUTION_PLAN.md#L276-L282))
- **4-Theme CSS Custom Property Matrix** ([4.2](EXECUTION_PLAN.md#L283-L296))
- **Strict Typography & Visual Prohibition Rules** ([4.3](EXECUTION_PLAN.md#L297-L303))

## 5. Phased Sequential Execution Plan ([Section 5](EXECUTION_PLAN.md#L304-L634))

| Phase | Step | Title & Owner | Plan Lines |
| :--- | :--- | :--- | :--- |
| **Phase 1: Foundation** | **1.1** | Monorepo Scaffolding & Strict Toolchains (`SA-ARCH`) | [L310–L329](EXECUTION_PLAN.md#L310-L329) |
| | **1.2** | Canonical Data Contracts, SQLite DDL & TS Mirrors (`SA-ARCH`) | [L330–L348](EXECUTION_PLAN.md#L330-L348) |
| **Phase 2: Backend & Quant** | **2.1** | Async SQLite WAL Repository & Rolling Retention (`SA-INGEST`) | [L351–L368](EXECUTION_PLAN.md#L351-L368) |
| | **2.2** | Binance & Bybit Connectors, Whale Aggregator & CVD (`SA-INGEST`) | [L369–L393](EXECUTION_PLAN.md#L369-L393) |
| | **2.3** | Black-76 Options Quant Engine & Liquidation Clusters (`SA-QUANT`) | [L394–L419](EXECUTION_PLAN.md#L394-L419) |
| | **2.4** | Deribit 60s Poller & Tier-2 Snapshot Integration (`SA-INGEST`) | [L420–L437](EXECUTION_PLAN.md#L420-L437) |
| | **2.5** | FastAPI Lifecycle, REST Backfill & `/ws/btc` Hub (`SA-API`) | [L438–L459](EXECUTION_PLAN.md#L438-L459) |
| **Phase 3: Frontend Shell** | **3.1** | 4-Theme Token Engine, Store & WS/REST Sync (`SA-UI`) | [L462–L486](EXECUTION_PLAN.md#L462-L486) |
| | **3.2** | `100vh` Zero-Scroll Shell: `40px` Header & `260px` Drawer (`SA-UI`) | [L487–L509](EXECUTION_PLAN.md#L487-L509) |
| **Phase 4: Charting** | **4.1** | LWC v5.3+ Core Host, Volume Split & Live Sync (`SA-CHART`) | [L512–L535](EXECUTION_PLAN.md#L512-L535) |
| | **4.2** | Primitives Part 1: `VRVPPrimitive` & `WhaleBubblesPrimitive` (`SA-CHART`) | [L536–L558](EXECUTION_PLAN.md#L536-L558) |
| | **4.3** | Primitives Part 2: `LiquidationPrimitive` (`16px` Thermal Strip + Peaks) & `OptionsWallsPrimitive` (`SA-CHART`) | [L559–L583](EXECUTION_PLAN.md#L559-L583) |
| **Phase 5: Ops & QA** | **5.1** | Dockerization, Fly.io (`fra`), Netlify & CI Pipeline (`SA-OPS`) | [L587–L612](EXECUTION_PLAN.md#L587-L612) |
| | **5.2** | Full-Stack Smoke Harness & Anti-Slop Design Audit (`SA-OPS`) | [L613–L635](EXECUTION_PLAN.md#L613-L635) |

## 6. Architecture & Completeness Self-Audit Matrix ([Section 6](EXECUTION_PLAN.md#L636-L651))
- Verification checklist mapping ADRs, endpoints, and primitives to implementation steps.
