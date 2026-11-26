# AGENTS.md — Workspace Operating Rules

## 1. Communication Style

- Be concise, direct, and self-explanatory; always prioritize brevity over prose.
- Lead with outcomes, file paths, verification status, or blockers—zero filler.

## 2. Workspace Context & File Map

Antigravity auto-loads `.agents/AGENTS.md` (always-on) and `.agents/skills/*/SKILL.md` (on-demand). Before acting, orient yourself in this order:

## Workspace Context & File Map

Before acting, orient yourself in this order:

1. [`.agents/PROJECT_HISTORY.md`](.agents/PROJECT_HISTORY.md) — Recent completed milestones and active architectural context.
2. [`.agents/TODO.md`](.agents/TODO.md) — Current execution step and immediate next tasks.
3. [`.agents/execution_plan/SUMMARY.md`](.agents/execution_plan/SUMMARY.md) — **Read this summary first** to locate the active phase/step, then read **only the relevant section(s)** of [`.agents/execution_plan/EXECUTION_PLAN.md`](.agents/execution_plan/EXECUTION_PLAN.md).
4. [`.agents/subagents/SUBAGENTS.md`](.agents/subagents/SUBAGENTS.md) — Subagent roles, ownership boundaries, and CLI gates.

## 3. Ambiguities & Irreversible Actions

- **Never guess.** If requirements, schemas, or edge cases are ambiguous or incomplete, stop and ask concise clarifying questions.
- Wait for explicit user confirmation before executing irreversible, destructive, or architecture-altering actions.

## 4. State Tracking (`TODO.md` & `PROJECT_HISTORY.md`)

- **`TODO.md` (Live):** Mark a task complete (`[x]`) in `.agents/TODO.md` immediately after its verification commands pass. Do not delete completed items mid-session.
- **`PROJECT_HISTORY.md` (Gated):** Do **not** edit `.agents/PROJECT_HISTORY.md` during normal task execution. Update it **only** when `/wrap_up` is triggered.

## 5. `/wrap_up` Protocol

When the user runs `/wrap_up`, execute this exact sequence:

1. Append a concise entry to `.agents/PROJECT_HISTORY.md` (date, completed plan steps, key decisions, next step).
2. Clean `.agents/TODO.md` by deleting all completed (`[x]`) tasks and queuing the next step's tasks from `.agents/execution_plan/SUMMARY.md` / `.agents/execution_plan/EXECUTION_PLAN.md`.
3. Run `git status` and verify zero secret or `.env` leaks.
4. If advisable, recommend a `git commit` and ask whether any newly discovered project norm should be added to `.agents/AGENTS.md`.

## 6. Free-First Data & Engineering Resourcefulness

- Maximize data completeness and terminal capabilities at **$0 API cost** using public endpoints, multi-venue fallbacks, caching, and analytical derivations (e.g., local Greeks, client-side aggregation).
- Never introduce paid APIs, proprietary SDKs, or external SaaS dependencies unless explicitly requested by the user.

## 7. Security, Git & Rule Updates

- **Zero Secrets:** Never write, log, or stage API keys, tokens, credentials, or `.env` files. Inspect diffs before any commit.
- **User-Gated Commits:** Never run `git commit` or `git push` autonomously. Propose a commit when a clean milestone is reached and wait for the user's green light.
- **Evolving `AGENTS.md`:** Propose high-value norms or constraints for `.agents/AGENTS.md` when discovered, but **ask the user first** and keep any approved addition short and compliant with these rules.

## 8. Milestone Verification & User Checkpoints

- **Gate Verification:** Run all applicable automated tests, typechecks, and linters (`pytest`, `ruff`, `mypy`, `tsc --noEmit`, `vitest`, `npm run build`) at every gate, milestone, and relevant build.
- **Plain-Language Verification Guide:** After each milestone or relevant build, explain in plain language what was built and give concrete steps for the user to verify it—especially for UI builds (how to run/preview, what layout, themes, toggles, and live behaviors to inspect).


## 9. Multi-Agent & `/swarm` Workflow

The orchestrator triggers parallel multi-agent execution **automatically** whenever a task benefits from concurrent workstreams (e.g., independent `backend/`, `frontend/`, `ops/` slices, or multi-angle audits/reviews); otherwise it uses single-agent or sequential execution per [`.agents/subagents/SUBAGENTS.md`](.agents/subagents/SUBAGENTS.md).

- **Execution Mechanism (Auto vs. `/swarm`):**
  - **Automatic Orchestration (Default):** When the orchestrator determines parallel delegation is needed without an active `/swarm`, launch concurrent workers automatically via `invoke_subagent` (for distinct parallel roles) or `run_workflow` (for programmatic `parallel` / `pipeline` fan-outs).
  - **Board `/swarm` Mode:** Use the `swarm` board tool whenever `/swarm` is active (or explicitly invoked/instructed by a skill).
- **Coordinator Authority:** The coordinator owns task slicing, worker briefs, locking wire contracts (`backend/app/schemas.py` <-> `frontend/src/types/terminal.ts`) before fanning out writers, landing changes, `.agents/TODO.md` updates, `.agents/PROJECT_HISTORY.md` (via `/wrap_up` only), and final Section 8 verification. Workers never edit `.agents/TODO.md`, `.agents/PROJECT_HISTORY.md`, or run `git commit`/`git push`.
- **Workspace & Ownership Isolation:**
  - Spawn concurrent writers/builders with `workspace: "share"` and strictly non-overlapping file ownership.
  - Spawn read-only auditors, researchers, and verifiers with `workspace: "inherit"`.
- **Worker Brief Standard:** Every worker prompt/brief must specify: (1) required context (`SUMMARY.md` + target `EXECUTION_PLAN.md` lines and relevant skills), (2) owned file paths, (3) hard guardrails (no unowned edits, no `# type: ignore`/`as any`, no blocking foreground servers, zero secrets), and (4) exact verification commands defining "done".
- **Standard Execution Flow:**
  4. **Assess & Slice:** Decide automatically whether parallel execution saves time/risk; if so, lock shared contracts first and assign disjoint scopes.
  5. **Parallel Build / Audit:** Run workers concurrently within their owned paths and self-verify.
  6. **Land & Gate:** Integrate/merge all worker changes into the primary working copy **before** tearing down workers (`kill` in `/swarm`), then run full Section 8 gates across the integrated codebase.
  7. **Report:** Summarize landed changes, gate results, and a plain-language verification guide for the user.
