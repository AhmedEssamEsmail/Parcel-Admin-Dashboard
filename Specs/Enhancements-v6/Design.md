# Enhancements-v6 Design

## Overview
Enhancements-v6 is executed in 8 phases. The first delivery focus is City Performance correctness and naming consistency, followed by three new operational intelligence modules.

## Phase Plan (8 phases)
1. **Phase 0 - Spec Scaffold**
   - Create v6 requirements/design/tasks/metric dictionary docs.
2. **Phase 1 - City Performance Data + Naming Fix**
   - Ensure API groups by `city` first (with normalized fallback), not `zone`.
   - Keep route compatibility (`/zone-performance`, `/api/zone-performance`) while exposing City terminology in UI.
3. **Phase 2 - Exceptions Control Tower**
   - Add exceptions migration + API + page + chart/table components.
4. **Phase 3 - Promise Reliability**
   - Add promise reliability views + API + page + chart/table components.
5. **Phase 4 - Route Efficiency**
   - Add route efficiency views + API + page + chart/table components.
6. **Phase 5 - Exports + Navigation + Docs**
   - Extend CSV export routing/headers and navigation labels.
   - Update README references and feature inventory.
7. **Phase 6 - Verification Gate**
   - Run full required command sequence and fix failures.
8. **Phase 7 - Final Task Sync + Handoff**
   - Sync v6 task checklist to actual completion and summarize outputs.

## City Performance Fix Details (Phase 1)
- Keep upstream table/view contracts stable, but apply city-first aggregation in API:
  - Primary key: normalized `city`
  - Secondary grouping for drill-down: `area`
  - Fallback label only when city is truly null/empty/placeholder.
- Rename page text:
  - `Zone Performance` -> `City Performance`
  - `Top Performing Zones` -> `Top Performing Cities`
  - `Zone Drill-Down` -> `City Drill-Down`
  - Column label `Zone` -> `City`
  - Export button `Export Zone Data` -> `Export City Data`

## Validation
Run in order:
1. `npm run build`
2. `npm run validate`
3. `npm run test:run`
4. `npm run test:integration`
5. `npm run type-check`
6. `npm run lint`
