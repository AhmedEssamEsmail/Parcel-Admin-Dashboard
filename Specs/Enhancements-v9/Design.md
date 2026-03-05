# Parcel Admin Dashboard — Enhancements Design (v9, repo-aligned)

## 1) Design goals
- Add missing capabilities without reworking existing app structure.
- Standardize filtering via shared URL-aware utilities.
- Build drilldown path: KPI/list row → parcel detail timeline.
- Ensure chart labels match actual metric semantics.

## 2) Current-state alignment
- Existing pages remain in place under `app/*/page.tsx`.
- Existing APIs remain in place under `app/api/*/route.ts`.
- Reuse these endpoints where possible; only add new endpoints for truly new analytics.
- Extend existing `/api/ingest-health` instead of introducing a duplicate summary endpoint.

## 3) Proposed additions (routes)
- `/volume` (heatmap + forecast)
- `/ingest-health` (new page consuming extended ingest API)
- `/parcel/[warehouseCode]/[parcelId]` (preferred parcel detail route)
- `/distributions` (optional if distribution visuals are not embedded into existing pages)

## 4) Shared filter system
### 4.1 Core filter contract
- `warehouse`, `from`, `to` as canonical global query params.
- Page-specific params remain page-owned but serialized consistently.

### 4.2 Implementation shape
- `components/filters/GlobalFilters.tsx`
- `lib/filters/useGlobalFilters.ts`
- `lib/filters/serialize.ts`

### 4.3 Migration strategy
- Start with Dashboard.
- Migrate existing analytics pages one by one.
- Preserve global filters in navigation links.

## 5) Data/API design
### 5.1 New endpoints
- `GET /api/volume-heatmap`
- `GET /api/volume-forecast`
- `GET /api/sla-breach-histogram`
- `GET /api/parcel-detail`
- `GET /api/distributions/delivery-time`
- `GET /api/distributions/eta-error`
- `GET /api/exceptions/metrics` (incremental)

### 5.2 Existing endpoint extension
- Extend `GET /api/ingest-health` response with dataset freshness matrix + stale/fresh status metadata.

### 5.3 Existing endpoint updates
- Extend `PATCH /api/exceptions` to support bulk updates and newly added workflow fields.

## 6) UI component design
- Heatmap component: 7×24 CSS grid with legend + tooltips.
- Forecast chart: actual vs predicted.
- SLA breach histogram: 4 fixed late buckets + summary cards.
- Parcel timeline: vertical stage list with raw/work-time durations.
- Distribution charts: true histograms and percentile trend lines.
- Ingest health: warehouse × dataset matrix + failure list.

## 7) Drilldown/linking design
- Introduce helper for building links with preserved global filters.
- Replace plain parcel ID text cells with links where available.
- Add chart/table click handlers to open filtered raw views.

## 8) Testing approach
- API validation tests for each new endpoint (success + invalid params).
- UI smoke tests for new pages with empty data states.
- Navigation/filter persistence checks across migrated pages.
