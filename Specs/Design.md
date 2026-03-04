# Parcel Admin Dashboard — Enhancements Design (v7)

## 1) Design goals
- One filter system across the app (shared component + URL state).
- Drilldown paths:
  KPI → list → parcel timeline
- Add distribution analytics (histograms/percentiles) to reduce “average hides tail” issues.
- Add operational reliability pages (ingest health, exceptions workflow depth).

## 2) Proposed navigation / routes
Add these routes:
- `/volume` (heatmap + forecast)
- `/ingest-health`
- `/parcel/[warehouseCode]/[parcelId]` (parcel timeline)
- `/distributions` (delivery + ETA distributions)  (optional but recommended)

Keep existing routes unchanged.

## 3) Shared filter system

### 3.1 Filter state model
Core params:
- `warehouse` (ALL or warehouse_code)
- `from` (YYYY-MM-DD)
- `to` (YYYY-MM-DD)

Page-specific params examples:
- exceptions: `severity`, `status`, `category`, `assignee`
- DQ: `severity`, `resolved`, `check_id`
- raw delivery stages: `kpi_status`, `cutoff_status`, `wa`, `city`, `zone`, `ticket_status`, pagination

### 3.2 URL contract
- Every page reads initial filter values from URL search params.
- Every Apply action writes filters back to URL.
- When navigating between pages, preserve warehouse/from/to unless explicitly overridden.

### 3.3 Implementation shape (no code, but structure)
- `components/filters/GlobalFilters.tsx` (UI)
- `lib/filters/useGlobalFilters.ts` (reads/writes URL params, provides typed object)
- `lib/filters/serialize.ts` (stable encode/decode of params)

## 4) Data & DB design (new/extended)

## 4.1 Volume heatmap aggregation
Preferred: Postgres function or parameterized query returning:
- `dow` (consistent encoding)
- `hour` (0–23)
- `orders` (count)
Optional:
- `occurrences` (# of that weekday in range) for avg-per-day.

API will fill missing buckets to ensure a full 7×24 grid.

## 4.2 Daily volume series (for forecast)
Return:
- `day` (local date)
- `orders` (count)

Forecast is computed server-side (API route) using a baseline method:
- seasonal naive (use last week’s same weekday), or
- day-of-week rolling average (last N weeks), or
- weighted blend (documented in response.model)

## 4.3 SLA breach bucketing
Prefer server-side:
- late_minutes computed from delivered vs deadline
- group into bucket labels

Return:
- summary counts (delivered/onTime/late)
- buckets list

## 4.4 Parcel detail timeline
Data sources:
- `v_parcel_phases` (timestamps + adjusted seconds)
- `v_parcel_kpi` or base view (flags: cutoff/waiting address/on-time)
- exceptions/tickets tables (optional joins)

API returns one object:
- identity, flags, SLA config used
- timestamps (phase names + ts)
- durations (raw + adjusted)
- related exceptions/tickets/dq

## 4.5 Distribution analytics (delivery + ETA)
Delivery time:
- histogram bins (server-side binning preferred)
- percentiles p50/p90/p95 by day/week

ETA error:
- signed error bins
- absolute error bins
- percentiles for abs error

Fix the current ETA chart mismatch by:
- renaming existing “avg ETA error daily” chart accurately, and/or
- migrating it into the distributions page as the trend view.

## 4.6 Ingest health page
Use existing ingest_runs + extend with:
- dataset list (known dataset types)
- per dataset “freshness SLA” thresholds (config table or static config in code)

Return:
- warehouse × dataset matrix (last_run_at, status, row_count)
- recent failures list

## 4.7 Exceptions workflow depth
Schema changes (migration):
- add fields for assignment, category, due date, resolution code
- timestamps for ack/resolution
- notes (either inline text or normalized table)

API changes:
- extend PATCH to support:
  - single update
  - bulk update
- add endpoints for:
  - metrics (MTTA/MTTR, aging buckets)
  - taxonomy lists (categories/assignees)

UI changes:
- table + bulk selection
- details drawer editor
- metrics charts (aging buckets, MTTA/MTTR trend)

## 5) API design (routes & response shapes)

### 5.1 `/api/volume-heatmap`
GET params: warehouse, from, to
Response:
- meta (labels, range)
- cells [{dow,hour,orders,avgPerDay?}]

### 5.2 `/api/volume-forecast`
GET params: warehouse, to (optional historyDays)
Response:
- history [{day,actual}]
- forecast [{day,predicted,lower?,upper?}]
- model {name,historyDays,notes,backtest?}

### 5.3 `/api/sla-breach-histogram`
GET params: warehouse, from, to
Response:
- summary {delivered,onTime,late}
- buckets [{bucket,count,pctLate}]

### 5.4 `/api/parcel-detail`
GET params: warehouse, parcel_id (or path params)
Response:
- parcel header fields
- timeline stages [{name,ts,rawSeconds,workSeconds}]
- related {exceptions[],tickets[],dqIssues[]}

### 5.5 `/api/distributions/delivery-time`
GET params: warehouse, from, to, binSizeMinutes?
Response:
- bins [{min,max,count}]
- percentiles {p50,p90,p95}
- optional trend [{day,p50,p90,p95}]

### 5.6 `/api/distributions/eta-error`
Similar structure:
- signed bins + abs bins + percentiles

### 5.7 `/api/ingest-health/summary`
GET params: days?
Response:
- matrix rows per warehouse with datasets columns
- recent failures list
- stale thresholds in meta

### 5.8 Exceptions bulk update + metrics
- `PATCH /api/exceptions` supports:
  - single: exception_id + fields
  - bulk: exception_ids[] + fields
- `GET /api/exceptions/metrics` returns:
  - MTTA/MTTR
  - aging buckets
  - rate trends

## 6) UI components

### 6.1 Heatmap
Prefer a CSS grid component (7×24) with:
- computed color scale
- tooltip hover/tap
- legend
- mobile scroll handling

### 6.2 Charts (Chart.js)
- Forecast line chart (actual vs predicted)
- SLA breach histogram bar chart
- Distribution histograms bar charts
- Percentile trends line charts
- Exceptions aging buckets bar chart
- MTTA/MTTR trend line chart

### 6.3 Parcel timeline
- Simple vertical timeline with:
  - stage name
  - timestamp
  - duration (raw + adjusted)
- Optional “bottleneck highlight” (top 1–2 longest stages).

## 7) Drilldown linking design
- Standard helper that creates URLs with preserved global filters.
Examples:
- Dashboard day click → `/raw-delivery-stages?warehouse=...&from=YYYY-MM-DD&to=YYYY-MM-DD&kpi_status=Late`
- City click → `/zone-performance?warehouse=...&city=...` or `/reports/city?...`
- Parcel click → `/parcel/{warehouse}/{parcelId}?from=...&to=...`

## 8) Testing approach (lightweight)
- Endpoint validations (200/400) for new APIs
- A few UI smoke checks (pages render with empty data)
- One drilldown integration check (URL carries filters correctly)

## 9) Migration policy
- New migration files only.
- Keep each migration focused (one feature set per migration).
