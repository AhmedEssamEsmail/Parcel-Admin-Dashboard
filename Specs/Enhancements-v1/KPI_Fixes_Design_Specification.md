# Design Specification
## Technical Design for KPI Calculation Fixes - Parcel Admin Dashboard

**Project:** Parcel Admin Dashboard  
**Date:** March 2026  
**Version:** 2.0

---

## 1. Architecture Overview

The project involves modifications across four layers:

1. **Database Layer** - PostgreSQL views, new tables, indexes
2. **API Layer** - TypeScript routes, validation
3. **Frontend Layer** - Dashboard page, Settings page
4. **Performance Layer** - Caching, query optimization

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Dashboard  │  │   Upload    │  │  Settings   │             │
│  │   Page      │  │    Page     │  │    Page     │  (NEW)      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                           API Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  /api/dod   │  │ /api/ingest │  │/api/settings│             │
│  │             │  │             │  │             │  (NEW)      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Database Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │v_dod_summary│  │   delivery  │  │ warehouse   │             │
│  │  (MODIFIED) │  │  _details   │  │_shift_configs│ (NEW)      │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ v_parcel_kpi│  │   parcel    │  │ warehouse   │             │
│  │  (MODIFIED) │  │   _logs     │  │_shift_overr.│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Files Affected

| Component | File Path | Change Type |
|-----------|-----------|-------------|
| v_dod_summary | `sql/supabase_schema_v2.sql` | Modified |
| v_parcel_kpi | `sql/supabase_schema_v2.sql` | Modified |
| warehouse_shift_configs | `sql/supabase_schema_v2.sql` | New Table |
| DoD API | `app/api/dod/route.ts` | Modified |
| Settings API | `app/api/settings/` | New Directory |
| Dashboard Page | `app/dashboard/page.tsx` | Modified |
| Settings Page | `app/settings/page.tsx` | New File |
| Date Parsing | `lib/ingest/dates.ts` | Modified |

---

## 2. Database Layer Changes

### 2.1 New Table: `warehouse_shift_configs`

**Purpose:** Store per-day shift configuration for each warehouse.

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

-- Index for fast lookup
CREATE INDEX idx_warehouse_shift_configs_lookup 
  ON public.warehouse_shift_configs(warehouse_id, day_of_week);

-- Initial population from existing defaults
INSERT INTO public.warehouse_shift_configs (warehouse_id, day_of_week, shift_start, shift_end)
SELECT 
  w.id,
  gs.dow,
  w.default_shift_start,
  w.default_shift_end
FROM public.warehouses w
CROSS JOIN generate_series(0, 6) AS gs(dow)
ON CONFLICT (warehouse_id, day_of_week) DO NOTHING;

COMMENT ON TABLE public.warehouse_shift_configs IS 
  'Per-day shift configuration for each warehouse. day_of_week: 0=Sunday, 6=Saturday';
```

### 2.2 Modified View: `v_parcel_kpi`

**Purpose:** Fix is_on_time calculation for after-cutoff orders with NULL next_shift_start.

**Current Logic (Problematic):**
```sql
case
  when delivered_ts is null then null
  when shift_start is null or shift_end is null then null
  when order_local::time > shift_end and next_shift_start is null then null  -- ISSUE
  when delivered_local <= (deadline_calculation) then true else false
end as is_on_time
```

**Proposed Logic:**
```sql
case
  when delivered_ts is null then null
  when shift_start is null or shift_end is null then null
  
  -- After-cutoff orders: use fallback if next_shift_start is null
  when order_local::time > shift_end then
    case
      when next_shift_start is not null then
        delivered_local <= ((created_date_local + 1) + next_shift_start) + make_interval(mins => sla_minutes)
      else
        -- Fallback: use warehouse default_shift_start
        delivered_local <= ((created_date_local + 1) + w.default_shift_start) + make_interval(mins => sla_minutes)
    end
    
  -- Normal orders and before-shift orders
  when delivered_local <= (
    case
      when order_local::time < shift_start
        then (created_date_local + shift_start) + make_interval(mins => sla_minutes)
      else order_local + make_interval(mins => sla_minutes)
    end
  ) then true else false
end as is_on_time
```

### 2.3 Modified View: `v_dod_summary`

**Purpose:** Calculate OTD percentage correctly and add WA breakdown.

**Proposed Structure:**
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
  
  -- Table 1: Including WA
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
  
  -- Table 2: Excluding WA
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
  
  -- Data quality tracking
  COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL AND is_on_time IS NULL) AS null_on_time_count,
  COUNT(DISTINCT parcel_id) FILTER (WHERE waiting_address IS TRUE) AS wa_count

FROM base_data
GROUP BY warehouse_code, day
ORDER BY warehouse_code, day;

COMMENT ON VIEW public.v_dod_summary IS 
  'Daily OTD summary with dual metrics: including WA orders and excluding WA orders.
   otd_pct = (on_time_deliveries / total_delivered) * 100';
```

### 2.4 Indexes for Performance

```sql
-- Index for dashboard queries with date range
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_dashboard 
  ON public.v_parcel_kpi (warehouse_code, created_date_local)
  WHERE delivered_ts IS NOT NULL;

-- Index for WA filtering
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_wa 
  ON public.v_parcel_kpi (warehouse_code, created_date_local, waiting_address);

-- Index for is_on_time filtering
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_ontime 
  ON public.v_parcel_kpi (warehouse_code, created_date_local, is_on_time);
```

---

## 3. API Layer Changes

### 3.1 Modified: DoD API Route

**File:** `app/api/dod/route.ts`

**Changes:**
1. Return dual table data (inc_wa / exc_wa)
2. Align fallback calculation with SQL
3. Add null_on_time_count for data quality monitoring

**Proposed Response Structure:**
```typescript
interface DodResponse {
  // Table 1: Including WA
  rows_inc_wa: Array<{
    day: string;
    total_placed: number;
    total_delivered: number;
    on_time: number;
    late: number;
    otd_pct: number | null;
  }>;
  
  // Table 2: Excluding WA
  rows_exc_wa: Array<{
    day: string;
    total_placed: number;
    total_delivered: number;
    on_time: number;
    late: number;
    otd_pct: number | null;
  }>;
  
  // Metadata
  null_on_time_count: number;
  wa_count: number;
  
  // Chart data (backward compatible)
  series: {
    labels: string[];
    totalOrders: number[];
    onTimePct: number[];
  };
}
```

### 3.2 New: Settings API Routes

**Directory:** `app/api/settings/`

#### GET `/api/settings/warehouses`
```typescript
// Response
interface WarehousesSettingsResponse {
  warehouses: Array<{
    id: string;
    code: string;
    name: string;
    sla_minutes: number;
    default_shift_start: string;
    default_shift_end: string;
    tz: string;
  }>;
}
```

#### PUT `/api/settings/warehouses/:id/sla`
```typescript
// Request
interface UpdateSlaRequest {
  sla_minutes: number; // 1-1440 (1 min to 24 hours)
}

// Response
interface UpdateSlaResponse {
  warehouse_id: string;
  sla_minutes: number;
  updated_at: string;
}
```

#### GET `/api/settings/warehouses/:id/shifts`
```typescript
// Response
interface ShiftsConfigResponse {
  warehouse_id: string;
  shifts: Array<{
    day_of_week: number; // 0-6
    day_name: string;    // "Sunday", "Monday", etc.
    shift_start: string; // "HH:mm"
    shift_end: string;
    is_active: boolean;
  }>;
}
```

#### PUT `/api/settings/warehouses/:id/shifts`
```typescript
// Request
interface UpdateShiftsRequest {
  shifts: Array<{
    day_of_week: number;
    shift_start: string;
    shift_end: string;
    is_active: boolean;
  }>;
}

// Validation
const shiftSchema = z.object({
  day_of_week: z.number().min(0).max(6),
  shift_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  shift_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  is_active: z.boolean()
}).refine(data => data.shift_end > data.shift_start, {
  message: "shift_end must be after shift_start"
});
```

#### GET `/api/settings/overrides`
```typescript
// Query params: ?warehouse_code=KUWAIT&from=2026-03-01&to=2026-03-31
interface OverridesResponse {
  overrides: Array<{
    id: string;
    warehouse_code: string;
    override_date: string;
    shift_start: string | null;  // null = closed
    shift_end: string | null;
    reason: string;
  }>;
}
```

#### POST `/api/settings/overrides`
```typescript
// Request
interface CreateOverrideRequest {
  warehouse_code: string;    // or "ALL" for all warehouses
  override_date: string;     // "YYYY-MM-DD"
  shift_start: string | null;
  shift_end: string | null;
  reason: string;
}

// Bulk create for Ramadan
interface BulkOverrideRequest {
  warehouse_code: string;
  start_date: string;
  end_date: string;
  shift_start: string;
  shift_end: string;
  reason: string;
}
```

---

## 4. Frontend Layer Changes

### 4.1 Modified: Dashboard Page

**File:** `app/dashboard/page.tsx`

**Changes:**
1. Display two tables instead of one
2. Update column structure (Total Placed, Total Delivered, OTD%)
3. Keep existing combo chart

**Component Structure:**
```tsx
export default function DashboardPage() {
  const [warehouse, setWarehouse] = useState<string>("KUWAIT");
  const [from, setFrom] = useState<string>(dateOffset(-45));
  const [to, setTo] = useState<string>(dateOffset(0));
  const [data, setData] = useState<DodResponse | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="page-wrap">
      <AppNav />
      
      {/* Filters */}
      <section className="card grid three">
        <label>Warehouse ...</label>
        <label>From ...</label>
        <label>To ...</label>
        <button onClick={load}>Apply</button>
      </section>

      {/* Table 1: Including WA */}
      <section className="card">
        <h3>Including Waiting Address Orders</h3>
        <DodSummaryTable 
          rows={data?.rows_inc_wa ?? []}
          columns={['Day', 'Total Placed', 'Total Delivered', 'On-Time %']}
        />
      </section>

      {/* Table 2: Excluding WA */}
      <section className="card">
        <h3>Excluding Waiting Address Orders</h3>
        <DodSummaryTable 
          rows={data?.rows_exc_wa ?? []}
          columns={['Day', 'Total Placed', 'Total Delivered', 'On-Time %']}
        />
      </section>

      {/* Combo Chart */}
      <section className="card">
        <OnTimeComboChart data={chartData} />
      </section>
    </main>
  );
}
```

### 4.2 New: Settings Page

**File:** `app/settings/page.tsx`

**Component Structure:**
```tsx
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'warehouses' | 'shifts' | 'holidays'>('warehouses');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);

  return (
    <main className="page-wrap">
      <AppNav />
      
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <nav className="tabs">
        <button onClick={() => setActiveTab('warehouses')}>Warehouses</button>
        <button onClick={() => setActiveTab('shifts')}>Shifts</button>
        <button onClick={() => setActiveTab('holidays')}>Holidays</button>
      </nav>

      {activeTab === 'warehouses' && <WarehousesTab />}
      {activeTab === 'shifts' && <ShiftsTab />}
      {activeTab === 'holidays' && <HolidaysTab />}
    </main>
  );
}
```

#### WarehousesTab Component
```tsx
function WarehousesTab() {
  return (
    <section className="card">
      <table>
        <thead>
          <tr>
            <th>Warehouse</th>
            <th>SLA (minutes)</th>
            <th>Default Shift Start</th>
            <th>Default Shift End</th>
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
                  onChange={(e) => updateSla(wh.id, e.target.value)}
                />
              </td>
              <td>{wh.default_shift_start}</td>
              <td>{wh.default_shift_end}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

#### ShiftsTab Component
```tsx
function ShiftsTab() {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <section className="card">
      <label>
        Select Warehouse:
        <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
          {warehouses.map(wh => <option key={wh.id} value={wh.code}>{wh.name}</option>)}
        </select>
      </label>

      <table>
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
            <tr key={idx}>
              <td>{DAYS[shift.day_of_week]}</td>
              <td><input type="time" value={shift.shift_start} /></td>
              <td><input type="time" value={shift.shift_end} /></td>
              <td><input type="checkbox" checked={shift.is_active} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="btn" onClick={saveShifts}>Save Changes</button>
    </section>
  );
}
```

#### HolidaysTab Component
```tsx
function HolidaysTab() {
  return (
    <section className="card">
      <div className="btn-row">
        <button className="btn" onClick={openAddHoliday}>Add Holiday</button>
        <button className="btn secondary" onClick={openBulkAdd}>Bulk Add (Ramadan)</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Warehouse</th>
            <th>Start</th>
            <th>End</th>
            <th>Reason</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {overrides.map(o => (
            <tr key={o.id}>
              <td>{o.override_date}</td>
              <td>{o.warehouse_code}</td>
              <td>{o.shift_start ?? 'Closed'}</td>
              <td>{o.shift_end ?? 'Closed'}</td>
              <td>{o.reason}</td>
              <td>
                <button onClick={() => editOverride(o)}>Edit</button>
                <button onClick={() => deleteOverride(o.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

---

## 5. Timezone Handling Changes

### 5.1 Date Parsing Modification

**File:** `lib/ingest/dates.ts`

**Current Logic (Problematic):**
```typescript
function toUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  source: DateParseSource,
): string {
  const normalizedHour =
    source === "warehouse_local_gmt_plus_3" ? hour - 3 : hour;  // ❌ WRONG
  // ...
}
```

**Proposed Logic:**
```typescript
/**
 * Converts parsed date components to ISO timestamp.
 * 
 * IMPORTANT: All timestamps from GCC warehouses are already in GMT+3.
 * The database timezone is set to 'Etc/GMT-3', so timestamps are stored
 * and displayed in GMT+3 without any conversion.
 * 
 * DO NOT subtract hours - store timestamps as-is.
 */
function toUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): string {
  // No conversion needed - timestamps are already in GMT+3
  // Database stores in configured timezone (GMT-3 = GMT+3 in PostgreSQL notation)
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  return new Date(utcMillis).toISOString();
}

export function parseWarehouseDateToIso(
  value: unknown,
): string | null {
  // ... existing parsing logic ...
  
  // Remove source parameter entirely - always treat as GMT+3
  return toUtcIso(year, month, day, hour, minute, second);
}
```

### 5.2 Update All Callers

**File:** `lib/ingest/normalizers/deliveryDetails.ts`

```typescript
// Before
order_date: parseWarehouseDateToIso(
  getField(row, ["order_date", "Order Date"]),
  "utc_source",  // ❌ Remove this
),

// After
order_date: parseWarehouseDateToIso(
  getField(row, ["order_date", "Order Date"]),
  // No second parameter - always GMT+3
),
```

---

## 6. Performance Optimization

### 6.1 Query Optimization

**Target:** < 1 second for 45-day date range dashboard

**Strategies:**

1. **Materialized View for v_dod_summary**
```sql
CREATE MATERIALIZED VIEW public.mv_dod_summary AS
SELECT * FROM public.v_dod_summary;

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_dod_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_dod_summary;
END;
$$ LANGUAGE plpgsql;

-- Trigger on data changes
CREATE TRIGGER refresh_dod_summary_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.delivery_details
FOR EACH STATEMENT EXECUTE FUNCTION refresh_dod_summary();
```

2. **API Response Caching**
```typescript
// Use Redis or in-memory cache with 5-minute TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getDodData(warehouse: string, from: string, to: string) {
  const cacheKey = `dod:${warehouse}:${from}:${to}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;
  
  const data = await fetchFromDatabase(warehouse, from, to);
  await cache.set(cacheKey, data, CACHE_TTL);
  return data;
}
```

3. **Index Verification**
```sql
-- Verify index usage
EXPLAIN ANALYZE 
SELECT * FROM v_dod_summary 
WHERE warehouse_code = 'KUWAIT' 
  AND day BETWEEN '2026-01-01' AND '2026-02-15';
```

### 6.2 Frontend Optimization

1. **Debounce Filter Changes**
```typescript
const debouncedLoad = useMemo(
  () => debounce(load, 300),
  [warehouse, from, to]
);
```

2. **Skeleton Loading**
```tsx
{loading ? (
  <TableSkeleton rows={10} columns={4} />
) : (
  <DodSummaryTable rows={data?.rows_inc_wa} />
)}
```

---

## 7. Data Validation Queries

### 7.1 Post-Deployment Verification

```sql
-- 1. Verify no NULL is_on_time for delivered parcels
SELECT COUNT(*) as should_be_zero
FROM v_parcel_kpi
WHERE delivered_ts IS NOT NULL AND is_on_time IS NULL;

-- 2. Verify OTD calculation matches manual calculation
SELECT 
  day,
  total_delivered_inc_wa,
  on_time_inc_wa,
  otd_pct_inc_wa,
  ROUND((on_time_inc_wa::NUMERIC / total_delivered_inc_wa::NUMERIC) * 100, 2) as manual_calc
FROM v_dod_summary
WHERE day = CURRENT_DATE - 1
LIMIT 10;

-- 3. Verify shift configuration populated
SELECT w.code, COUNT(sc.day_of_week) as configured_days
FROM warehouses w
LEFT JOIN warehouse_shift_configs sc ON sc.warehouse_id = w.id
GROUP BY w.code;

-- 4. Verify timezone consistency
SELECT 
  parcel_id,
  order_date,
  order_local,
  order_local::time as order_time
FROM v_parcel_kpi
WHERE created_date_local = CURRENT_DATE - 1
LIMIT 10;
```

---

## 8. Migration Strategy

### 8.1 Deployment Steps

| Step | Action | Duration |
|------|--------|----------|
| 1 | Create `warehouse_shift_configs` table | 30 sec |
| 2 | Populate default shift configs | 30 sec |
| 3 | Create indexes | 1 min |
| 4 | Deploy modified views | 30 sec |
| 5 | Deploy API changes | 1 min |
| 6 | Deploy frontend changes | 1 min |
| 7 | Run verification queries | 1 min |

**Total estimated downtime:** None (rolling deployment)

### 8.2 Rollback Plan

```sql
-- Rollback views to previous version
-- Keep backup of old view definitions before deployment
CREATE OR REPLACE VIEW public.v_dod_summary AS
-- [OLD VIEW DEFINITION]

CREATE OR REPLACE VIEW public.v_parcel_kpi AS
-- [OLD VIEW DEFINITION]
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// lib/ingest/dates.test.ts
describe('parseWarehouseDateToIso', () => {
  it('should NOT subtract hours for GMT+3 timestamps', () => {
    const input = "Feb 7, 2026, 14:00:00";
    const result = parseWarehouseDateToIso(input);
    // Result should be 14:00 GMT+3, not 11:00
    expect(result).toContain("14:00");
  });
});

// app/api/dod/route.test.ts
describe('DoD API', () => {
  it('should return dual table data', async () => {
    const response = await GET(createRequest({ warehouse: 'KUWAIT', from: '2026-01-01', to: '2026-01-31' }));
    expect(response.rows_inc_wa).toBeDefined();
    expect(response.rows_exc_wa).toBeDefined();
  });
});
```

### 9.2 Integration Tests

```typescript
describe('API-SQL Consistency', () => {
  it('API fallback should match SQL view results', async () => {
    // Force API fallback (RPC returns error)
    mockRpcError();
    
    const apiResult = await fetchDodViaAPI();
    const sqlResult = await fetchDodViaSQL();
    
    expect(apiResult.otd_pct).toBeCloseTo(sqlResult.otd_pct, 2);
  });
});
```

---

## 10. Security Considerations

### 10.1 Settings API Authorization

```typescript
// Middleware for settings routes
export async function requireAuth(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.role === 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

### 10.2 Input Validation

```typescript
// Zod schema for shift updates
const shiftUpdateSchema = z.object({
  shifts: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    shift_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    shift_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    is_active: z.boolean()
  })).length(7) // Must provide all 7 days
}).refine(data => {
  return data.shifts.every(s => s.shift_end > s.shift_start);
}, { message: "shift_end must be after shift_start" });
```
