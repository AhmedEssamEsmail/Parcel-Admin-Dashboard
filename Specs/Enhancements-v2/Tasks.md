# Tasks Breakdown - Enhancements v2
## Parcel Admin Dashboard - SLA, Layout, and Refresh Improvements

**Project:** Parcel Admin Dashboard  
**Date:** March 2026  
**Version:** Enhancements v2

---

## 1. Task Overview

This document lists the implementation tasks required for Enhancements v2.

---

## 2. Database & Schema Tasks

### TASK-DB-1: Add City SLA Configuration Table

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** None

**Files:**
- `supabase/migrations/<new_timestamp>_add_city_sla_configs.sql`
- `sql/supabase_schema_v2.sql`

**Steps:**
1. Create `warehouse_city_sla_configs` table with constraints
2. Add index on `(warehouse_id, city_normalized)`
3. Update canonical schema file to match
4. Ensure migration is idempotent

**Acceptance Criteria:**
- [x] Table created with correct schema
- [x] Unique constraint enforces warehouse+city uniqueness
- [x] Canonical schema updated *(intentionally handled via migration-only policy per repo rule)*

**Implementation Notes (2026-03-04):**
- Added: `supabase/migrations/20260304240000_add_city_sla_configs.sql`
- Included idempotent table creation, unique constraint, and lookup index.

---

### TASK-DB-2: Apply City SLA in KPI Calculations

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** TASK-DB-1

**Files:**
- `sql/supabase_schema_v2.sql`
- `supabase/migrations/<new_timestamp>_add_city_sla_configs.sql` (view updates)

**Steps:**
1. Join city SLA config in `v_parcel_base`
2. Add `effective_sla_minutes` column
3. Replace `sla_minutes` in deadline calculations with effective SLA
4. Validate fallback to warehouse SLA

**Acceptance Criteria:**
- [x] City SLA overrides warehouse SLA when present
- [x] Warehouse SLA remains default fallback
- [x] No API response schema changes

**Implementation Notes (2026-03-04):**
- Updated `v_parcel_base` to join city SLA configs and expose `effective_sla_minutes`.
- Updated `v_parcel_kpi` deadline/on-time logic to use `effective_sla_minutes`.

---

## 3. API Tasks (SLA Management)

### TASK-API-1: City SLA CRUD Endpoint

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** TASK-DB-1

**Files:**
- `app/api/settings/sla/route.ts`

**Steps:**
1. Add GET for listing configs (filters: warehouse_code, city)
2. Add POST for upsert batch
3. Validate inputs (warehouse exists, city not empty, SLA range)

**Acceptance Criteria:**
- [x] Endpoint supports filtered list
- [x] Upsert works with validation errors

**Implementation Notes (2026-03-04):**
- Added: `app/api/settings/sla/route.ts`
- GET supports `warehouse_code` and `city` filters.
- POST supports batch upsert with row-level validation.

---

### TASK-API-2: SLA Export Endpoint

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-API-1

**Files:**
- `app/api/settings/sla/export/route.ts`

**Steps:**
1. Query city SLA configs
2. Format CSV
3. Return with file download headers

**Acceptance Criteria:**
- [x] CSV includes warehouse_code, city, sla_minutes
- [x] File downloads successfully

**Implementation Notes (2026-03-04):**
- Added: `app/api/settings/sla/export/route.ts`
- Returns CSV with download headers.

---

### TASK-API-3: SLA Import Endpoint

**Priority:** HIGH  
**Estimate:** 1.5 hours  
**Dependencies:** TASK-API-1

**Files:**
- `app/api/settings/sla/import/route.ts`

**Steps:**
1. Parse CSV payload
2. Validate rows, normalize city
3. Upsert valid rows
4. Return summary + error list

**Acceptance Criteria:**
- [x] Invalid rows are rejected with reasons
- [x] Valid rows are upserted
- [x] Summary counts are accurate

**Implementation Notes (2026-03-04):**
- Added: `app/api/settings/sla/import/route.ts`
- Parses CSV payload, validates rows, upserts valid rows, and returns summary/errors.

---

## 4. Settings UI Tasks

### TASK-UI-1: Warehouse → City SLA Management UI

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-API-1

**Files:**
- `app/settings/page.tsx`

**Steps:**
1. Replace warehouse SLA table with city-level grid
2. Add warehouse filter selector
3. Allow inline SLA edits
4. Add error/success banners

**Acceptance Criteria:**
- [x] City SLA rows editable and persisted
- [x] Warehouse fallback remains visible

**Implementation Notes (2026-03-04):**
- Updated: `app/settings/page.tsx`
- Replaced warehouse SLA editor with city-level SLA grid + inline save.
- Added warehouse filter and success/error banners.

---

### TASK-UI-2: SLA Import/Export Controls

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** TASK-API-2, TASK-API-3

**Files:**
- `app/settings/page.tsx`

**Steps:**
1. Add Export CSV button
2. Add Import CSV control (file input)
3. Display import results summary

**Acceptance Criteria:**
- [x] Export triggers CSV download
- [x] Import summary shows inserted/updated/errors

**Implementation Notes (2026-03-04):**
- Updated: `app/settings/page.tsx`
- Added Export CSV button, Import file input/action, and import summary/errors UI.

---

## 5. Dashboard Layout + Refresh

### TASK-DASH-1: Reorder Dashboard Sections

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** None

**Files:**
- `app/dashboard/page.tsx`

**Steps:**
1. Move On-Time Performance chart above OTD tables
2. Move WoW table, comparison widget, leaderboard above OTD tables
3. Verify order matches spec

**Acceptance Criteria:**
- [x] Section order matches requested sequence

**Implementation Notes (2026-03-04):**
- Updated: `app/dashboard/page.tsx`
- Moved WoW, comparison, leaderboard, and on-time chart above OTD tables.

---

### TASK-DASH-2: Refresh Cadence Update

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-DASH-1

**Files:**
- `app/dashboard/page.tsx`

**Steps:**
1. Change auto-refresh interval to 2 hours
2. Remove pause/resume state + button
3. Keep manual refresh button

**Acceptance Criteria:**
- [x] Auto-refresh runs every 2 hours
- [x] Pause button removed
- [x] Manual refresh still available

**Implementation Notes (2026-03-04):**
- Updated: `app/dashboard/page.tsx`
- Set auto-refresh interval to 2 hours and removed pause/resume UI/state.

---

## 6. Layout Widening

### TASK-UI-3: Widen Global Layout

**Priority:** MEDIUM  
**Estimate:** 0.5 hours  
**Dependencies:** None

**Files:**
- `app/globals.css`

**Steps:**
1. Increase `.page-wrap` max-width and viewport usage
2. Validate cards and tables align properly
3. Ensure existing breakpoints still function

**Acceptance Criteria:**
- [x] Desktop view uses wider width
- [x] Tablet/mobile breakpoints unaffected

**Implementation Notes (2026-03-04):**
- Updated: `app/globals.css`
- `.page-wrap` widened to `min(1560px, 98vw)`.

---

## 7. Verification Checklist

**Verification Status (2026-03-04):**
- ✅ npm run build
- ✅ npm run validate
- ✅ npm run test:run
- ✅ npm run test:integration
- ✅ npm run type-check
- ✅ npm run lint

Run after each phase and at the end:

1. `npm run build`
2. `npm run validate`
3. `npm run test:run`
4. `npm run test:integration`
5. `npm run type-check`
6. `npm run lint`

---

## 8. Hotfix Tasks - Findings #1, #3, #4 (2026-03-04)

### TASK-HOTFIX-1: Fix `order_ts` vs `order_ts_utc` mismatch

- [x] Updated `app/api/compare-periods/route.ts` to query `order_ts_utc` and hardened duration guards.
- [x] Updated `app/api/export/csv/route.ts` comparison query to use `order_ts_utc`.

### TASK-HOTFIX-2: Replace in-memory limiter with Supabase-backed distributed limiter

- [x] Added migration `supabase/migrations/20260305000100_create_api_rate_limit_function.sql`.
- [x] Refactored `lib/middleware/rate-limit.ts` to use `check_rate_limit` RPC with async wrapper and IP+pathname keying.
- [x] Removed referer-based bypass behavior.

### TASK-HOTFIX-3: Replace placeholder tests with executable coverage

- [x] Replaced `scripts/tests/run.js` placeholder with smoke/unit checks.
- [x] Replaced `scripts/tests/integration.js` placeholder with deterministic mocked integration checks for findings #1 and #3.

**Verification run (post-hotfix):**
- [x] `npm run build`
- [x] `npm run validate`
- [x] `npm run test:run`
- [x] `npm run test:integration`
- [x] `npm run type-check`
- [x] `npm run lint`
