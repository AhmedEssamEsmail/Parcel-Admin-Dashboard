# Enhancements-v7 Tasks

## Phase 1 - Scope alignment
- [x] Replace v7 city task with area-label troubleshooting task
- [x] Keep remaining requested scope items unchanged
- Note: Created/updated this task list to reflect the user-requested replacement task.

## Phase 2 - City Performance area-label fix
- [x] Troubleshoot why City Performance tables show warehouse/country labels (Qatar/UAE/Bahrain/Jeddah/Kuwait)
- [x] Update City Performance aggregation/display logic to show area-level labels where city is generic
- [x] Confirm top/bottom/drill-down tables render area names correctly
- Note: Updated `app/api/zone-performance/route.ts` and `app/zone-performance/page.tsx` to prefer area labels when city labels are generic warehouse/country aliases.

## Phase 3 - WoW grouped totals row behavior
- [x] Show grouped-warehouse totals in the same row as the warehouse group header
- [x] Remove separate totals row for collapsed groups
- Note: Updated `components/tables/wow-mom-table.tsx` and related styling in `app/globals.css`.

## Phase 4 - Dashboard cleanup
- [x] Remove "Ingestion Health (7d)" section from dashboard
- [x] Remove now-unused dashboard ingest-health fetch/state wiring
- Note: Updated `app/dashboard/page.tsx` to remove widget render/import and ingest-health loading state/effect.

## Phase 5 - Settings sub-pages for upload/schedule
- [x] Add /settings/upload page
- [x] Add /settings/schedule page
- [x] Move navigation structure to treat Upload/Schedule as Settings sub-pages
- [x] Keep backward compatibility by redirecting /upload and /schedule to new settings sub-pages
- Note: Added `app/settings/upload/page.tsx` and `app/settings/schedule/page.tsx`, updated settings/nav pages, and redirected legacy routes in `app/upload/page.tsx` + `app/schedule/page.tsx`.

## Phase 6 - Validation (required order)
- [x] `npm run build`
- [x] `npm run validate`
- [x] `npm run test:run`
- [x] `npm run test:integration`
- [x] `npm run type-check`
- [x] `npm run lint`
- Note: Full sequence passed on 2026-03-04.
