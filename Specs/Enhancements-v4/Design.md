# Enhancements-v4 Design

## Phase 0 (current)
Create v4 spec artifacts and task tracker.

## Architecture Notes
- Keep schema changes only in new migration files.
- Keep upload correction logic in code normalizer (not DB trigger).
- Add additive API fields/endpoints only.

## Planned Phases
1. Parcel Logs fill-forward + warnings.
2. Ingest observability tables/API/UI widget.
3. Data-quality guardrails and filters.
4. Performance indexes/RPC fast paths.
5. UX polish.
6. Ops runbook + metric dictionary.
