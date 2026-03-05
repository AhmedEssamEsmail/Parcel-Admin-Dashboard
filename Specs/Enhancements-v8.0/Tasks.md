# Parcel Admin Dashboard — v8.1 Tasks (repo-aligned)

## Baseline already present (do not re-implement)
- [x] Existing analytics routes/pages are in place.
- [x] Existing `GET /api/ingest-health` is in place.
- [x] Existing `PATCH /api/exceptions` single-item status update is in place.

---

# Sprint 1 — Mobile nav glyph fix
## V8-1.1 Replace broken mobile icon glyphs
- [ ] Update nav link icon values to stable characters/icons (no `???`).
- [ ] Verify mobile menu labels/icons render correctly.
Done when:
- No `???` appears in mobile nav.

## V8-1.2 Regression checks
- [ ] Confirm desktop nav links are unchanged.
- [ ] Confirm no menu-related console/runtime errors.
Done when:
- Mobile + desktop nav both pass sanity checks.

---

# Sprint 2 — Shared global filters + URL persistence
## V8-2.1 Build shared filter primitives
- [ ] Add shared global filter component.
- [ ] Add URL read/write hook/util for global params.
Done when:
- One page uses shared filter primitives end-to-end.

## V8-2.2 Migrate existing pages to shared URL filters
- [ ] Dashboard
- [ ] Zone performance
- [ ] Raw delivery stages
- [ ] Exceptions
- [ ] Promise reliability
- [ ] Route efficiency
- [ ] Data quality
Done when:
- Each page can restore state from URL and apply back to URL.

## V8-2.3 Preserve global filters in navigation
- [ ] Update nav link generation to carry `warehouse/from/to`.
Done when:
- Page-to-page navigation preserves global context.

---

# Sprint 3 — Volume analytics
## V8-3.1 Heatmap API
- [ ] Add `GET /api/volume-heatmap` with full 7×24 output.
- [ ] Fill missing buckets with zero.
Done when:
- Endpoint returns complete grid for any valid range.

## V8-3.2 Volume page UI
- [ ] Add `/volume` page with heatmap, loading/empty/error states.
- [ ] Add total vs avg-per-day toggle.
Done when:
- Heatmap responds to global filters.

## V8-3.3 Forecast API + UI
- [ ] Add `GET /api/volume-forecast` with 7 future points.
- [ ] Render forecast section on `/volume` with model notes.
Done when:
- Forecast always returns and renders exactly 7 days.

---

# Sprint 4 — Promise reliability enhancements
## V8-4.1 SLA breach histogram backend
- [ ] Add `GET /api/sla-breach-histogram`.
- [ ] Return summary + fixed late buckets.
Done when:
- Bucket totals reconcile with late-delivered count.

## V8-4.2 Promise reliability UI updates
- [ ] Add SLA breach histogram to Promise Reliability page.
- [ ] Rename/fix current ETA chart title to match actual metric.
Done when:
- No chart title claims "distribution" unless it is a true distribution.

---

# Sprint 5 — Parcel drilldown
## V8-5.1 Parcel detail API/page
- [ ] Add parcel detail API.
- [ ] Add parcel detail page with timeline + durations.
Done when:
- Valid parcel links load parcel details reliably.

## V8-5.2 Link parcel IDs from existing UIs
- [ ] Raw delivery stages table parcel link.
- [ ] Exceptions table parcel link.
- [ ] Data quality record-view parcel link.
Done when:
- Links navigate to the correct parcel detail route.

---

# Sprint 6 — Distribution analytics
## V8-6.1 Delivery-time distribution
- [ ] Add histogram + percentile trend endpoint(s).
- [ ] Add corresponding UI charts.
Done when:
- Visualization uses true bins and percentiles.

## V8-6.2 ETA-error distribution
- [ ] Add signed/absolute error distribution endpoint(s).
- [ ] Add corresponding UI charts.
Done when:
- ETA distribution views are true distributions.

---

# Sprint 7 — Ingest health page
## V8-7.1 Extend existing ingest-health API
- [ ] Extend `GET /api/ingest-health` with dataset freshness matrix fields.
- [ ] Include stale threshold metadata/status.
Done when:
- Response can drive warehouse × dataset matrix UI.

## V8-7.2 Build `/ingest-health` page
- [ ] Add matrix view + recent failures section.
- [ ] Add links to upload/related flows.
Done when:
- Page clearly shows fresh/stale/failed by warehouse/dataset.

---

# Sprint 8 — Exception workflow depth (incremental)
## V8-8.1 Data/model extensions
- [ ] Add migration(s) for assignee/category/due/resolution/notes if missing.
Done when:
- Migration applies cleanly and fields are queryable.

## V8-8.2 API extensions
- [ ] Extend `PATCH /api/exceptions` for bulk updates.
- [ ] Add metrics endpoint for MTTA/MTTR + aging buckets.
Done when:
- Bulk actions and metrics API return expected data.

## V8-8.3 UI extensions
- [ ] Add bulk action UX and details editor.
- [ ] Add MTTA/MTTR and aging visualizations.
Done when:
- Workflow actions and metrics are usable from UI.
