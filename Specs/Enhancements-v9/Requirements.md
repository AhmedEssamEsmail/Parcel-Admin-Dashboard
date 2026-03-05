# Parcel Admin Dashboard — Enhancements Spec (v9)
Spec date: March 5, 2026 (repo-aligned revision)

## 0) Scope summary
This revision keeps only work that is **not yet implemented** in the current repository.

### Requested + research scope still pending
1) Fix mobile navigation `???` glyphs.
2) Add new `/volume` page with:
   - Hour × day-of-week heatmap
   - 7-day capacity forecast
3) Add SLA breach histogram buckets to Promise Reliability.
4) Standardize global filters with URL persistence across pages.
5) Add parcel detail drilldown timeline and link from existing tables.
6) Add true distribution analytics (delivery time + ETA error bins/percentiles).
7) Add ingest health **page** and extend current ingest-health API to support dataset freshness matrix.
8) Deepen exception workflow (bulk actions + ownership/taxonomy + MTTA/MTTR).
9) Improve chart interpretability and drilldown navigation.

### Already implemented baseline (out of scope for new tasks)
- Core analytics pages and APIs already exist (dashboard, zone performance, exceptions, promise reliability, route efficiency, data quality, raw delivery stages).
- `GET /api/ingest-health` already exists and returns summary/recent runs/daily trend.
- `PATCH /api/exceptions` already supports single-row status updates.

## 1) Product principles
- Keep existing routes and behavior stable while adding enhancements.
- Reuse current App Router patterns (`app/.../page.tsx`, `app/api/.../route.ts`).
- Prefer server-side aggregation for heavy analytics.
- Preserve existing CSV export conventions.

## 2) Global definitions
### 2.1 Time and timezone
- New bucketing (hour/day-of-week, forecasting series) must use the same local-time convention as existing KPI views.

### 2.2 Volume definition
- Default volume metric = placed orders (`total_placed` semantics used in dashboard DoD).

### 2.3 SLA lateness
- Late minutes = `max(0, delivered_at - promise_deadline_at)` in minutes.
- Histogram includes late deliveries only.

### 2.4 Parcel identity
- Parcel routes/queries must include `warehouse` + `parcel_id`.

## 3) Global UX requirements
- Consistent filter bar shape: warehouse/from/to + Apply.
- Filters initialize from URL and write back to URL.
- Loading/empty/error states for new pages/components.
- Mobile-friendly layout for new views.

## 4) Feature requirements

## 4.1 Mobile nav glyph fix
- Replace broken icon glyph strings in mobile menu items with stable icons/text (no `???`).
- Desktop nav labels/behavior must remain unchanged.

## 4.2 Shared global filters + URL persistence
- Introduce shared filter utilities/components.
- Migrate existing pages incrementally (dashboard first, then remaining analytics pages).
- Preserve `warehouse/from/to` when navigating via app links.

## 4.3 New `/volume` page
- 7×24 heatmap (hour vs weekday), missing buckets as zero.
- Toggle: total vs avg-per-day.
- Works with global filters.

## 4.4 Capacity forecast on `/volume`
- Show historical daily totals + exactly 7 future forecast points.
- Include model notes and deterministic method description.

## 4.5 Promise Reliability: SLA breach histogram
- Buckets: `0–30m`, `30–60m`, `1–2h`, `2h+`.
- Show count + % late for each bucket.
- Show delivered/on-time/late summary.

## 4.6 Parcel detail drilldown
- Add parcel detail route and API.
- Timeline stages with raw vs work-time-adjusted durations (if available).
- Make parcel IDs linkable from raw stages, exceptions, and DQ record views.

## 4.7 Distribution analytics
- Add true histogram/bin APIs + percentile trend for delivery time and ETA error.
- Fix current Promise Reliability chart naming mismatch (`ETA Error Distribution` currently shows daily averages).

## 4.8 Ingest health page
- Add `/ingest-health` UI page.
- Extend existing ingest-health backend contract to return dataset freshness matrix + stale status thresholds.

## 4.9 Exceptions workflow depth (incremental)
- Extend current exception model/API/UI with assignee/category/due date/resolution fields.
- Add bulk acknowledge/resolve and MTTA/MTTR + aging metrics.

## 4.10 Chart interpretability + drilldowns
- Add explicit axis labels/units to route-efficiency scatter.
- Add click-through drilldowns (chart/table → filtered raw view and parcel detail).
