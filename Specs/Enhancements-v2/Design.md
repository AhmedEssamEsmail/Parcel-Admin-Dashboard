# Design Specification - Enhancements v2
## Parcel Admin Dashboard - SLA, Layout, and Refresh Improvements

**Project:** Parcel Admin Dashboard  
**Date:** March 2026  
**Version:** Enhancements v2

---

## 1. Architecture Impact Overview

Enhancements v2 add a city-level SLA configuration layer, a new import/export API surface, and UI layout adjustments on the dashboard and global pages.

### 1.1 Impacted Layers

| Layer | Impact |
|-------|--------|
| Database | Add city SLA config table, adjust KPI views/functions to use effective SLA |
| API | Add SLA CRUD + import/export endpoints |
| UI | Settings page update, dashboard layout reorder, refresh cadence updates |
| Styling | Wider page layout and card spacing |

---

## 2. Data Model Design

### 2.1 New Table: `warehouse_city_sla_configs`

**Purpose:** Store SLA minutes per warehouse + city.

```sql
create table if not exists public.warehouse_city_sla_configs (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  city text not null,
  city_normalized text not null,
  sla_minutes int not null check (sla_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, city_normalized)
);

create index if not exists idx_city_sla_lookup
  on public.warehouse_city_sla_configs (warehouse_id, city_normalized);
```

### 2.2 Effective SLA Resolution

Effective SLA should be resolved as:

```
effective_sla = coalesce(city_sla.sla_minutes, warehouse.sla_minutes)
```

City match is performed by normalized city string (trimmed + lowercased).

---

## 3. KPI Calculation Adjustments

### 3.1 View Updates

The following KPI views and functions reference `sla_minutes` and must be updated to use city-level SLA when available:

- `public.v_parcel_base`
- `public.v_parcel_kpi`
- Any downstream view that uses `sla_minutes` or `deadline_local`

### 3.2 Implementation Approach

1. Join `warehouse_city_sla_configs` on `warehouse_id` + normalized `city`.
2. Add `effective_sla_minutes` in `v_parcel_base`.
3. Replace `sla_minutes` usage in KPI deadline calculation with `effective_sla_minutes`.
4. Preserve column names in API responses (no breaking changes).

---

## 4. SLA Import/Export API Design

### 4.1 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/sla` | List city SLA configs (filters: warehouse_code, city) |
| POST | `/api/settings/sla` | Upsert city SLA rows |
| GET | `/api/settings/sla/export` | Export CSV |
| POST | `/api/settings/sla/import` | Import CSV and upsert rows |

### 4.2 CSV Format

```
warehouse_code,city,sla_minutes
KUWAIT,Kuwait City,240
RIYADH,Riyadh,270
```

### 4.3 Import Validation

- Ensure warehouse_code exists.
- city is non-empty.
- sla_minutes is integer 1-1440.
- Normalize city for upsert matching.

Import response should include:

```
{
  total_rows: number,
  inserted: number,
  updated: number,
  errors: [{ row: number, reason: string }]
}
```

---

## 5. Settings UI Design

### 5.1 Warehouse → City SLA Panel

- Replace current "Warehouse SLA Settings" table with city SLA grid.
- Show warehouse selector + city rows.
- Allow inline editing of SLA minutes per city.
- Include **Export CSV** and **Import CSV** controls.

### 5.2 Error Handling

- Inline error banner for API failures.
- Import results summary (success + error count).

---

## 6. Dashboard Layout + Refresh Design

### 6.1 Section Order (Top → Bottom)

1. On-Time Performance Chart
2. Week-over-Week Performance (Including WA Orders)
3. Compare Periods
4. Performance Leaderboard
5. On-Time Delivery - Including Waiting Address Orders
6. On-Time Delivery - Excluding Waiting Address Orders

### 6.2 Refresh Behavior

- Auto refresh interval: 2 hours (7,200,000 ms)
- Remove pause/resume button + state
- Keep manual refresh button and last-updated indicator

---

## 7. Global Layout Widening

### 7.1 CSS Updates

- Increase `.page-wrap` max width (e.g., 1440–1560px)
- Keep responsive breakpoints intact
- Maintain full-width tables and card spacing

---

## 8. Validation Strategy

After each phase and at the end:

1. `npm run build`
2. `npm run validate`
3. `npm run test:run`
4. `npm run test:integration`
5. `npm run type-check`
6. `npm run lint`
