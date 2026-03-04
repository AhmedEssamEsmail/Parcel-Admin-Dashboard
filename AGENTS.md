# Agent Instructions (AGENTS.md)

Follow this policy for all work in this repository.

## 1) Plan / Act Workflow

### Plan Mode (design only)
- Only analyze and design.
- Produce a clear, numbered implementation plan.
- List exact files to modify.
- Describe the intended change per file.
- List commands to run for validation.
- Do **not** modify files in Plan mode.
- Do **not** generate full code in Plan mode unless explicitly requested.

### Act Mode (execution only)
- Execute the approved plan exactly.
- Do not redesign architecture.
- Keep changes minimal.
- Modify only files listed in the plan.
- Before starting each task/subtask, state: **task/subtask number + name**.

If execution fails:
1. Explain the error.
2. Propose a fix.
3. Continue execution after confirmation.

## 2) Context Policy (minimize loaded context)
When executing tasks:
- Load only the files required for the current step.
- Do not load the entire repository.
- Prefer targeted search before reading files.
- Read at most **3 related files** at a time.

Workflow:
1. Search for relevant symbols/filenames.
2. Open only the necessary file(s).
3. Implement the change.
4. Continue to the next step.

## 3) Database Changes (do not touch main schema)
When you need to change the database schema:
- **DO NOT** edit the main schema file directly.
- **ALWAYS** create a **new migration file** with only the required changes.
- Keep migrations small, single-purpose, and reversible (include down/rollback if supported).
- Name migrations clearly (timestamp + short description) and place them in the migrations folder.

Workflow:
1. Search repo for migration patterns and migrations folder.
2. Open only the minimum necessary files (existing migrations/config/schema references).
3. Implement the change as a new migration file (include rollback/down if applicable).
4. Validate by running migration command(s) and ensuring app/tests compile/run.
5. Continue only after migration succeeds.

## 4) Always Double Check (verification gate)
After completing any phase, task group, or implementation step, verify there are no errors before proceeding.

Run these commands in order:
- npm run build
- npm run validate
- npm run test:run
- npm run test:integration
- npm run type-check
- npm run lint

Expected result: all commands pass with no errors.

Failure handling:
1. Stop.
2. Identify the failing command.
3. Analyze error output.
4. Fix the issue.
5. Re-run the full verification sequence.

A phase is complete only when all checks succeed.

## 5) Update tasks.md after each task/subtask
The Act agent must keep `tasks.md` synchronized with real progress.

After completing each task/subtask from a spec `Tasks.md`:
1. Find the item in `tasks.md`.
2. Mark it complete (e.g., `[ ]` → `[x]`).
3. Add a short note if relevant (files modified, migrations created, commands executed).
4. Save `tasks.md`.

Do not mark anything complete until verification checks pass.
After updating `tasks.md`, continue with the next unfinished item.