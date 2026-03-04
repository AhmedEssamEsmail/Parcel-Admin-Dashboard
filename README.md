# Parcel Admin Dashboard

Operational dashboard for monitoring parcel delivery performance across warehouses, auditing stage-level timings, and controlling KPI data quality through structured CSV ingestion.

---

## 1) Product Concept

This system is built for operations teams who need to:
- track On-Time Delivery (OTD) and delivery speed,
- compare weekly/monthly trends by warehouse,
- inspect raw stage timelines per parcel,
- detect data-quality issues early,
- ingest multiple source datasets (delivery details, parcel logs, WA flags, timing rules, etc.) safely.

It combines:
- **analytics pages** (Dashboard, Raw Delivery Stages, City Performance, Exceptions, Promise Reliability, Route Efficiency, Data Quality),
- **configuration pages** (Settings, Schedule),
- **ingestion pipeline** (Upload page + normalizers + ingest API + Supabase views).

---

## 2) Core Website Features

### Dashboard (`/dashboard`)
- Day-over-day summary tables (including/excluding WA orders)
- Week-over-week / month-over-month table
- Warehouse grouping in ALL mode
- WA Delivered % line in chart
- Average delivery widget
- Auto-refresh + manual refresh

### Raw Delivery Stages (`/raw-delivery-stages`)
- Parcel-level stage timestamps and durations
- SLA/status columns for processing, preparing, delivery
- Filters: warehouse, date range, parcel id, WA, KPI, cutoff, ticket, zone/city/area, ops issue, timing source, delivery scope

### Data Quality (`/data-quality`)
- Categorized issue monitoring (critical/warning/info)
- Resolution workflow
- Filterable by severity/check/resolution

### Upload (`/upload`)
- Multi-file upload workflow with preview
- Dataset and warehouse auto-detection from file names
- Normalization + validation errors/warnings
- **Parcel Logs blank timestamp fill-forward** support

### Settings / Schedule
- SLA and override APIs
- Shift/schedule configuration endpoints

---

## 3) Main Metrics & Logic

- **OTD %** = `on_time / total_delivered * 100`
- **Late** = `total_delivered - on_time`
- **WA Delivered %** = `wa_delivered_count / total_delivered_inc_wa * 100`
- Raw stage SLA evaluations are computed via SQL views using warehouse/city timing rules + fallback logic.

Reference docs:
- `Specs/Enhancements-v3/Raw-Delivery-Stages-Calculation-Audit.md`
- `Specs/Enhancements-v4/Metric-Dictionary.md`

---

## 4) Data Flow (High Level)

1. CSV uploaded in `/upload`
2. Parsed client-side (`lib/csv/*`)
3. Normalized (`lib/ingest/normalizers/*`)
4. Posted to `/api/ingest`
5. Stored in source tables (Supabase)
6. Aggregated via SQL views/RPCs
7. Served by route handlers (`app/api/*`)
8. Rendered in pages/components

---

## 5) Repository Structure

```text
app/
  api/                   # Next.js route handlers (data APIs, ingest, exports, settings)
  dashboard/             # Dashboard page
  raw-delivery-stages/   # Raw table UI
  data-quality/          # Data quality monitor UI
  upload/                # Upload + preview UI
  settings/ schedule/ zone-performance/

components/
  charts/ tables/ widgets/ layout/ upload/

lib/
  csv/                   # Parsing + mapping helpers
  ingest/                # Types, date parsing, dataset normalizers
  middleware/            # Rate limiting/auth helpers
  supabase/              # Admin client
  utils/                 # Export + utility functions

supabase/migrations/     # Database schema/view/function migrations
Specs/                   # Requirements/design/tasks/audits by enhancement version
scripts/tests/           # Lightweight node-based run + integration checks
```

---

## 6) Tech Stack

- Next.js (App Router), React, TypeScript
- Supabase (Postgres + views/functions)
- Chart.js / react-chartjs-2
- PapaParse for CSV parsing
- ESLint + TypeScript checks

---

## 7) Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## 8) Validation Commands (required order)

```bash
npm run build
npm run validate
npm run test:run
npm run test:integration
npm run type-check
npm run lint
```

---

## 9) Migrations & Change Policy

- Do not edit a central schema file directly.
- Add every DB change as a **new migration** in `supabase/migrations/`.
- Keep migrations focused and reversible where possible.

---

## 10) Specs Index

- `Specs/Enhancements-v1/`
- `Specs/Enhancements-v1.2/`
- `Specs/Enhancements-v2/`
- `Specs/Enhancements-v3/Raw-Delivery-Stages-Calculation-Audit.md`
- `Specs/Enhancements-v4/Requirements.md`
- `Specs/Enhancements-v4/Design.md`
- `Specs/Enhancements-v4/Tasks.md`
- `Specs/Enhancements-v4/Runbook-Backfill-and-Uploads.md`
- `Specs/Enhancements-v4/Metric-Dictionary.md`

