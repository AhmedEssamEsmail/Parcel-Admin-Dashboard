# Parcel Admin Dashboard — Enhancements Spec (v7)
Spec date: March 5, 2026

## 0) Scope summary
This spec merges:
- Your 4 requested items:
  1) Mobile navigation buttons show weird `???` characters (fix).
  2) New page: Volume Heatmap (Orders by hour × day of week).
  3) Capacity Forecasting (predict next week’s volume) on the same page as #2.
  4) SLA Breach Histogram buckets (0–30m, 30–60m, 1–2h, 2h+) added to Promise Reliability page.
- The Deep Research recommendations:
  A) Global filters + shareable URLs (warehouse/from/to + common filters).
  B) Parcel detail drilldown with timeline (raw + work-time adjusted).
  C) True distribution analytics for delivery time + ETA error (histograms + percentiles).
  D) Ingest health dashboard page (freshness + failures + dataset matrix).
  E) Exception workflow depth (taxonomy, ownership, due-by, notes, MTTA/MTTR, bulk actions).
  F) Chart interpretability fixes (ETA “distribution” label mismatch, route scatter axis labels/ref lines).
  G) Click-through drilldowns from KPIs (chart/table → raw explorer / parcel detail).

## 1) Product principles (for all work)
- Keep existing pages working; no breaking API changes.
- Prefer server-side aggregation for heavy analytics; avoid loading raw rows when a view/function can aggregate.
- Make filters consistent across pages and shareable via URL query params.
- Add “drilldown paths” (a KPI should lead to a list, then a parcel timeline).

## 2) Global definitions

### 2.1 Time and timezone handling
- All time-bucketing (hour, day-of-week) must use the same “local time” convention used by current derived views/pages.
- When warehouse=ALL, bucketing must still be correct per-row local time, not a single timezone assumption (unless explicitly documented otherwise).

### 2.2 Orders / Volume definition
Default “Volume” metric:
- Count of placed orders (same meaning as existing DoD “total_placed” concept).
If the repo already distinguishes placed vs delivered in KPI views, allow “Placed vs Delivered” toggle as a nice-to-have.

### 2.3 SLA lateness definition
For delivered orders:
- late_minutes = max(0, delivered_at - promise_deadline_at) in minutes
Histogram includes late deliveries only.

### 2.4 Parcel identity and navigation
Parcel drilldowns must identify parcels via:
- warehouse (id or code) + parcel_id
and must be linkable from:
- Raw delivery stages table
- Exceptions table
- Data quality issues “View Records” list

## 3) Global UX requirements (applies to all pages)
- Standard filter bar: Warehouse + Date range (from/to) + Apply
- Filters must persist in URL query params (shareable links).
- Loading state, empty state, error state (with Retry).
- Mobile responsive layouts: readable filters, tables, charts.
- CSV export patterns consistent with existing export endpoint style.

## 4) Feature requirements

## 4.1 Mobile navigation `???` characters (Fix)
### Requirements
- Mobile navigation items must show clean labels (no stray glyphs before text).
- Fix must not change desktop behavior.

### Acceptance criteria
- Mobile viewport: no `???` characters on any nav item.
- Desktop: nav unchanged and usable.
- No console errors.

---

## 4.2 Global filters + shareable URLs (High priority)
### Requirements
- Implement a shared filter model across pages:
  - warehouse (ALL or code)
  - from (YYYY-MM-DD)
  - to (YYYY-MM-DD)
  - plus page-specific filters (severity/status/city/etc.)
- Persist filter state in URL search params.
- Filters should initialize from URL on page load.
- Provide a consistent Apply behavior (either auto-fetch on change or explicit Apply; pick one approach and use it consistently).

### Pages to standardize
- Dashboard
- Zone performance
- Raw delivery stages
- Exceptions control tower
- Promise reliability
- Route efficiency
- Data quality monitor
- New Volume page
- New Ingest health page
- Parcel detail page (warehouse + parcel_id in route and/or query params)

### Acceptance criteria
- Copy/paste URL reproduces the same view.
- Navigating between pages keeps warehouse/from/to unless user changes them.
- No duplicate filter implementations per page (shared component/hook used everywhere).

---

## 4.3 New page: Volume Heatmap (Orders by hour × day of week)
### Route
- `/volume` (preferred)

### Heatmap requirements
- 7×24 grid:
  - x = hour 0–23
  - y = day-of-week (Mon–Sun unless your ops standard is different; document the choice)
- Cell value: order count (placed by default).
- Tooltip per cell: exact count (and optional % of total).
- Legend for color scale.

### Normalization toggle (should-have)
- Total vs Avg-per-day:
  - Avg-per-day should correct for date-range length.

### Acceptance criteria
- Heatmap updates correctly with warehouse/from/to filters.
- Missing buckets render as 0 (no missing cells).

---

## 4.4 Capacity forecasting (same page as Volume heatmap)
### Requirements
- Predict next 7 days volume for the selected warehouse (or ALL).
- Show:
  - historical daily totals (training window, e.g., last 8 weeks)
  - forecast for next 7 days
- Must include “Model notes” text describing the method (baseline is fine).

### Quality indicators (nice-to-have)
- Simple backtest metric (e.g., MAPE on last 4 weeks).
- Optional confidence band.

### Acceptance criteria
- Always returns exactly 7 forecast points (next calendar days).
- Deterministic behavior documented.

---

## 4.5 SLA breach histogram (add to Promise Reliability page)
### Requirements
- Buckets for late deliveries only:
  - 0–30m, 30–60m, 1–2h, 2h+
- Show:
  - count per bucket
  - % of late deliveries per bucket
- Show summary:
  - delivered total
  - on-time delivered
  - late delivered

### Acceptance criteria
- Bucket totals reconcile with late delivered count.
- Works for single warehouse and ALL.

---

## 4.6 Parcel detail drilldown with timeline (High priority)
### Route
Choose one and standardize:
- `/parcel/[warehouseCode]/[parcelId]` (recommended), OR
- `/parcel?warehouse=...&parcel_id=...`

### Requirements
- Header: parcel id + warehouse + key flags:
  - waiting address
  - cutoff status
  - on-time / late (and SLA minutes used)
- Timeline section:
  - key timestamps for phases/stages already modeled
  - duration bars:
    - raw duration
    - work-time adjusted duration (if available)
- Related items:
  - exceptions (if any)
  - Freshdesk tickets (if available)
  - data quality flags (if any)

### Navigation / linking
- Make parcel_id clickable in:
  - Raw delivery stages table
  - Exceptions table
  - DQ “View Records” list
Each link opens parcel detail page with current filters preserved where sensible.

### Acceptance criteria
- Parcel detail loads for valid parcel ids quickly.
- Timeline is readable on mobile (stacked cards is fine).
- Clicking from tables reliably navigates to the correct parcel.

---

## 4.7 True distribution analytics (Delivery time + ETA error)
### Where to place
Option A (recommended): New page `/distributions`
Option B: Add tabs/sections on Dashboard

### Must-have visuals
1) Delivery time distribution (histogram bins)
2) Delivery percentiles trend (p50/p90/p95) over time
3) ETA error:
   - Signed error distribution (bias)
   - Absolute error distribution (tail)

### Fix naming mismatch
- The current “ETA error distribution” must be renamed or changed so labels match what it actually shows.

### Acceptance criteria
- Histograms are real distributions (not daily averages).
- Percentiles align with underlying data.
- Clear axis labels and units.

---

## 4.8 Ingest health dashboard page (Medium priority)
### Route
- `/ingest-health`

### Requirements
- Show ingestion freshness by:
  - warehouse × dataset (matrix/table)
  - last ingest time
  - status badge (fresh / stale / failed)
- Show recent failures and anomalies:
  - failed runs
  - row count anomalies (optional initial version)
- Deep links:
  - to Upload page
  - to dataset docs (if present)
- Integrate with Data Quality monitor (optional):
  - warn when data is stale

### Acceptance criteria
- Shows last ingest per dataset and warehouse (using existing ingest_runs logic).
- Clear stale thresholds (configurable).

---

## 4.9 Exceptions taxonomy + workflow depth (Medium priority)
### Data additions (schema)
Add fields (exact names can vary, but the concept must exist):
- assigned_to
- category + subcategory
- due_at
- resolution_code
- notes (either text or separate notes table)
- detected_at/ack_at/resolved_at (if not already present)

### UI requirements
- Exceptions table supports:
  - bulk acknowledge/resolve
  - side drawer “Exception details” editor
  - filters by category/assignee/due status
- Add operational metrics:
  - MTTA (ack - detected)
  - MTTR (resolve - detected)
  - aging buckets for open exceptions

### Acceptance criteria
- Bulk actions work reliably and show results.
- MTTA/MTTR computed correctly for rows with timestamps.

---

## 4.10 Chart interpretability fixes (Low effort, do early)
### Requirements
- Route efficiency scatter:
  - axis labels + units
  - optional reference lines/targets (documented)
- ETA error chart:
  - rename if it’s not a distribution, OR
  - replace with a real distribution chart as part of the distributions work

### Acceptance criteria
- Charts have labeled axes and clear units.
- Titles match what the chart shows.

---

## 4.11 Click-through drilldowns (High ROI)
### Requirements
- Dashboard On-time chart:
  - clicking a day opens Raw delivery stages filtered to that date and KPI=late (and warehouse)
- Zone performance table:
  - clicking a city opens a City report (or applies city filter in place)
- From any list/table row, enable “Open parcel” (parcel detail page)

### Acceptance criteria
- Drilldown links preserve key filters (warehouse/from/to).
- Drilldown targets load with correct filters applied.
