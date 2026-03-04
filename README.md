# Parcel Admin Dashboard

Operations dashboard for parcel delivery performance, raw stage auditing, data quality monitoring, and CSV-based ingestion.

## Current Scope

- Dashboard KPIs (DOD, WoW/MoM, WA metrics, charting)
- Raw Delivery Stages table with operational filters
- Data Quality monitor with issue detection + resolution flow
- Upload pipeline for operational datasets
- Settings/schedule management APIs

## Major Implemented Enhancements

### v3
- Raw Delivery Stages calculation alignment and audit artifact
- WA Orders source integration
- Delivery Timing Rules source integration
- WoW/MoM late metric fixes + grouped warehouse view
- WA Delivered % chart line

### v4
- Parcel Logs blank timestamp fill-forward (ingest normalizer)
- Ingest observability (`ingest_runs`, health API, dashboard widget)
- Data quality guardrails expansion
- Performance indexes + WoW fast-path RPC
- UX polish and updated ops/spec docs

## Key Pages

- `/dashboard`
- `/raw-delivery-stages`
- `/data-quality`
- `/upload`
- `/settings`
- `/schedule`

## Upload Datasets

- `delivery_details`
- `parcel_logs`
- `items_per_order` (optional)
- `collectors_report` (optional)
- `prepare_report` (optional)
- `freshdesk_tickets` (optional)
- `wa_orders` (optional)
- `delivery_timing_rules` (optional)

## Specs & Documentation

- `Specs/Enhancements-v3/Raw-Delivery-Stages-Calculation-Audit.md`
- `Specs/Enhancements-v4/Requirements.md`
- `Specs/Enhancements-v4/Design.md`
- `Specs/Enhancements-v4/Tasks.md`
- `Specs/Enhancements-v4/Runbook-Backfill-and-Uploads.md`
- `Specs/Enhancements-v4/Metric-Dictionary.md`

## Local Development

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Validation Commands (required order)

```bash
npm run build
npm run validate
npm run test:run
npm run test:integration
npm run type-check
npm run lint
```
