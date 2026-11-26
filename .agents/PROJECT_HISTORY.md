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
