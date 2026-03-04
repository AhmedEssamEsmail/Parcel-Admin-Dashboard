# Enhancements-v4 Tasks

## Phase 0 — Spec Scaffold
- [x] Create `Specs/Enhancements-v4/Requirements.md`
- [x] Create `Specs/Enhancements-v4/Design.md`
- [x] Create `Specs/Enhancements-v4/Tasks.md`
- [x] Create `Specs/Enhancements-v4/Runbook-Backfill-and-Uploads.md`
- [x] Create `Specs/Enhancements-v4/Metric-Dictionary.md`

## Phase 1 — Parcel Logs Fill-Forward
- [x] Implement blank timestamp fill-forward in `lib/ingest/normalizers/parcelLogs.ts`
- [x] Add warnings channel in ingest normalization types/flow
- [x] Surface warnings in upload page UI

## Phase 2 — Ingest Observability
- [x] Add migration for ingest run metrics tables/views
- [x] Log ingest runs in API route
- [x] Add ingest health API
- [x] Add dashboard ingest health widget

## Phase 3 — Data Quality Guardrails
- [x] Add migration for new DQ checks
- [x] Extend data-quality API filters
- [x] Add Data Quality page filters UI
- [x] Add timing-source filter support in raw delivery stages

## Phase 4 — Performance Hardening
- [x] Add migration for indexes / summary RPCs
- [x] Apply fast-path usage in WoW / DOD routes
- [x] Ensure export parity for ALL/single warehouse

## Phase 5 — UX Polish
- [x] Persist WoW group collapse state
- [x] Add KPI formula tooltips
- [x] Add fallback/timing visual cues in Raw table

## Phase 6 — Ops Docs
- [x] Complete runbook with backfill order + rollback notes
- [x] Complete metric dictionary formulas/sources
- [x] Link v4 docs in README

## Verification Log
- [x] `npm run build`
- [x] `npm run validate`
- [x] `npm run test:run`
- [x] `npm run test:integration`
- [x] `npm run type-check`
- [x] `npm run lint`
