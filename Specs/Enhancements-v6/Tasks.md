# Enhancements-v6 Tasks

## Phase 0 - Spec Scaffold
- [x] Create `Specs/Enhancements-v6/Requirements.md`
- [x] Create `Specs/Enhancements-v6/Design.md`
- [x] Create `Specs/Enhancements-v6/Tasks.md`
- [x] Create `Specs/Enhancements-v6/Metric-Dictionary.md`

## Phase 2 - Exceptions data foundation
- [x] Add migration for exception event/action tables and summary views
- Note: Created `supabase/migrations/20260305114000_v6_exceptions_foundation.sql`.

## Phase 2 - Exceptions API + page + charts
- [x] Add `/api/exceptions` endpoint
- [x] Add `/exceptions` page with trend/aging/table components
- Note: Added `app/api/exceptions/route.ts`, `app/exceptions/page.tsx`, `components/charts/exceptions-trend.tsx`, `components/tables/exceptions-table.tsx`.

## Phase 3 - Promise reliability data foundation
- [x] Add migration/views for promise reliability metrics
- Note: Created `supabase/migrations/20260305115000_v6_promise_reliability_foundation.sql`.

## Phase 4 - Promise reliability API + page + charts
- [x] Add `/api/promise-reliability` endpoint
- [x] Add `/promise-reliability` page with trend/distribution/table components
- Note: Added `app/api/promise-reliability/route.ts`, `app/promise-reliability/page.tsx`, `components/charts/promise-reliability-trend.tsx`, `components/charts/eta-error-distribution.tsx`, `components/tables/promise-reliability-table.tsx`.

## Phase 5 - Route efficiency data foundation
- [x] Add migration/views for route efficiency metrics
- Note: Created `supabase/migrations/20260305120000_v6_route_efficiency_foundation.sql`.

## Phase 6 - Route efficiency API + page + charts
- [x] Add `/api/route-efficiency` endpoint
- [x] Add `/route-efficiency` page with chart/table components
- Note: Added `app/api/route-efficiency/route.ts`, `app/route-efficiency/page.tsx`, `components/charts/route-efficiency-scatter.tsx`, `components/charts/dwell-trend.tsx`, `components/tables/route-efficiency-table.tsx`.

## Phase 7 - Docs + tests + task tracking
- [x] Extend export API and CSV headers for new datasets
- [x] Update navigation links for newly added pages
- [x] Update README feature inventory references
- [x] Extend test scripts for new routes/exports
- Note: Updated `components/layout/nav.tsx`, `app/api/export/csv/route.ts`, `README.md`, `scripts/tests/run.js`, `scripts/tests/integration.js`.

## Phase 8 - City Performance Fix + Rename (NEW)
- [x] Add city-first performance migration and compatibility view
- [x] Update `/api/zone-performance` aggregation to city-first behavior
- [x] Rename Zone terminology to City in page + navigation + export label
- Note: Implemented in `supabase/migrations/20260305113000_v6_city_performance_fix.sql`, `app/api/zone-performance/route.ts`, `app/zone-performance/page.tsx`, `components/layout/nav.tsx`, `app/api/export/csv/route.ts`.

## Phase 10 - Validation commands (required order)
- [x] `npm run build`
- [x] `npm run validate`
- [x] `npm run test:run`
- [x] `npm run test:integration`
- [x] `npm run type-check`
- [x] `npm run lint`
- Note: Full sequence passed on 2026-03-04 after fixing hook lint violations in new pages.
