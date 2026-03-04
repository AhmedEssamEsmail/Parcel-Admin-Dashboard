# Enhancements-v5 Design

## Mobile Navigation
- Keep desktop top-nav unchanged.
- Move mobile menu trigger into left-side brand area.
- Drawer opens from left and can occupy full viewport.
- Mobile drawer contains full navigation list and bottom-anchored logout action.

## WoW/MoM
- Add `from` and `to` support in WoW API and pass from dashboard.
- Compute collapsed grouped summaries in UI:
  - sums for count columns,
  - averages for percentage/time columns.
- Use `-` for expanded and `+` for collapsed indicator.

## Dashboard UX
- Add refresh counter helper tooltip (“refreshes every 2 hours”).
- Force line datasets above bars through dataset ordering.

## Raw Delivery Stages Reliability
- Try `v_raw_delivery_stages_with_source`.
- If missing, fallback to `v_raw_delivery_stages`.
- Return metadata:
  - `timingSourceSupported`
  - optional `warning`
- UI disables/ignores timing-source filter when unsupported.

## Ingest Health Reliability
- If `ingest_runs` or `v_ingest_health_daily` is missing, return non-failing safe response with warning.
