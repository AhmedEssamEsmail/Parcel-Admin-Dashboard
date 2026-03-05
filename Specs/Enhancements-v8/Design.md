# Enhancements-v8.0 Design (v7.1 UI/Format Polish)

## Summary
Create a shared date/time/minutes formatter utility and apply it across targeted analytics charts/tables. Update selected layout and chart styling behavior without API/schema changes.

## Components / Files
- New utility: `lib/utils/date-format.ts`
- Charts:
  - `components/charts/on-time-combo.tsx`
  - `components/charts/exceptions-trend.tsx`
  - `components/charts/promise-reliability-trend.tsx`
  - `components/charts/eta-error-distribution.tsx`
  - `components/charts/dwell-trend.tsx`
- Tables/widgets/pages:
  - `components/tables/dod-summary-table.tsx`
  - `components/tables/promise-reliability-table.tsx`
  - `components/tables/route-efficiency-table.tsx`
  - `components/tables/wow-mom-table.tsx`
  - `components/tables/exceptions-table.tsx`
  - `components/widgets/comparison-widget.tsx`
  - `app/raw-delivery-stages/page.tsx`
  - `app/globals.css`

## Utility API
- `formatDateMmmDd(value)` -> `MMM-DD`
- `formatDateTimeMmmDdHhMmSs(value)` -> `MMM-DD HH:MM:SS`
- `formatMinutesToHHMM(value)` -> `HH:MM`

## UI Decisions
- On-Time chart only gets increased vertical height.
- Line legend swatches are solid; chart lines themselves unchanged except On-Time color set to medium gray.
- Compare Periods uses a 3-card layout (A, B, Change).
- WoW global expand/collapse appears only in grouped warehouse mode.
