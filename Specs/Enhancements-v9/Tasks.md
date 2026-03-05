# Parcel Admin Dashboard — v9 Tasks (repo-aligned)

## Baseline already present (do not re-implement)
- [x] Existing analytics routes/pages are in place.
- [x] Existing `GET /api/ingest-health` is in place.
- [x] Existing `PATCH /api/exceptions` single-item status update is in place.

---

# Sprint 1 — Mobile nav glyph fix
## V9-1.1 Replace broken mobile icon glyphs
- [x] Update nav link icon values to stable characters/icons (no `???`).
- [x] Verify mobile menu labels/icons render correctly.
Done when:
- No `???` appears in mobile nav.

## V9-1.2 Regression checks
- [x] Confirm desktop nav links are unchanged.
- [x] Confirm no menu-related console/runtime errors.
Done when:
- Mobile + desktop nav both pass sanity checks.

---

# Sprint 2 — Shared global filters + URL persistence
## V9-2.1 Build shared filter primitives
- [x] Add shared global filter component.
- [x] Add URL read/write hook/util for global params.
Done when:
- One page uses shared filter primitives end-to-end.

## V9-2.2 Migrate existing pages to shared URL filters
- [x] Dashboard
- [x] Zone performance
- [x] Raw delivery stages
- [x] Exceptions
- [x] Promise reliability
- [x] Route efficiency
- [x] Data quality
Done when:
- Each page can restore state from URL and apply back to URL.

## V9-2.3 Preserve global filters in navigation
- [x] Update nav link generation to carry `warehouse/from/to`.
Done when:
- Page-to-page navigation preserves global context.

---

# Sprint 3 — Volume analytics
## V9-3.1 Heatmap API
- [x] Add `GET /api/volume-heatmap` with full 7×24 output.
- [x] Fill missing buckets with zero.
Done when:
- Endpoint returns complete grid for any valid range.

## V9-3.2 Volume page UI
- [x] Add `/volume` page with heatmap, loading/empty/error states.
- [x] Add total vs avg-per-day toggle.
Done when:
- Heatmap responds to global filters.

## V9-3.3 Forecast API + UI
- [x] Add `GET /api/volume-forecast` with 7 future points.
- [x] Render forecast section on `/volume` with model notes.
Done when:
- Forecast always returns and renders exactly 7 days.

---

# Sprint 4 — Promise reliability enhancements
## V9-4.1 SLA breach histogram backend
- [x] Add `GET /api/sla-breach-histogram`.
- [x] Return summary + fixed late buckets.
Done when:
- Bucket totals reconcile with late-delivered count.

## V9-4.2 Promise reliability UI updates
- [x] Add SLA breach histogram to Promise Reliability page.
- [x] Rename/fix current ETA chart title to match actual metric.
Done when:
- No chart title claims "distribution" unless it is a true distribution.

---

# Sprint 5 — Parcel drilldown
## V9-5.1 Parcel detail API/page
- [x] Add parcel detail API.
- [x] Add parcel detail page with timeline + durations.
Done when:
- Valid parcel links load parcel details reliably.

## V9-5.2 Link parcel IDs from existing UIs
- [x] Raw delivery stages table parcel link.
- [x] Exceptions table parcel link.
- [x] Data quality record-view parcel link.
Done when:
- Links navigate to the correct parcel detail route.

---

# Sprint 6 — Distribution analytics
## V9-6.1 Delivery-time distribution
- [x] Add histogram + percentile trend endpoint(s).
- [x] Add corresponding UI charts.
Done when:
- Visualization uses true bins and percentiles.

## V9-6.2 ETA-error distribution
- [x] Add signed/absolute error distribution endpoint(s).
- [x] Add corresponding UI charts.
Done when:
- ETA distribution views are true distributions.

---

# Sprint 7 — Ingest health page
## V9-7.1 Extend existing ingest-health API
- [x] Extend `GET /api/ingest-health` with dataset freshness matrix fields.
- [x] Include stale threshold metadata/status.
Done when:
- Response can drive warehouse × dataset matrix UI.

## V9-7.2 Build `/ingest-health` page
- [x] Add matrix view + recent failures section.
- [x] Add links to upload/related flows.
Done when:
- Page clearly shows fresh/stale/failed by warehouse/dataset.

---

# Sprint 8 — Exception workflow depth (incremental)
## V9-8.1 Data/model extensions
- [x] Add migration(s) for assignee/category/due/resolution/notes if missing.
Done when:
- Migration applies cleanly and fields are queryable.

## V9-8.2 API extensions
- [x] Extend `PATCH /api/exceptions` for bulk updates.
- [x] Add metrics endpoint for MTTA/MTTR + aging buckets.
Done when:
- Bulk actions and metrics API return expected data.

## V8-8.3 UI extensions
- [x] Add bulk action UX and details editor.
- [x] Add MTTA/MTTR and aging visualizations.
Done when:
- Workflow actions and metrics are usable from UI.


Notes (2026-03-05): Completed nav glyph fix, shared filter primitives, partial URL-filter migration (Dashboard/Zone/Exceptions/Promise/Route), nav global-param preservation, and parcel detail API/page + links in Raw/Exceptions. Verification passed: build, validate, test:run, test:integration, type-check, lint.


Notes (2026-03-05, pass 2): Completed remaining sprints including volume APIs/UI, SLA breach histogram, distribution endpoints/UI, ingest-health matrix API/page, raw/data-quality URL global filters, data-quality parcel links, exceptions workflow migration + bulk patch + metrics + UI.
