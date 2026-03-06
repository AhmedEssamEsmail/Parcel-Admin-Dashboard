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

## 5) Database Table & View Mapping

This section explains how the database objects relate to each other, where each table gets its data, and how calculated views are derived.

### 5.1 Relationship map

```text
warehouses
|-- warehouse_shift_overrides
|-- warehouse_shift_configs
|-- warehouse_city_sla_configs
|-- warehouse_delivery_timing_rules
|-- delivery_details
|   `-- parcel_id + warehouse_id
|       |-- parcel_logs
|       |   `-- v_parcel_status_min
|       |-- collectors_report
|       |-- prepare_report
|       |-- items_per_order
|       |-- freshdesk_tickets
|       `-- wa_orders
|
`-- feeds v_parcel_base
    `-- v_parcel_kpi
        |-- v_parcel_phases
        |-- v_dod_summary
        |   `-- v_dod_summary_daily_rollup
        |-- v_raw_delivery_stages
        |   `-- v_raw_delivery_stages_with_source
        |-- v_zone_performance
        |-- v_avg_delivery_time
        |   `-- v_avg_delivery_time_daily_rollup
        |-- v_wow_summary
        |-- v_mom_summary
        |-- v_promise_reliability_daily
        |   `-- v_promise_reliability_daily_rollup
        `-- v_route_efficiency_daily
            `-- v_route_efficiency_daily_rollup

api/ingest --> ingest_runs --> v_ingest_health_daily
v_parcel_kpi + v_dod_summary + ingest_runs --> data_quality_issues
v_parcel_kpi --> delivery_exceptions --> exception_actions
delivery_exceptions --> v_exceptions_summary_daily / v_exception_aging
```

### 5.2 Base/config tables

| Object | Related to | How it is populated | Notes / calculations |
|---|---|---|---|
| `warehouses` | Parent for almost every warehouse-scoped table | Seeded by migration; updated when warehouse defaults change | Holds warehouse code, timezone, default SLA minutes, and default shift window. |
| `warehouse_shift_overrides` | `warehouses` by `warehouse_id` | Settings/schedule workflows or manual DB maintenance | Per-date override of shift start/end. `effective_shift_window()` uses this first, then warehouse defaults. |
| `warehouse_shift_configs` | `warehouses` by `warehouse_id` | Seeded from warehouse defaults in migration; maintained by settings/schedule flows | Used by data quality checks to detect missing active schedules. |
| `warehouse_city_sla_configs` | `warehouses` by `warehouse_id` | Settings/config uploads or manual maintenance | City-level SLA minute override. `v_parcel_base` uses `coalesce(city SLA, warehouse SLA)`. |
| `warehouse_delivery_timing_rules` | `warehouses` by `warehouse_id` and city | Uploaded as `delivery_timing_rules` through `/upload` -> `/api/ingest` | Stores city-specific promise logic: `SAME_DAY` or `FIXED_HOURS`, plus optional cutoff/start times. |
| `shift_templates` | Standalone helper table | Manually managed from settings/admin workflows | Stores reusable JSON schedule templates. |

### 5.3 Uploaded/raw operational tables

| Object | Grain / key | How it is populated | Used by |
|---|---|---|---|
| `delivery_details` | 1 row per `warehouse_id + parcel_id` | CSV upload (`delivery_details`) | Core order facts: order time, delivery address, city/area/zone, delivered status. Drives all parcel KPI views. |
| `parcel_logs` | 1 row per `warehouse_id + parcel_id + parcel_status + status_ts` | CSV upload (`parcel_logs`) | Stage timestamp history. `v_parcel_status_min` extracts the first timestamp for each status. |
| `collectors_report` | 1 row per `warehouse_id + parcel_id` | CSV upload (`collectors_report`) | Optional collector metadata joined into raw delivery stages. |
| `prepare_report` | 1 row per `warehouse_id + parcel_id` | CSV upload (`prepare_report`) | Optional wrapper metadata joined into raw delivery stages. |
| `items_per_order` | 1 row per `warehouse_id + parcel_id` | CSV upload (`items_per_order`) | Optional item counts joined into raw delivery stages. |
| `freshdesk_tickets` | 1 row per `warehouse_id + ticket_id` | CSV upload (`freshdesk_tickets`) | Customer issue/ticket data. Aggregated in `v_raw_delivery_stages` to flag parcels with tickets. |
| `wa_orders` | 1 row per `warehouse_id + parcel_id` | CSV upload (`wa_orders`) | Explicit waiting-address source list. Also inferred from address text in `delivery_details`. |
| `ingest_runs` | 1 row per ingest API call | Written automatically by `/api/ingest` after each upload | Observability table: parsed/valid/inserted/ignored/warning/error counts per file upload. |
| `data_quality_issues` | 1 row per detected issue instance | Rebuilt by `detect_data_quality_issues()` | Stores current unresolved data-quality findings plus samples and counts. |
| `delivery_exceptions` | 1 row per detected parcel exception | Rebuilt by `refresh_delivery_exceptions()` | Late-delivery exception queue for operations workflows. |
| `exception_actions` | 1 row per action on an exception | App/workflow writes as users acknowledge/resolve | Audit trail for exception handling. |

### 5.4 Derived/calculated views

| View | Built from | What it calculates |
|---|---|---|
| `v_parcel_status_min` | `parcel_logs` | First timestamp per parcel for each tracked stage: Collecting, Ready For Preparing, Prepare, Ready For Delivery, On The Way, Delivered. |
| `v_parcel_base` | `delivery_details` + `warehouses` + `warehouse_city_sla_configs` + `wa_orders` + `v_parcel_status_min` | Normalized parcel record with local timestamps, warehouse metadata, waiting-address flag, and effective SLA minutes. |
| `v_parcel_kpi` | `v_parcel_base` + `effective_shift_window()` | Cutoff status, promised deadline, and `is_on_time`. Main logic layer for parcel KPI calculations. |
| `v_parcel_phases` | `v_parcel_kpi` + `work_seconds_between()` | Raw and shift-adjusted seconds for each stage segment. |
| `v_dod_summary` | `v_parcel_kpi` | Daily OTD summary including/excluding WA orders. |
| `v_raw_delivery_stages` | `v_parcel_kpi` + optional raw enrichment tables + delivery timing rules | Parcel-level operational stage table with SLA expectations, actual durations, statuses, and issue classification. |
| `v_raw_delivery_stages_with_source` | `v_raw_delivery_stages` + `warehouse_delivery_timing_rules` | Adds whether timing came from `CITY_RULE` or `WAREHOUSE_FALLBACK`. |
| `v_zone_performance` | `v_parcel_kpi` | Daily warehouse/zone/city/area performance. |
| `v_avg_delivery_time` | `v_parcel_kpi` | Daily average, median, min, max delivery minutes. |
| `v_wow_summary` | `v_parcel_kpi` | Weekly totals, delivery counts, OTD%, WA counts, and average delivery time. |
| `v_mom_summary` | `v_parcel_kpi` | Monthly version of the same summary logic. |
| `v_ingest_health_daily` | `ingest_runs` | Daily upload health and throughput by warehouse/dataset. |
| `v_exceptions_summary_daily` | `delivery_exceptions` | Daily counts of total/open/resolved exceptions by severity. |
| `v_exception_aging` | `delivery_exceptions` | Current aging in hours for each exception. |
| `v_promise_reliability_daily` | `v_parcel_kpi` | Promise hit rate and average ETA error by warehouse/day/city. |
| `v_route_efficiency_daily` | `v_parcel_kpi` | Orders per active area, delivery speed, and OTD by warehouse/day/city. |
| `*_daily_rollup` views | Their per-warehouse source views | Add explicit `ALL` warehouse rows by aggregating all warehouses for each day. |

### 5.5 Key calculations explained

#### Waiting Address (`waiting_address`)
A parcel is treated as WA when either:
- `delivery_details.delivery_address` contains markers like `extra info: wa` / `extra: wa`, or
- the same `warehouse_id + parcel_id` exists in `wa_orders`.

#### Effective SLA (`effective_sla_minutes`)
`v_parcel_base` computes:
- `effective_sla_minutes = coalesce(warehouse_city_sla_configs.sla_minutes, warehouses.sla_minutes)`

So city-specific SLA overrides win; otherwise warehouse default SLA is used.

#### Cutoff handling (`cutoff_status`)
`v_parcel_kpi` compares `order_local::time` against the effective shift window for the warehouse/day:
- before shift start -> `Before Shift`
- after shift end -> `After Cutoff Time`
- otherwise -> `Normal`

This changes how the promised deadline is calculated.

#### Deadline and On-Time KPI (`deadline_local`, `is_on_time`)
At a high level:
- before shift: deadline starts from that day's shift start + SLA
- after cutoff: deadline starts from the next shift start + SLA
- normal orders: deadline is `order_local + SLA`

Then:
- `is_on_time = delivered_local <= deadline_local`

For cities with uploaded `warehouse_delivery_timing_rules`, `v_raw_delivery_stages` can override the delivery expectation with:
- `SAME_DAY`: promise is end-of-day / next-day style depending on cutoff status
- `FIXED_HOURS`: promise is a configured number of hours, with extra waiting added when order is before shift or after cutoff

#### Stage durations (`v_parcel_phases` and `v_raw_delivery_stages`)
Raw stage durations are direct timestamp differences, for example:
- `processing_raw = collecting_local - order_local`
- `picker_phase = ready_for_preparing_local - collecting_local`
- `prepare_wait = prepare_local - ready_for_preparing_local`
- `wrapping_phase = ready_for_delivery_local - prepare_local`
- `delivery_wait = on_the_way_local - ready_for_delivery_local`
- `deliver_time = delivered_local - on_the_way_local`

Adjusted stage durations use `work_seconds_between(...)`, which only counts time inside the warehouse's effective shift windows.

#### Day-over-day summary (`v_dod_summary`)
Core daily formulas are:
- `total_placed_inc_wa` = all distinct parcels created that day
- `total_delivered_inc_wa` = distinct parcels with `delivered_ts`
- `on_time_inc_wa` = distinct parcels where `is_on_time = true`
- `otd_pct_inc_wa = on_time_inc_wa / total_delivered_inc_wa * 100`
- `wa_count` = distinct parcels flagged as WA
- `total_delivered_exc_wa` / `on_time_exc_wa` / `otd_pct_exc_wa` repeat the same logic after removing WA parcels
- `wa_delivered_count` = WA parcels with `delivered_ts`

#### Raw Delivery Stages SLA logic (`v_raw_delivery_stages`)
Important computed fields:
- `processing_expected_time`: expected wait until processing should begin based on shift timing
- `processing_actual_time`: processing delay after removing expected before-shift/after-cutoff waiting
- `processing_time_status`: `Within SLA` if `processing_actual_time <= 10 minutes`
- `preparing_actual_time`: picker + prepare wait + wrapping + delivery wait, plus some processing overage when not WA
- `preparing_time_status`: `Within SLA` if `preparing_actual_time <= 20 minutes`
- `delivery_time_status`: `Within SLA` if actual delivery duration is within the applicable delivery promise
- `ops_exceeded_30_mins`: for late non-WA parcels without tickets, classify as `Ops Issue` when `ops_time >= 31 minutes`; otherwise `Wait on Delivery Issue`

#### Promise Reliability (`v_promise_reliability_daily`)
- `delivered_with_promise` = delivered parcels with a non-null `deadline_local`
- `within_promise_window` = delivered parcels where `delivered_local <= deadline_local`
- `promise_hit_rate = within_promise_window / delivered_with_promise * 100`
- `avg_eta_error_minutes = avg(delivered_local - deadline_local)` in minutes

#### Route Efficiency (`v_route_efficiency_daily`)
- `active_areas` = distinct non-blank areas in the grouped set
- `parcels_per_active_area = total_orders / active_areas`
- `avg_delivery_minutes = avg(delivered_ts - order_ts_utc)` in minutes
- `otd_pct = on_time_count / delivered_count * 100`

#### Ingest health (`v_ingest_health_daily`)
Derived from `ingest_runs`:
- total runs per day/dataset/warehouse
- summed inserted/ignored/warning/error counts
- average upload duration in seconds

#### Data quality and exceptions
- `detect_data_quality_issues()` clears unresolved rows and re-inserts current findings from `v_parcel_kpi`, `v_dod_summary`, `warehouse_delivery_timing_rules`, and `ingest_runs`.
- `refresh_delivery_exceptions()` creates late-delivery exceptions from parcels where `delivered_ts > deadline_local`, and severity depends on hours late.

### 5.6 Upload order for clean population

Recommended upload sequence:
1. `delivery_details`
2. `parcel_logs`
3. `items_per_order`, `collectors_report`, `prepare_report` (optional enrichment)
4. `wa_orders`
5. `delivery_timing_rules`

Reason:
- `delivery_details` provides the parcel backbone
- `parcel_logs` supplies the stage timestamps needed for KPI and raw-stage calculations
- enrichment datasets add extra context only
- WA orders and timing rules refine KPI classification and promise logic after the backbone exists

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



