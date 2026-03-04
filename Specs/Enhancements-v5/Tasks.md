# Enhancements-v5 Tasks

## Phase 0 — Spec Scaffold
- [x] Create `Specs/Enhancements-v5/Requirements.md`
- [x] Create `Specs/Enhancements-v5/Design.md`
- [x] Create `Specs/Enhancements-v5/Tasks.md`

## Phase 1 — Mobile Navigation Redesign
- [x] Move mobile trigger to left side in header
- [x] Open drawer from left with full-screen support
- [x] Add full nav list and move logout to drawer bottom
- [x] Improve touch target sizing and nav button layout

## Phase 2 — WoW/MoM Desktop UX + Group Summaries
- [x] Fix toggle spacing and border style
- [x] Use `-` / `+` collapse indicators
- [x] Show collapsed warehouse summary totals
- [x] Filter WoW/MoM by dashboard `from/to` range

## Phase 3 — Refresh Tooltip + Chart Layering
- [x] Add refresh tooltip text for 2-hour auto refresh
- [x] Render line series above bars in chart

## Phase 4 — Raw Delivery Stages Reliability
- [x] Add API fallback from `v_raw_delivery_stages_with_source` to `v_raw_delivery_stages`
- [x] Return `timingSourceSupported` and optional warning
- [x] Gracefully handle timing-source filter/column in UI

## Phase 5 — Ingest Health Stability Cleanup
- [x] Return safe empty payload when observability objects are missing
- [x] Keep dashboard ingest widget non-blocking

## Verification
- [x] `npm run build`
- [x] `npm run validate`
- [x] `npm run test:run`
- [x] `npm run test:integration`
- [x] `npm run type-check`
- [x] `npm run lint`
