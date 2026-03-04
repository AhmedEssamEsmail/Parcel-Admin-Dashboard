# Tasks Breakdown
## Implementation Tasks for KPI Calculation Fixes - Parcel Admin Dashboard

**Project:** Parcel Admin Dashboard  
**Date:** March 2026  
**Version:** 2.0

---

## 1. Task Overview

This document breaks down all implementation work into actionable tasks with dependencies, estimates, and acceptance criteria. Tasks are organized by phase and priority.

### 1.1 Task Summary

| Phase | Tasks | Total Hours |
|-------|-------|-------------|
| Phase 1: Database Layer | 6 tasks | 6 hours |
| Phase 2: Settings API | 4 tasks | 6 hours |
| Phase 3: Settings Frontend | 3 tasks | 8 hours |
| Phase 4: Dashboard Changes | 3 tasks | 5 hours |
| Phase 5: Testing & Deployment | 4 tasks | 5 hours |
| **TOTAL** | **20 tasks** | **30 hours** |

---

## 2. Phase 1: Database Layer Tasks

### TASK-DB-1: Create warehouse_shift_configs Table

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** None

**Description:**
Create the new table for storing per-day shift configurations.

**Steps:**
1. Create migration file `supabase/migrations/XXXXXX_warehouse_shift_configs.sql`
2. Define table schema with proper constraints
3. Add unique index on (warehouse_id, day_of_week)
4. Add foreign key constraint to warehouses table
5. Add table-level comment for documentation

**SQL Schema:**
```sql
CREATE TABLE IF NOT EXISTS public.warehouse_shift_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, day_of_week)
);

CREATE INDEX idx_warehouse_shift_configs_lookup 
  ON public.warehouse_shift_configs(warehouse_id, day_of_week);

COMMENT ON TABLE public.warehouse_shift_configs IS 
  'Per-day shift configuration. day_of_week: 0=Sunday, 6=Saturday';
```

**Acceptance Criteria:**
- [ ] Table created in development database
- [ ] Index created and verified
- [ ] Foreign key constraint working
- [ ] Unique constraint prevents duplicate day entries

---

### TASK-DB-2: Populate Default Shift Configurations

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-DB-1

**Description:**
Populate initial shift configs from existing warehouse defaults.

**Steps:**
1. Write INSERT script to copy from warehouse defaults
2. Generate rows for all 7 days per warehouse
3. Run migration
4. Verify all warehouses have 7 rows each

**SQL:**
```sql
INSERT INTO public.warehouse_shift_configs (warehouse_id, day_of_week, shift_start, shift_end)
SELECT 
  w.id,
  gs.dow,
  w.default_shift_start,
  w.default_shift_end
FROM public.warehouses w
CROSS JOIN generate_series(0, 6) AS gs(dow)
ON CONFLICT (warehouse_id, day_of_week) DO NOTHING;

-- Verification
SELECT w.code, COUNT(sc.day_of_week) as configured_days
FROM warehouses w
LEFT JOIN warehouse_shift_configs sc ON sc.warehouse_id = w.id
GROUP BY w.code;
-- Expected: All warehouses show 7 configured_days
```

**Acceptance Criteria:**
- [ ] All 7 warehouses have 7 shift config rows
- [ ] Shift times match warehouse defaults
- [ ] No duplicate entries

---

### TASK-DB-3: Add SLA Column to Warehouses (Verify)

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** None

**Description:**
Verify sla_minutes column exists with correct default.

**Steps:**
1. Check if column exists
2. Add if missing
3. Verify default value is 240

**SQL:**
```sql
-- Check column
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'warehouses' AND column_name = 'sla_minutes';

-- Add if missing
ALTER TABLE public.warehouses 
ADD COLUMN IF NOT EXISTS sla_minutes INT NOT NULL DEFAULT 240;

-- Update existing rows if needed
UPDATE public.warehouses SET sla_minutes = 240 WHERE sla_minutes IS NULL;
```

**Acceptance Criteria:**
- [ ] sla_minutes column exists
- [ ] Default is 240 minutes
- [ ] All warehouses have sla_minutes value

---

### TASK-DB-4: Fix v_parcel_kpi is_on_time Calculation

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-DB-1, TASK-DB-2

**Description:**
Update is_on_time calculation to handle after-cutoff orders with NULL next_shift_start.

**Steps:**
1. Create new version of v_parcel_kpi view
2. Join with warehouses table for default_shift_start access
3. Implement fallback logic for NULL next_shift_start
4. Add comments explaining logic
5. Test with edge cases

**Modified CASE Statement:**
```sql
case
  when delivered_ts is null then null
  when shift_start is null or shift_end is null then null
  
  -- After-cutoff: use fallback if next_shift_start is null
  when order_local::time > shift_end then
    case
      when next_shift_start is not null then
        delivered_local <= ((created_date_local + 1) + next_shift_start) + make_interval(mins => sla_minutes)
      else
        -- Fallback to warehouse default_shift_start
        delivered_local <= ((created_date_local + 1) + w.default_shift_start) + make_interval(mins => sla_minutes)
    end
    
  -- Before-shift: deadline = shift_start + SLA (CONFIRMED CORRECT - DO NOT CHANGE)
  when order_local::time < shift_start then
    delivered_local <= (created_date_local + shift_start) + make_interval(mins => sla_minutes)
    
  -- Normal: deadline = order_time + SLA
  else
    delivered_local <= order_local + make_interval(mins => sla_minutes)
end as is_on_time
```

**Acceptance Criteria:**
- [ ] After-cutoff orders have is_on_time calculated (not NULL)
- [ ] Pre-shift orders have shift_start + SLA deadline
- [ ] Normal orders have order_time + SLA deadline
- [ ] SQL view returns results without errors

---

### TASK-DB-5: Create v_dod_summary View with Dual Tables

**Priority:** HIGH  
**Estimate:** 1.5 hours  
**Dependencies:** TASK-DB-4

**Description:**
Create new view returning dual metrics (inc_wa / exc_wa).

**Steps:**
1. Design view structure with dual table columns
2. Implement WITH clause for base data
3. Add WA filtering logic
4. Add data quality columns
5. Add view comments

**View Structure:**
```sql
CREATE OR REPLACE VIEW public.v_dod_summary AS
WITH base_data AS (
  SELECT
    warehouse_code,
    created_date_local AS day,
    parcel_id,
    is_on_time,
    waiting_address,
    delivered_ts
  FROM public.v_parcel_kpi
)
SELECT
  warehouse_code,
  day,
  
  -- Including WA
  COUNT(DISTINCT parcel_id) AS total_placed_inc_wa,
  COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL) AS total_delivered_inc_wa,
  COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE) AS on_time_inc_wa,
  CASE
    WHEN COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL) = 0 THEN NULL
    ELSE ROUND(
      (COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE))::NUMERIC 
      / COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL)::NUMERIC 
      * 100, 2
    )
  END AS otd_pct_inc_wa,
  
  -- Excluding WA
  COUNT(DISTINCT parcel_id) FILTER (WHERE NOT waiting_address OR waiting_address IS NULL) AS total_placed_exc_wa,
  COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL AND (NOT waiting_address OR waiting_address IS NULL)) AS total_delivered_exc_wa,
  COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE AND (NOT waiting_address OR waiting_address IS NULL)) AS on_time_exc_wa,
  CASE
    WHEN COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL AND (NOT waiting_address OR waiting_address IS NULL)) = 0 THEN NULL
    ELSE ROUND(
      (COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE AND (NOT waiting_address OR waiting_address IS NULL)))::NUMERIC 
      / COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL AND (NOT waiting_address OR waiting_address IS NULL))::NUMERIC 
      * 100, 2
    )
  END AS otd_pct_exc_wa,
  
  -- Data quality
  COUNT(DISTINCT parcel_id) FILTER (WHERE waiting_address IS TRUE) AS wa_count

FROM base_data
GROUP BY warehouse_code, day
ORDER BY warehouse_code, day;
```

**Acceptance Criteria:**
- [ ] View returns both inc_wa and exc_wa metrics
- [ ] OTD% calculated as on_time / delivered (not placed)
- [ ] wa_count column populated
- [ ] Query performance < 500ms for 45-day range

---

### TASK-DB-6: Add Performance Indexes

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-DB-4, TASK-DB-5

**Description:**
Create indexes for dashboard query performance.

**SQL:**
```sql
-- Index for dashboard date range queries
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_dashboard 
  ON public.v_parcel_kpi (warehouse_code, created_date_local)
  WHERE delivered_ts IS NOT NULL;

-- Index for WA filtering
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_wa 
  ON public.v_parcel_kpi (warehouse_code, created_date_local, waiting_address);

-- Index for on_time filtering
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_ontime 
  ON public.v_parcel_kpi (warehouse_code, created_date_local, is_on_time);

-- Verify index usage
EXPLAIN ANALYZE 
SELECT * FROM v_dod_summary 
WHERE warehouse_code = 'KUWAIT' 
  AND day BETWEEN '2026-01-01' AND '2026-02-15';
```

**Acceptance Criteria:**
- [ ] All indexes created
- [ ] EXPLAIN shows index usage
- [ ] Query time < 1 second for 45-day range

---

## 3. Phase 2: Settings API Tasks

### TASK-API-1: Create Settings API Directory Structure

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** None

**Description:**
Create the API route structure for settings endpoints.

**Steps:**
1. Create `app/api/settings/` directory
2. Create route files structure
3. Add base validation utilities

**Directory Structure:**
```
app/api/settings/
├── route.ts                    # GET warehouses list
├── sla/
│   └── route.ts               # PUT update SLA
├── shifts/
│   └── [warehouse]/
│       └── route.ts           # GET/PUT shifts per warehouse
└── overrides/
    ├── route.ts               # GET list, POST create
    └── [id]/
        └── route.ts           # PUT update, DELETE remove
```

**Acceptance Criteria:**
- [ ] Directory structure created
- [ ] Base TypeScript types defined
- [ ] Linting passes

---

### TASK-API-2: Implement Warehouses Settings Endpoint

**Priority:** HIGH  
**Estimate:** 1.5 hours  
**Dependencies:** TASK-API-1

**Description:**
Create endpoints for warehouse SLA configuration.

**Steps:**
1. Implement GET `/api/settings` - list all warehouses with settings
2. Implement PUT `/api/settings/sla` - update SLA for warehouse
3. Add validation with Zod
4. Add error handling

**TypeScript:**
```typescript
// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const UpdateSlaSchema = z.object({
  warehouse_id: z.string().uuid(),
  sla_minutes: z.number().int().min(1).max(1440)
});

export async function GET() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, code, name, sla_minutes, default_shift_start, default_shift_end, tz")
    .order("code");
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ warehouses: data });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const parsed = UpdateSlaSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  
  const { warehouse_id, sla_minutes } = parsed.data;
  const supabase = getSupabaseAdminClient();
  
  const { error } = await supabase
    .from("warehouses")
    .update({ sla_minutes, updated_at: new Date().toISOString() })
    .eq("id", warehouse_id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true, warehouse_id, sla_minutes });
}
```

**Acceptance Criteria:**
- [ ] GET returns all warehouses with settings
- [ ] PUT updates SLA for specific warehouse
- [ ] Validation rejects invalid SLA values
- [ ] Error handling returns proper HTTP codes

---

### TASK-API-3: Implement Shifts Configuration Endpoint

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-API-1, TASK-DB-1

**Description:**
Create endpoints for per-day shift configuration.

**Steps:**
1. Implement GET `/api/settings/shifts/[warehouse]`
2. Implement PUT `/api/settings/shifts/[warehouse]`
3. Add validation for time format and day range
4. Ensure shift_end > shift_start validation

**TypeScript:**
```typescript
// app/api/settings/shifts/[warehouse]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

const ShiftSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  shift_start: TimeSchema,
  shift_end: TimeSchema,
  is_active: z.boolean()
}).refine(data => data.shift_end > data.shift_start, {
  message: "shift_end must be after shift_start"
});

const ShiftsUpdateSchema = z.object({
  shifts: z.array(ShiftSchema).length(7)
});

export async function GET(
  request: NextRequest,
  { params }: { params: { warehouse: string } }
) {
  const warehouseCode = params.warehouse.toUpperCase();
  const supabase = getSupabaseAdminClient();
  
  // Get warehouse ID
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id, code")
    .eq("code", warehouseCode)
    .single();
  
  if (!warehouse) {
    return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  }
  
  // Get shift configs
  const { data: shifts, error } = await supabase
    .from("warehouse_shift_configs")
    .select("day_of_week, shift_start, shift_end, is_active")
    .eq("warehouse_id", warehouse.id)
    .order("day_of_week");
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ 
    warehouse_code: warehouseCode,
    shifts: shifts 
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { warehouse: string } }
) {
  const warehouseCode = params.warehouse.toUpperCase();
  const body = await request.json();
  const parsed = ShiftsUpdateSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  
  const supabase = getSupabaseAdminClient();
  
  // Get warehouse ID
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id")
    .eq("code", warehouseCode)
    .single();
  
  if (!warehouse) {
    return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  }
  
  // Update shifts
  const updates = parsed.data.shifts.map(shift => ({
    warehouse_id: warehouse.id,
    ...shift,
    updated_at: new Date().toISOString()
  }));
  
  const { error } = await supabase
    .from("warehouse_shift_configs")
    .upsert(updates, { onConflict: "warehouse_id,day_of_week" });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true, warehouse_code: warehouseCode });
}
```

**Acceptance Criteria:**
- [ ] GET returns 7 shift configs for warehouse
- [ ] PUT updates all 7 days atomically
- [ ] Validation rejects shift_end <= shift_start
- [ ] Invalid time format rejected

---

### TASK-API-4: Implement Holiday Overrides Endpoint

**Priority:** MEDIUM  
**Estimate:** 2 hours  
**Dependencies:** TASK-API-1

**Description:**
Create endpoints for holiday/override management.

**Steps:**
1. Implement GET `/api/settings/overrides` - list with filters
2. Implement POST `/api/settings/overrides` - create single
3. Implement POST bulk endpoint for Ramadan
4. Implement DELETE `/api/settings/overrides/[id]`

**TypeScript:**
```typescript
// app/api/settings/overrides/route.ts
const CreateOverrideSchema = z.object({
  warehouse_code: z.string(),
  override_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable(),
  shift_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable(),
  reason: z.string().min(1).max(100)
});

const BulkOverrideSchema = z.object({
  warehouse_code: z.string(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  shift_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  reason: z.string().min(1).max(100)
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Check if bulk operation
  if (body.start_date && body.end_date) {
    return handleBulkCreate(body);
  }
  
  return handleSingleCreate(body);
}
```

**Acceptance Criteria:**
- [ ] GET lists overrides with date range filter
- [ ] POST creates single override
- [ ] Bulk POST creates multiple overrides
- [ ] DELETE removes override
- [ ] Validation prevents duplicate dates per warehouse

---

## 4. Phase 3: Settings Frontend Tasks

### TASK-UI-1: Create Settings Page Base

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** None

**Description:**
Create the settings page with tab navigation.

**Steps:**
1. Create `app/settings/page.tsx`
2. Add tab navigation component
3. Add basic styling
4. Add navigation from main menu

**TypeScript:**
```tsx
// app/settings/page.tsx
"use client";

import { useState } from "react";
import { AppNav } from "@/components/layout/nav";

type TabType = "warehouses" | "shifts" | "holidays";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("warehouses");

  return (
    <main className="page-wrap">
      <AppNav />
      
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <nav className="tabs">
        <button 
          className={activeTab === "warehouses" ? "active" : ""} 
          onClick={() => setActiveTab("warehouses")}
        >
          Warehouses
        </button>
        <button 
          className={activeTab === "shifts" ? "active" : ""} 
          onClick={() => setActiveTab("shifts")}
        >
          Shifts
        </button>
        <button 
          className={activeTab === "holidays" ? "active" : ""} 
          onClick={() => setActiveTab("holidays")}
        >
          Holidays
        </button>
      </nav>

      <section className="card">
        {activeTab === "warehouses" && <WarehousesTab />}
        {activeTab === "shifts" && <ShiftsTab />}
        {activeTab === "holidays" && <HolidaysTab />}
      </section>
    </main>
  );
}
```

**Acceptance Criteria:**
- [ ] Page renders with 3 tabs
- [ ] Tab switching works
- [ ] Navigation from AppNav works
- [ ] Responsive layout

---

### TASK-UI-2: Implement Warehouses Tab

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-UI-1, TASK-API-2

**Description:**
Create warehouse configuration UI with SLA editing.

**Steps:**
1. Fetch warehouses from API
2. Render table with SLA column
3. Add inline editing for SLA
4. Add save functionality

**TypeScript:**
```tsx
function WarehousesTab() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  async function fetchWarehouses() {
    setLoading(true);
    const res = await fetch("/api/settings");
    const data = await res.json();
    setWarehouses(data.warehouses);
    setLoading(false);
  }

  async function updateSla(warehouseId: string, slaMinutes: number) {
    setSaving(warehouseId);
    await fetch("/api/settings/sla", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warehouse_id: warehouseId, sla_minutes: slaMinutes })
    });
    setSaving(null);
  }

  if (loading) return <div>Loading...</div>;

  return (
    <table className="settings-table">
      <thead>
        <tr>
          <th>Warehouse</th>
          <th>SLA (minutes)</th>
          <th>Default Shift</th>
        </tr>
      </thead>
      <tbody>
        {warehouses.map(wh => (
          <tr key={wh.id}>
            <td>{wh.name}</td>
            <td>
              <input
                type="number"
                value={wh.sla_minutes}
                min={1}
                max={1440}
                onChange={(e) => {
                  const updated = warehouses.map(w => 
                    w.id === wh.id ? { ...w, sla_minutes: parseInt(e.target.value) } : w
                  );
                  setWarehouses(updated);
                }}
                onBlur={() => updateSla(wh.id, wh.sla_minutes)}
                disabled={saving === wh.id}
              />
            </td>
            <td>{wh.default_shift_start} - {wh.default_shift_end}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Acceptance Criteria:**
- [ ] Table displays all warehouses
- [ ] SLA can be edited inline
- [ ] Save indicator shows during update
- [ ] Changes persist after page reload

---

### TASK-UI-3: Implement Shifts Tab

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-UI-1, TASK-API-3

**Description:**
Create shift configuration UI with day-of-week editing.

**Steps:**
1. Add warehouse selector dropdown
2. Fetch shifts for selected warehouse
3. Render 7-row table (one per day)
4. Add time inputs for start/end
5. Add active checkbox
6. Add save button

**TypeScript:**
```tsx
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ShiftsTab() {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedWarehouse) fetchShifts(selectedWarehouse);
  }, [selectedWarehouse]);

  async function fetchShifts(warehouseCode: string) {
    const res = await fetch(`/api/settings/shifts/${warehouseCode}`);
    const data = await res.json();
    setShifts(data.shifts);
  }

  async function saveShifts() {
    setSaving(true);
    await fetch(`/api/settings/shifts/${selectedWarehouse}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shifts })
    });
    setSaving(false);
  }

  return (
    <>
      <label>
        Select Warehouse:
        <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
          <option value="">-- Select --</option>
          {warehouses.map(wh => (
            <option key={wh.code} value={wh.code}>{wh.name}</option>
          ))}
        </select>
      </label>

      {selectedWarehouse && shifts.length > 0 && (
        <>
          <table className="settings-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Start</th>
                <th>End</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift, idx) => (
                <tr key={shift.day_of_week}>
                  <td>{DAYS[shift.day_of_week]}</td>
                  <td>
                    <input
                      type="time"
                      value={shift.shift_start}
                      onChange={e => {
                        const updated = [...shifts];
                        updated[idx].shift_start = e.target.value;
                        setShifts(updated);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={shift.shift_end}
                      onChange={e => {
                        const updated = [...shifts];
                        updated[idx].shift_end = e.target.value;
                        setShifts(updated);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={shift.is_active}
                      onChange={e => {
                        const updated = [...shifts];
                        updated[idx].is_active = e.target.checked;
                        setShifts(updated);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <button className="btn" onClick={saveShifts} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </>
      )}
    </>
  );
}
```

**Acceptance Criteria:**
- [ ] Warehouse selector populated
- [ ] 7 days displayed in table
- [ ] Time inputs work for start/end
- [ ] Active checkbox toggles
- [ ] Save button updates all days

---

### TASK-UI-4: Implement Holidays Tab

**Priority:** MEDIUM  
**Estimate:** 2 hours  
**Dependencies:** TASK-UI-1, TASK-API-4

**Description:**
Create holiday override management UI.

**Steps:**
1. Add "Add Holiday" button
2. Add modal/form for single override
3. Add "Bulk Add (Ramadan)" button
4. Add bulk form with date range
5. Render override list with delete option

**Acceptance Criteria:**
- [ ] Add Holiday modal works
- [ ] Bulk Add creates multiple overrides
- [ ] Override list displays correctly
- [ ] Delete removes override

---

## 5. Phase 4: Dashboard Changes Tasks

### TASK-DB-7: Update DoD API for Dual Tables

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-DB-5

**Description:**
Update DoD API route to return dual table data.

**Steps:**
1. Update TypeScript types
2. Modify response structure
3. Update fallback calculation
4. Add WA count to response

**TypeScript:**
```typescript
// app/api/dod/route.ts
interface DodResponse {
  rows_inc_wa: DodRow[];
  rows_exc_wa: DodRow[];
  null_on_time_count: number;
  wa_count: number;
  chart: {
    labels: string[];
    totalOrders: number[];
    onTimePct: number[];
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  // ... validation ...

  const supabase = getSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from("v_dod_summary")
    .select("*")
    .eq("warehouse_code", warehouse)
    .gte("day", from)
    .lte("day", to)
    .order("day");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows_inc_wa = data.map(row => ({
    day: row.day,
    total_placed: row.total_placed_inc_wa,
    total_delivered: row.total_delivered_inc_wa,
    on_time: row.on_time_inc_wa,
    late: row.total_delivered_inc_wa - row.on_time_inc_wa,
    otd_pct: row.otd_pct_inc_wa
  }));

  const rows_exc_wa = data.map(row => ({
    day: row.day,
    total_placed: row.total_placed_exc_wa,
    total_delivered: row.total_delivered_exc_wa,
    on_time: row.on_time_exc_wa,
    late: row.total_delivered_exc_wa - row.on_time_exc_wa,
    otd_pct: row.otd_pct_exc_wa
  }));

  return NextResponse.json({
    rows_inc_wa,
    rows_exc_wa,
    wa_count: data.reduce((sum, row) => sum + (row.wa_count || 0), 0),
    chart: {
      labels: data.map(row => row.day),
      totalOrders: data.map(row => row.total_delivered_inc_wa),
      onTimePct: data.map(row => row.otd_pct_inc_wa || 0)
    }
  });
}
```

**Acceptance Criteria:**
- [ ] Response includes rows_inc_wa array
- [ ] Response includes rows_exc_wa array
- [ ] WA count populated
- [ ] Chart data maintained

---

### TASK-UI-5: Update Dashboard Page for Dual Tables

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-DB-7

**Description:**
Update dashboard to display two tables.

**Steps:**
1. Update data fetching for new response structure
2. Create DodSummaryTable component
3. Render two tables with headers
4. Update chart to use combined data

**TypeScript:**
```tsx
// app/dashboard/page.tsx
export default function DashboardPage() {
  const [data, setData] = useState<DodResponse | null>(null);
  // ... existing state and effects ...

  return (
    <main className="page-wrap">
      <AppNav />
      
      {/* Filters */}
      <section className="card grid three">
        {/* ... existing filters ... */}
      </section>

      {/* Table 1: Including WA */}
      <section className="card">
        <h3>On-Time Delivery - Including Waiting Address Orders</h3>
        <p className="subtitle">
          Total WA Orders: {data?.wa_count ?? 0}
        </p>
        <DodSummaryTable rows={data?.rows_inc_wa ?? []} />
      </section>

      {/* Table 2: Excluding WA */}
      <section className="card">
        <h3>On-Time Delivery - Excluding Waiting Address Orders</h3>
        <DodSummaryTable rows={data?.rows_exc_wa ?? []} />
      </section>

      {/* Chart */}
      <section className="card">
        <OnTimeComboChart data={data?.chart} />
      </section>
    </main>
  );
}

// components/tables/DodSummaryTable.tsx
function DodSummaryTable({ rows }: { rows: DodRow[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Total Placed</th>
          <th>Total Delivered</th>
          <th>On-Time</th>
          <th>Late</th>
          <th>OTD %</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.day}>
            <td>{row.day}</td>
            <td>{row.total_placed}</td>
            <td>{row.total_delivered}</td>
            <td className="on-time">{row.on_time}</td>
            <td className="late">{row.late}</td>
            <td className={row.otd_pct && row.otd_pct >= 90 ? "good" : "warning"}>
              {row.otd_pct?.toFixed(1) ?? "-"}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Acceptance Criteria:**
- [ ] Two tables display correctly
- [ ] Table headers match specification
- [ ] WA count displayed
- [ ] Color coding for OTD% thresholds

---

### TASK-TZ-1: Fix Timezone Parsing in dates.ts

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** None

**Description:**
Remove hour subtraction in date parsing.

**Steps:**
1. Modify toUtcIso function
2. Remove source parameter
3. Update all callers
4. Add documentation comment

**Code Change:**
```typescript
// lib/ingest/dates.ts

/**
 * Converts parsed date components to ISO timestamp.
 * 
 * IMPORTANT: All timestamps from GCC warehouses are already in GMT+3.
 * The database timezone is 'Etc/GMT-3' (PostgreSQL notation for GMT+3).
 * 
 * DO NOT subtract or add hours - store timestamps as-is.
 */
function toUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): string {
  // No conversion - timestamps already in GMT+3
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  return new Date(utcMillis).toISOString();
}

export function parseWarehouseDateToIso(
  value: unknown,
): string | null {
  // ... existing parsing logic ...
  
  // Remove source parameter - always treat as GMT+3
  return toUtcIso(year, month, day, hour, minute, second);
}
```

**Acceptance Criteria:**
- [ ] No hour subtraction in toUtcIso
- [ ] All callers updated
- [ ] CSV import preserves timestamps
- [ ] Documentation comment added

---

## 6. Phase 5: Testing & Deployment Tasks

### TASK-TEST-1: Create Validation SQL Queries

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** TASK-DB-4, TASK-DB-5

**Description:**
Create SQL queries for data integrity verification.

**File:** `sql/validation_queries.sql`

```sql
-- 1. Verify no NULL is_on_time for delivered parcels
SELECT COUNT(*) as null_count
FROM v_parcel_kpi
WHERE delivered_ts IS NOT NULL AND is_on_time IS NULL;
-- Expected: 0

-- 2. Verify OTD calculation matches manual
SELECT 
  day,
  on_time_inc_wa,
  total_delivered_inc_wa,
  otd_pct_inc_wa,
  ROUND((on_time_inc_wa::NUMERIC / NULLIF(total_delivered_inc_wa, 0)) * 100, 2) as manual_calc
FROM v_dod_summary
WHERE day = CURRENT_DATE - 1
LIMIT 5;

-- 3. Verify shift configs populated
SELECT w.code, COUNT(sc.day_of_week) as configured_days
FROM warehouses w
LEFT JOIN warehouse_shift_configs sc ON sc.warehouse_id = w.id
GROUP BY w.code;
-- Expected: All show 7

-- 4. Verify after-cutoff orders have deadline
SELECT COUNT(*) as missing_deadline
FROM v_parcel_kpi
WHERE cutoff_status = 'After Cutoff Time' AND deadline_local IS NULL;
-- Expected: 0

-- 5. Performance check
EXPLAIN ANALYZE
SELECT * FROM v_dod_summary
WHERE warehouse_code = 'KUWAIT'
  AND day BETWEEN CURRENT_DATE - 45 AND CURRENT_DATE;
-- Expected: < 1000ms
```

**Acceptance Criteria:**
- [ ] All queries return expected results
- [ ] Performance query shows index usage

---

### TASK-TEST-2: Create Integration Tests

**Priority:** MEDIUM  
**Estimate:** 2 hours  
**Dependencies:** TASK-API-1, TASK-API-2, TASK-API-3

**Description:**
Create automated tests for API consistency.

**File:** `tests/api/settings.test.ts`

```typescript
describe("Settings API", () => {
  it("GET /api/settings returns warehouses", async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    expect(data.warehouses).toBeDefined();
    expect(data.warehouses.length).toBeGreaterThan(0);
  });

  it("PUT /api/settings/sla updates SLA", async () => {
    const res = await fetch("/api/settings/sla", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        warehouse_id: TEST_WAREHOUSE_ID, 
        sla_minutes: 180 
      })
    });
    expect(res.status).toBe(200);
  });

  it("Validates SLA range", async () => {
    const res = await fetch("/api/settings/sla", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        warehouse_id: TEST_WAREHOUSE_ID, 
        sla_minutes: 2000 // Invalid: > 1440
      })
    });
    expect(res.status).toBe(400);
  });
});
```

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Coverage > 80% for settings routes

---

### TASK-TEST-3: API-SQL Consistency Test

**Priority:** MEDIUM  
**Estimate:** 1 hour  
**Dependencies:** TASK-DB-7

**Description:**
Test that API fallback produces same results as SQL view.

```typescript
describe("DoD API Consistency", () => {
  it("API matches SQL view results", async () => {
    // Get API result
    const apiRes = await fetch("/api/dod?warehouse=KUWAIT&from=2026-01-01&to=2026-01-31");
    const apiData = await apiRes.json();
    
    // Get SQL result (via RPC or direct query)
    const sqlData = await getDirectQuery();
    
    // Compare
    expect(apiData.rows_inc_wa.length).toBe(sqlData.length);
    apiData.rows_inc_wa.forEach((row, idx) => {
      expect(row.otd_pct).toBeCloseTo(sqlData[idx].otd_pct, 1);
    });
  });
});
```

**Acceptance Criteria:**
- [ ] API and SQL produce identical OTD%
- [ ] Test runs in CI pipeline

---

### TASK-DEPLOY-1: Deployment Checklist Execution

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** All previous tasks

**Description:**
Execute deployment steps and verify.

**Checklist:**
```
[ ] 1. Backup existing views
[ ] 2. Deploy warehouse_shift_configs table
[ ] 3. Populate default shift configs
[ ] 4. Create indexes
[ ] 5. Deploy modified v_parcel_kpi view
[ ] 6. Deploy modified v_dod_summary view
[ ] 7. Deploy API changes
[ ] 8. Deploy frontend changes
[ ] 9. Run validation queries
[ ] 10. Verify dashboard loads < 1s
[ ] 11. Test settings page functionality
[ ] 12. Clear database and reupload test data
```

**Acceptance Criteria:**
- [ ] All checklist items completed
- [ ] No errors in application logs
- [ ] Dashboard displays correctly
- [ ] Settings page functional

---

## 7. Effort Summary

| Phase | Tasks | Hours | Dependencies |
|-------|-------|-------|--------------|
| Phase 1: Database Layer | 6 | 6h | None |
| Phase 2: Settings API | 4 | 6h | Phase 1 (partial) |
| Phase 3: Settings Frontend | 4 | 8h | Phase 2 |
| Phase 4: Dashboard Changes | 3 | 5h | Phase 1 |
| Phase 5: Testing | 4 | 5h | All phases |
| **TOTAL** | **21** | **30h** | |

### Critical Path
```
TASK-DB-1 → TASK-DB-2 → TASK-DB-4 → TASK-DB-5 → TASK-DB-7 → TASK-UI-5
     ↓
TASK-API-1 → TASK-API-2 → TASK-UI-2
           → TASK-API-3 → TASK-UI-3
           → TASK-API-4 → TASK-UI-4
```

### Recommended Execution Order
1. TASK-DB-1, TASK-DB-3, TASK-API-1, TASK-UI-1 (parallel)
2. TASK-DB-2, TASK-TZ-1 (parallel)
3. TASK-DB-4, TASK-API-2 (parallel)
4. TASK-DB-5
5. TASK-DB-6, TASK-API-3 (parallel)
6. TASK-DB-7, TASK-API-4, TASK-UI-2 (parallel)
7. TASK-UI-3, TASK-UI-4 (parallel)
8. TASK-UI-5
9. TASK-TEST-1, TASK-TEST-2, TASK-TEST-3 (parallel)
10. TASK-DEPLOY-1
