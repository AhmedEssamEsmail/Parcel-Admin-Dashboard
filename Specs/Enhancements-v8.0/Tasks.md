# Parcel Admin Dashboard — v8 Tasks (Codex checklist)

## How to use this file
- Each sprint has small tasks with a clear “done when” checklist.
- If a task touches DB, add a new migration file (never edit old migrations).
- Keep commits grouped by sprint/feature.

---

# Sprint 0 — Decisions & baseline

## V7-0.1 Choose route names and URL param contract
- [ ] Confirm routes: /volume, /ingest-health, /distributions, /parcel/[warehouse]/[parcelId]
- [ ] Confirm global params: warehouse/from/to (names and formats)
- [ ] Define day-of-week ordering standard (Mon–Sun or business standard)
Done when:
- A short note exists in PR description listing chosen routes and params.

## V7-0.2 Inventory existing filter logic per page
- [ ] List pages and current params used
- [ ] Identify any inconsistent param names or date formats
Done when:
- A checklist exists mapping page → current params → target params.

---

# Sprint 1 — Mobile nav `???` fix

## V7-1.1 Reproduce and identify source
- [ ] Confirm if glyphs are DOM text or CSS markers/pseudo-elements
- [ ] Identify responsible component and CSS
Done when:
- Root cause is documented (1–3 sentences).

## V7-1.2 Implement fix
- [ ] Remove/override list markers or `::before` content causing glyphs
- [ ] If font/icon issue: replace with inline SVG or fix font loading
Done when:
- Mobile menu shows clean labels.

## V7-1.3 Regression check
- [ ] Desktop nav unchanged
- [ ] No console errors
Done when:
- Screenshots (mobile + desktop) added to PR.

---

# Sprint 2 — Global filters + shareable URLs

## V7-2.1 Create shared filter utilities
- [ ] Create shared GlobalFilters UI component
- [ ] Create shared hook/util to read/write URL params
- [ ] Decide Apply behavior (explicit Apply recommended)
Done when:
- One page uses the shared component end-to-end.

## V7-2.2 Migrate Dashboard to shared filters
- [ ] Replace local filter state with shared state
- [ ] Ensure API calls use URL-derived params
Done when:
- Refreshing the page preserves the view via URL.

## V7-2.3 Migrate remaining pages (one task per page)
- [ ] Zone performance
- [ ] Raw delivery stages
- [ ] Exceptions control tower
- [ ] Promise reliability
- [ ] Route efficiency
- [ ] Data quality monitor
Done when:
- Each page:
  - loads from URL
  - writes back on Apply
  - preserves warehouse/from/to between navigations

## V7-2.4 Add “preserve global filters on navigation”
- [ ] Update nav links to include current warehouse/from/to where appropriate
Done when:
- Switching pages keeps warehouse/from/to.

---

# Sprint 3 — Volume Heatmap (data + API)

## V7-3.1 Confirm source columns for “placed local timestamp”
- [ ] Identify canonical placed timestamp and its local form
- [ ] Document chosen fields
Done when:
- A short note exists in code comments or PR.

## V7-3.2 DB migration for heatmap aggregation
- [ ] Add migration to create function/view for heatmap rows (dow, hour, count)
- [ ] Support warehouse=ALL logic
- [ ] Ensure local time is used
Done when:
- Running the query returns rows for a sample range.

## V7-3.3 Add `/api/volume-heatmap`
- [ ] Validate params (warehouse/from/to)
- [ ] Query aggregation
- [ ] Fill missing buckets to ensure 7×24
Done when:
- Manual test returns full grid data.

---

# Sprint 4 — Volume Heatmap (UI)

## V7-4.1 Create `/volume` page skeleton
- [ ] Add title + GlobalFilters
- [ ] Add loading/error/empty states
Done when:
- Page renders and calls API on Apply.

## V7-4.2 Build heatmap component
- [ ] CSS grid 7×24
- [ ] Color scale + legend
- [ ] Tooltip on hover/tap
Done when:
- Heatmap shows values and tooltips.

## V7-4.3 Add normalization toggle (Total vs Avg/day)
- [ ] Implement toggle
- [ ] Ensure values change correctly
Done when:
- Toggle changes displayed numbers without refetch (if feasible) or with refetch.

---

# Sprint 5 — Forecasting (data + API + UI)

## V7-5.1 Daily volume series query (DB or API)
- [ ] Reuse existing KPI view if it already returns daily totals
- [ ] Else add migration for daily totals
Done when:
- API can fetch last N days daily totals.

## V7-5.2 Add `/api/volume-forecast`
- [ ] Implement baseline method (documented)
- [ ] Return history + 7-day forecast + model notes
- [ ] Optional: backtest metric
Done when:
- Forecast always returns 7 future days.

## V7-5.3 Add forecast UI section on `/volume`
- [ ] Line chart actual vs forecast
- [ ] Model notes block
- [ ] Optional: mini table Date | Predicted
Done when:
- Forecast section updates with warehouse filter.

---

# Sprint 6 — SLA breach histogram (Promise Reliability page)

## V7-6.1 Confirm promise deadline column
- [ ] Identify which timestamp is the SLA deadline/promise end
- [ ] Document it
Done when:
- Column choice is written in PR.

## V7-6.2 DB migration for late bucket counts
- [ ] Implement query/function returning 4 buckets + summary counts
Done when:
- Bucket totals reconcile with late delivered count.

## V7-6.3 Add `/api/sla-breach-histogram`
- [ ] Validate params
- [ ] Return summary + buckets
Done when:
- Endpoint works for ALL and one warehouse.

## V7-6.4 Add chart to Promise Reliability page
- [ ] Add summary counters
- [ ] Add histogram bar chart
Done when:
- Page displays buckets correctly with filters.

---

# Sprint 7 — Parcel detail drilldown timeline

## V7-7.1 Define route format and linking standard
- [ ] Decide /parcel/[warehouse]/[parcelId] vs query params
- [ ] Decide which global params to preserve
Done when:
- Link helper spec is written in code comments.

## V7-7.2 Add `/api/parcel-detail`
- [ ] Fetch parcel from derived views (kpi + phases)
- [ ] Include related exceptions/tickets/dq (if available)
Done when:
- Endpoint returns a single parcel payload.

## V7-7.3 Build parcel detail page
- [ ] Header: key flags and SLA
- [ ] Timeline list of stages with timestamps
- [ ] Duration bars: raw vs work-time adjusted
Done when:
- Timeline is readable on mobile.

## V7-7.4 Add links into parcel detail
- [ ] Raw delivery stages: parcel_id becomes clickable
- [ ] Exceptions table: parcel link
- [ ] DQ “View records” list: parcel link
Done when:
- Clicking any parcel link opens correct parcel detail.

---

# Sprint 8 — True distribution analytics (delivery time + ETA error)

## V7-8.1 Decide placement: `/distributions` vs Dashboard tabs
- [ ] Choose one and document
Done when:
- Route and nav updated.

## V7-8.2 Delivery time distribution endpoint
- [ ] Add endpoint returning histogram bins
- [ ] Add endpoint/trend returning p50/p90/p95 over time (daily or weekly)
Done when:
- Data returned is a true distribution (bins), not averages.

## V7-8.3 ETA error distribution endpoints
- [ ] Signed error bins
- [ ] Absolute error bins
- [ ] Optional: percentiles
Done when:
- “Distribution” charts reflect bins.

## V7-8.4 Build distributions UI
- [ ] Delivery histogram + percentile trend
- [ ] ETA signed histogram + abs histogram
- [ ] GlobalFilters applied
Done when:
- Charts render and update with filters.

## V7-8.5 Fix ETA chart naming mismatch
- [ ] Rename the existing average ETA chart to match content, OR
- [ ] Replace it with a distribution and move avg trend to a “Trend” tab
Done when:
- No chart title claims “distribution” unless it is one.

---

# Sprint 9 — Ingest health dashboard page

## V7-9.1 Define dataset list + freshness SLA thresholds
- [ ] Enumerate dataset types used by ingest
- [ ] Define stale thresholds per dataset (config)
Done when:
- Threshold table exists (config or DB).

## V7-9.2 Add `/api/ingest-health/summary`
- [ ] Return matrix warehouse × dataset with last run + status
- [ ] Return recent failures list
Done when:
- Endpoint returns enough to render page.

## V7-9.3 Build `/ingest-health` UI
- [ ] Matrix table with badges
- [ ] Recent failures section
- [ ] Links to Upload and “view runs” if applicable
Done when:
- Page clearly shows stale vs fresh.

## V7-9.4 Optional: surface staleness warnings elsewhere
- [ ] Dashboard banner when key datasets are stale
Done when:
- Banner appears only when stale.

---

# Sprint 10 — Exceptions workflow depth

## V7-10.1 Schema migration for exception fields
- [ ] Add assignee/category/subcategory/due_at/resolution_code
- [ ] Add ack_at/resolved_at if missing
- [ ] Add notes model (column or separate table)
Done when:
- Migration applies cleanly.

## V7-10.2 API extensions
- [ ] PATCH supports updating new fields
- [ ] Add bulk update support
Done when:
- Bulk resolve/ack works.

## V7-10.3 UI: details drawer + bulk actions
- [ ] Row click opens drawer editor
- [ ] Multi-select table rows + bulk action buttons
Done when:
- Bulk updates reflect immediately in UI.

## V7-10.4 Exceptions metrics
- [ ] MTTA/MTTR calculations endpoint
- [ ] Aging buckets endpoint
- [ ] UI charts for both
Done when:
- Metrics update with filters.

---

# Sprint 11 — Drilldowns and report-style views

## V7-11.1 Dashboard day-click → raw stages
- [ ] Implement click handler in On-time chart
- [ ] Build URL with preserved filters + KPI=Late
Done when:
- Click opens correct filtered raw view.

## V7-11.2 City click → city report (lightweight)
- [ ] Decide: new `/reports/city` or reuse zone page
- [ ] Implement city distribution + top exceptions types (minimal version)
Done when:
- City drilldown exists and is useful.

---

# Sprint 12 — Chart interpretability quick fixes (do anytime)
## V7-12.1 Route scatter axis labels + units
- [ ] Label x/y axes clearly
- [ ] Add optional reference lines if target thresholds exist
Done when:
- Scatter is readable without guessing.

## V7-12.2 Standardize chart titles/legends
- [ ] Titles match metrics shown
- [ ] Legends show units (minutes, %, count)
Done when:
- No misleading titles.

---

# Phase 2 (optional, high effort) — SLA “at risk” + Ops control tower
(Include only after Phase 1 ships cleanly.)

## V7-P2.1 Define “at risk” logic
- [ ] Use SLA minutes + stage age + remaining shift time
- [ ] Document heuristics
Done when:
- A written spec exists for risk scoring.

## V7-P2.2 Build `/ops-control-tower`
- [ ] At-risk queue
- [ ] Exception spike widgets
- [ ] Top failing zones
- [ ] Drilldown to parcel detail
Done when:
- Page supports daily ops workflow.
