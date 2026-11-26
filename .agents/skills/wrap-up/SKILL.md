---
name: wrap-up
description: Wrap up the work session by executing Git ingestion, pruning vestiges, updating project history and roadmap, syncing Git, and confirming completion.
---

# `/wrap-up` Command Workflow

When the user invokes `/wrap-up` or instructs to "wrap up":

1. **Pre-Wrap-Up Git Ingestion Query**:
   - Run `git status --porcelain`. If the working tree is clean, skip directly to Step 2.
   - Verify untracked files against `.gitignore` to prevent staging secrets, environment files, or scratch binaries ([Rule 1.5](../../AGENTS.md#1-core-operating-principles)).
   - Formulate a concise conventional commit message (e.g., `feat:`, `docs:`, `fix:`) reflecting the session's work.
   - Prompt the project owner to specify how changes should be processed:
     - `Push to main` (Direct push or merge current branch into `main`)
     - `Push to current branch` (`<current_branch>`)
     - `Push to new branch` (Suggest `feature/<name>` or prompt for name)
     - `Push to branch and merge into main`
     - `Commit locally only` (Stage and commit, do not push)
     - `Skip Git sync` (Leave working tree untouched)

2. **Vestige Cleanup**:
   - Identify and delete all temporary scratch scripts, unneeded logs, orphan debug files, and obsolete artifacts created during the session.

3. **Update Project History**:
   - Update [PROJECT_HISTORY.md](../../PROJECT_HISTORY.md) during wrap-up with high-level decisions and milestones that broadly affect the project.
   - Include accurate timestamp, category, concise description, and rationale.

4. **Synchronize Roadmap**:
   - Update [TODO.md](../../TODO.md). Mark completed tasks or move relevant high-level conclusions to project documentation.
   - Purge obsolete or irrelevant scratch items to prevent documentation bloat.

5. **Git Execution & Sync**:
   - If a Git action was selected in Step 1, stage verified files, commit with the agreed message, run `git pull --rebase` before pushing to avoid non-fast-forward conflicts, and execute the selected branch/push/merge sequence.

6. **Confirm Completion**:
   - Provide a concise closing summary of actions taken, files touched, and resulting Git commit hash or branch status.
