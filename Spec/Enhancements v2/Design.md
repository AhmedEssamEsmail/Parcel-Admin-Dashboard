# Design Specification - Phase 2 Enhancements
## Technical Design for Visibility & KPI Improvements

**Project:** Parcel Admin Dashboard  
**Date:** March 2026  
**Version:** 2.1

---

## 1. Architecture Overview

The Phase 2 enhancements extend the existing architecture with new database views, API endpoints, and UI components focused on visibility, additional KPIs, and data quality monitoring.

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend Layer                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │  Dashboard  │ │  Zone       │ │  Data       │ │  Mobile     │      │
│  │  (Enhanced) │ │  Perf. Page │ │  Quality    │ │  View       │ NEW  │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘      │
│         │               │               │               │              │
└─────────┼───────────────┼───────────────┼───────────────┼──────────────┘
          │               │               │               │
          ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            API Layer                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │  /api/dod   │ │ /api/zone   │ │ /api/data-  │ │ /api/export │ NEW  │
│  │  (Modified) │ │  /performance│ │  quality    │ │  /csv       │      │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │
│  │ /api/avg-   │ │ /api/wow    │ │ /api/compare│ NEW                   │
│  │  delivery   │ │  -mom       │ │  -periods   │                       │
│  └─────────────┘ └─────────────┘ └─────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Database Layer                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │v_zone_      │ │v_avg_       │ │v_wow_       │ │v_data_      │ NEW  │
│  │performance  │ │delivery_time│ │summary      │ │quality      │      │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
│                                                                         │
│  ┌─────────────┐ ┌─────────────┐                                        │
│  │data_quality │ │calculation_ │ NEW                                    │
│  │_issues      │ │audit_log    │                                        │
│  └─────────────┘ └─────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Files to Create/Modify

| Type | File Path | Change |
|------|-----------|--------|
| **NEW** | `app/zone-performance/page.tsx` | Zone performance page |
| **NEW** | `app/data-quality/page.tsx` | Data quality monitoring |
| **NEW** | `app/api/zone-performance/route.ts` | Zone KPI endpoint |
| **NEW** | `app/api/avg-delivery/route.ts` | Average delivery time endpoint |
| **NEW** | `app/api/data-quality/route.ts` | Data quality issues endpoint |
| **NEW** | `app/api/export/route.ts` | CSV export endpoint |
| **NEW** | `app/api/wow-summary/route.ts` | Week/Month over period endpoint |
| **NEW** | `app/api/compare/route.ts` | Date range comparison endpoint |
| **NEW** | `lib/data-quality/checks.ts` | Data quality check functions |
| **NEW** | `lib/utils/date-weeks.ts` | Week calculation utilities |
| **NEW** | `lib/utils/export.ts` | CSV export utilities |
| **MODIFIED** | `app/dashboard/page.tsx` | Add third table, auto-refresh |
| **MODIFIED** | `app/globals.css` | Mobile responsive styles |
| **MODIFIED** | `sql/supabase_schema_v2.sql` | New views and tables |

---

## 2. Database Layer Design

### 2.1 New View: `v_zone_performance`

**Purpose:** Calculate OTD% and average delivery time by zone.

```sql
CREATE OR REPLACE VIEW public.v_zone_performance AS
WITH zone_stats AS (
  SELECT
    k.warehouse_code,
    COALESCE(k.zone, 'UNKNOWN') as zone,
    COALESCE(k.city, 'UNKNOWN') as city,
    k.area,
    COUNT(DISTINCT k.parcel_id) as total_orders,
    COUNT(DISTINCT k.parcel_id) FILTER (WHERE k.delivered_ts IS NOT NULL) as delivered_count,
    COUNT(DISTINCT k.parcel_id) FILTER (WHERE k.is_on_time IS TRUE) as on_time_count,
    AVG(
      EXTRACT(EPOCH FROM (k.delivered_ts - k.order_ts)) / 60
    ) FILTER (WHERE k.delivered_ts IS NOT NULL) as avg_delivery_minutes
  FROM public.v_parcel_kpi k
  GROUP BY k.warehouse_code, k.zone, k.city, k.area
)
SELECT
  warehouse_code,
  zone,
  city,
  area,
  total_orders,
  delivered_count,
  on_time_count,
  CASE 
    WHEN delivered_count = 0 THEN NULL 
    ELSE ROUND((on_time_count::NUMERIC / delivered_count::NUMERIC) * 100, 2) 
  END as otd_pct,
  ROUND(avg_delivery_minutes::NUMERIC, 0) as avg_delivery_minutes,
  CASE 
    WHEN total_orders < 5 THEN 'LOW_VOLUME'
    WHEN delivered_count = 0 THEN 'NO_DELIVERIES'
    ELSE 'NORMAL'
  END as volume_status
FROM zone_stats
ORDER BY warehouse_code, otd_pct DESC NULLS LAST;

COMMENT ON VIEW public.v_zone_performance IS 
  'Zone-level performance metrics: OTD%, avg delivery time. Low volume flag for < 5 orders.';
```

### 2.2 New View: `v_avg_delivery_time`

**Purpose:** Calculate average delivery time across various dimensions.

```sql
CREATE OR REPLACE VIEW public.v_avg_delivery_time AS
WITH delivery_durations AS (
  SELECT
    k.warehouse_code,
    k.created_date_local as day,
    k.zone,
    k.city,
    k.parcel_id,
    EXTRACT(EPOCH FROM (k.delivered_ts - k.order_ts)) / 60 as delivery_minutes
  FROM public.v_parcel_kpi k
  WHERE k.delivered_ts IS NOT NULL
    AND k.delivered_ts > k.order_ts  -- Exclude impossible timestamps
)
SELECT
  warehouse_code,
  day,
  COUNT(*) as delivered_count,
  ROUND(AVG(delivery_minutes)::NUMERIC, 0) as avg_minutes,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delivery_minutes)::NUMERIC, 0) as median_minutes,
  ROUND(MIN(delivery_minutes)::NUMERIC, 0) as min_minutes,
  ROUND(MAX(delivery_minutes)::NUMERIC, 0) as max_minutes
FROM delivery_durations
GROUP BY warehouse_code, day
ORDER BY warehouse_code, day;

COMMENT ON VIEW public.v_avg_delivery_time IS 
  'Daily average delivery time in minutes. Excludes orders with delivered_ts < order_ts.';
```

### 2.3 New View: `v_wow_summary`

**Purpose:** Aggregate metrics by week (Sunday start) and month.

```sql
CREATE OR REPLACE VIEW public.v_wow_summary AS
WITH week_bounds AS (
  SELECT
    warehouse_code,
    -- Week starting Sunday: subtract dow from date to get week start
    (created_date_local - (EXTRACT(DOW FROM created_date_local)::INT))::DATE as week_start,
    created_date_local
  FROM public.v_parcel_kpi
),
weekly_metrics AS (
  SELECT
    warehouse_code,
    week_start,
    week_start + 6 as week_end,
    COUNT(DISTINCT parcel_id) as total_placed,
    COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL) as total_delivered,
    COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE) as on_time,
    COUNT(DISTINCT parcel_id) FILTER (WHERE waiting_address IS TRUE) as wa_count,
    AVG(EXTRACT(EPOCH FROM (delivered_ts - order_ts)) / 60) 
      FILTER (WHERE delivered_ts IS NOT NULL) as avg_delivery_minutes
  FROM week_bounds wb
  JOIN public.v_parcel_kpi k 
    ON k.warehouse_code = wb.warehouse_code 
    AND k.created_date_local = wb.created_date_local
  GROUP BY warehouse_code, week_start
)
SELECT
  warehouse_code,
  week_start,
  week_end,
  TO_CHAR(week_start, 'Mon DD') || ' - ' || TO_CHAR(week_end, 'Mon DD, YYYY') as week_label,
  total_placed,
  total_delivered,
  on_time,
  total_delivered - on_time as late,
  CASE 
    WHEN total_delivered = 0 THEN NULL 
    ELSE ROUND((on_time::NUMERIC / total_delivered::NUMERIC) * 100, 2) 
  END as otd_pct,
  wa_count,
  ROUND(avg_delivery_minutes::NUMERIC, 0) as avg_delivery_minutes,
  'week' as period_type
FROM weekly_metrics
ORDER BY warehouse_code, week_start DESC;

COMMENT ON VIEW public.v_wow_summary IS 
  'Weekly metrics with Sunday as week start. week_label formatted for display.';
```

### 2.4 New View: `v_mom_summary`

**Purpose:** Aggregate metrics by month.

```sql
CREATE OR REPLACE VIEW public.v_mom_summary AS
WITH monthly_metrics AS (
  SELECT
    warehouse_code,
    DATE_TRUNC('month', created_date_local)::DATE as month_start,
    (DATE_TRUNC('month', created_date_local) + INTERVAL '1 month - 1 day')::DATE as month_end,
    COUNT(DISTINCT parcel_id) as total_placed,
    COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL) as total_delivered,
    COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE) as on_time,
    COUNT(DISTINCT parcel_id) FILTER (WHERE waiting_address IS TRUE) as wa_count,
    AVG(EXTRACT(EPOCH FROM (delivered_ts - order_ts)) / 60) 
      FILTER (WHERE delivered_ts IS NOT NULL) as avg_delivery_minutes
  FROM public.v_parcel_kpi
  GROUP BY warehouse_code, DATE_TRUNC('month', created_date_local)
)
SELECT
  warehouse_code,
  month_start,
  month_end,
  TO_CHAR(month_start, 'Month YYYY') as month_label,
  total_placed,
  total_delivered,
  on_time,
  total_delivered - on_time as late,
  CASE 
    WHEN total_delivered = 0 THEN NULL 
    ELSE ROUND((on_time::NUMERIC / total_delivered::NUMERIC) * 100, 2) 
  END as otd_pct,
  wa_count,
  ROUND(avg_delivery_minutes::NUMERIC, 0) as avg_delivery_minutes,
  'month' as period_type
FROM monthly_metrics
ORDER BY warehouse_code, month_start DESC;

COMMENT ON VIEW public.v_mom_summary IS 
  'Monthly metrics for month-over-month comparison.';
```

### 2.5 New Table: `data_quality_issues`

**Purpose:** Store detected data quality issues for tracking and resolution.

```sql
CREATE TABLE IF NOT EXISTS public.data_quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id TEXT NOT NULL,              -- e.g., 'DQ-001', 'DQ-002'
  check_name TEXT NOT NULL,            -- e.g., 'Impossible Timestamps'
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  warehouse_code TEXT,
  description TEXT NOT NULL,
  affected_count INT NOT NULL DEFAULT 0,
  sample_records JSONB,                -- Array of sample parcel_ids
  recommendation TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_quality_severity 
  ON public.data_quality_issues(severity, resolved_at) 
  WHERE resolved_at IS NULL;

CREATE INDEX idx_data_quality_warehouse 
  ON public.data_quality_issues(warehouse_code) 
  WHERE resolved_at IS NULL;

COMMENT ON TABLE public.data_quality_issues IS 
  'Stores detected data quality issues. NULL resolved_at = active issue.';
```

### 2.6 New Function: `detect_data_quality_issues()`

**Purpose:** Run all data quality checks and populate the issues table.

```sql
CREATE OR REPLACE FUNCTION public.detect_data_quality_issues()
RETURNS TABLE(check_id TEXT, severity TEXT, count INT, description TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Clear previous unresolved issues (will be re-detected)
  DELETE FROM public.data_quality_issues WHERE resolved_at IS NULL;
  
  -- DQ-001: Impossible timestamps (delivered_ts < order_ts)
  INSERT INTO public.data_quality_issues (check_id, check_name, severity, description, affected_count, sample_records)
  SELECT 
    'DQ-001',
    'Impossible Timestamps',
    'critical',
    'delivered_ts is before order_ts',
    COUNT(*),
    jsonb_agg(parcel_id LIMIT 10)
  FROM public.v_parcel_kpi
  WHERE delivered_ts IS NOT NULL AND delivered_ts < order_ts
  HAVING COUNT(*) > 0;
  
  -- DQ-002: Missing zone
  INSERT INTO public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count, sample_records)
  SELECT 
    'DQ-002',
    'Missing Zone',
    'warning',
    warehouse_code,
    'No zone assigned to order',
    COUNT(*),
    jsonb_agg(parcel_id LIMIT 10)
  FROM public.v_parcel_kpi
  WHERE zone IS NULL OR zone = '' OR zone = 'UNKNOWN'
  GROUP BY warehouse_code
  HAVING COUNT(*) > 0;
  
  -- DQ-003: Missing city
  INSERT INTO public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count, sample_records)
  SELECT 
    'DQ-003',
    'Missing City',
    'warning',
    warehouse_code,
    'No city assigned to order',
    COUNT(*),
    jsonb_agg(parcel_id LIMIT 10)
  FROM public.v_parcel_kpi
  WHERE city IS NULL OR city = '' OR city = 'UNKNOWN'
  GROUP BY warehouse_code
  HAVING COUNT(*) > 0;
  
  -- DQ-004: NULL is_on_time for delivered
  INSERT INTO public.data_quality_issues (check_id, check_name, severity, description, affected_count, sample_records)
  SELECT 
    'DQ-004',
    'Missing On-Time Status',
    'critical',
    'is_on_time is NULL for delivered parcel',
    COUNT(*),
    jsonb_agg(parcel_id LIMIT 10)
  FROM public.v_parcel_kpi
  WHERE delivered_ts IS NOT NULL AND is_on_time IS NULL
  HAVING COUNT(*) > 0;
  
  -- DQ-005: Missing shift config for today
  INSERT INTO public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count)
  SELECT 
    'DQ-005',
    'Missing Shift Configuration',
    'warning',
    w.code,
    'No shift config for today (' || TO_CHAR(CURRENT_DATE, 'Day') || ')',
    1
  FROM public.warehouses w
  WHERE NOT EXISTS (
    SELECT 1 FROM public.warehouse_shift_configs sc 
    WHERE sc.warehouse_id = w.id 
    AND sc.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)
    AND sc.is_active = TRUE
  );
  
  -- DQ-006: Low volume zones
  INSERT INTO public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count, sample_records)
  SELECT 
    'DQ-006',
    'Low Volume Zones',
    'info',
    warehouse_code,
    zone || ' zone has fewer than 5 orders',
    total_orders,
    '[]'::jsonb
  FROM public.v_zone_performance
  WHERE volume_status = 'LOW_VOLUME'
  AND day = CURRENT_DATE;
  
  -- Return summary
  RETURN QUERY
  SELECT check_id, severity, affected_count::INT, description
  FROM public.data_quality_issues
  WHERE resolved_at IS NULL
  ORDER BY 
    CASE severity 
      WHEN 'critical' THEN 1 
      WHEN 'warning' THEN 2 
      ELSE 3 
    END,
    affected_count DESC;
END;
$$;

COMMENT ON FUNCTION public.detect_data_quality_issues() IS 
  'Runs all data quality checks and populates data_quality_issues table.';
```

---

## 3. API Layer Design

### 3.1 Zone Performance Endpoint

**Endpoint:** `GET /api/zone-performance`

```typescript
// app/api/zone-performance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface ZonePerformanceRow {
  warehouse_code: string;
  zone: string;
  city: string;
  area: string | null;
  total_orders: number;
  delivered_count: number;
  on_time_count: number;
  otd_pct: number | null;
  avg_delivery_minutes: number | null;
  volume_status: string;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const view = params.get("view")?.trim() || "summary"; // summary, top, bottom, all

  if (!warehouse) {
    return NextResponse.json(
      { error: "warehouse query param is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("v_zone_performance")
    .select("*")
    .eq("warehouse_code", warehouse);

  if (from) query = query.gte("day", from);
  if (to) query = query.lte("day", to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by zone (collapse date dimension)
  const aggregated = aggregateByZone(data as ZonePerformanceRow[]);

  // Sort by OTD%
  const sorted = aggregated.sort((a, b) => (b.otd_pct || 0) - (a.otd_pct || 0));

  // Prepare response based on view
  let result;
  switch (view) {
    case "top":
      result = { zones: sorted.slice(0, 5) };
      break;
    case "bottom":
      result = { zones: sorted.slice(-5).reverse() };
      break;
    case "all":
      result = { zones: sorted };
      break;
    default:
      result = {
        top: sorted.slice(0, 5),
        bottom: sorted.slice(-5).reverse().filter(z => z.otd_pct !== null),
        all: sorted
      };
  }

  return NextResponse.json(result);
}

function aggregateByZone(rows: ZonePerformanceRow[]) {
  const zoneMap = new Map<string, {
    zone: string;
    total_orders: number;
    delivered_count: number;
    on_time_count: number;
    total_delivery_minutes: number;
    delivery_count: number;
  }>();

  for (const row of rows) {
    const key = row.zone;
    const existing = zoneMap.get(key) || {
      zone: row.zone,
      total_orders: 0,
      delivered_count: 0,
      on_time_count: 0,
      total_delivery_minutes: 0,
      delivery_count: 0
    };

    existing.total_orders += row.total_orders;
    existing.delivered_count += row.delivered_count;
    existing.on_time_count += row.on_time_count;
    if (row.avg_delivery_minutes) {
      existing.total_delivery_minutes += row.avg_delivery_minutes * row.delivered_count;
      existing.delivery_count += row.delivered_count;
    }

    zoneMap.set(key, existing);
  }

  return Array.from(zoneMap.values()).map(z => ({
    zone: z.zone,
    total_orders: z.total_orders,
    delivered_count: z.delivered_count,
    on_time_count: z.on_time_count,
    late_count: z.delivered_count - z.on_time_count,
    otd_pct: z.delivered_count > 0 
      ? Math.round((z.on_time_count / z.delivered_count) * 10000) / 100 
      : null,
    avg_delivery_minutes: z.delivery_count > 0 
      ? Math.round(z.total_delivery_minutes / z.delivery_count) 
      : null,
    volume_status: z.total_orders < 5 ? 'LOW_VOLUME' : 'NORMAL'
  }));
}
```

### 3.2 Average Delivery Time Endpoint

**Endpoint:** `GET /api/avg-delivery`

```typescript
// app/api/avg-delivery/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const groupBy = params.get("groupBy")?.trim() || "day"; // day, warehouse, zone

  if (!warehouse) {
    return NextResponse.json(
      { error: "warehouse query param is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("v_avg_delivery_time")
    .select("*")
    .eq("warehouse_code", warehouse)
    .gte("day", from || "1900-01-01")
    .lte("day", to || "2100-01-01")
    .order("day", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate overall average and trend
  const overall = calculateOverallStats(data);
  const trend = calculateTrend(data);

  return NextResponse.json({
    overall,
    trend,
    daily: data
  });
}

function calculateOverallStats(data: any[]) {
  if (!data || data.length === 0) {
    return { avg_minutes: null, median_minutes: null, total_delivered: 0 };
  }

  const totalDelivered = data.reduce((sum, row) => sum + row.delivered_count, 0);
  const weightedSum = data.reduce((sum, row) => 
    sum + (row.avg_minutes * row.delivered_count), 0);

  return {
    avg_minutes: totalDelivered > 0 ? Math.round(weightedSum / totalDelivered) : null,
    median_minutes: data[Math.floor(data.length / 2)]?.median_minutes || null,
    total_delivered: totalDelivered
  };
}

function calculateTrend(data: any[]) {
  if (data.length < 2) return { direction: 'stable', change_minutes: 0 };

  const current = data[0]?.avg_minutes || 0;
  const previous = data[1]?.avg_minutes || 0;
  const change = current - previous;

  return {
    direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
    change_minutes: Math.round(change)
  };
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}
```

### 3.3 Week-over-Week / Month-over-Month Endpoint

**Endpoint:** `GET /api/wow-summary`

```typescript
// app/api/wow-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const periodType = params.get("periodType")?.trim() || "week"; // week, month
  const limit = parseInt(params.get("limit") || "4");

  if (!warehouse) {
    return NextResponse.json(
      { error: "warehouse query param is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();

  const viewName = periodType === "month" ? "v_mom_summary" : "v_wow_summary";

  const { data, error } = await supabase
    .from(viewName)
    .select("*")
    .eq("warehouse_code", warehouse)
    .order(periodType === "month" ? "month_start" : "week_start", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate period-over-period changes
  const withChanges = addPeriodChanges(data, periodType);

  return NextResponse.json({
    period_type: periodType,
    periods: withChanges
  });
}

function addPeriodChanges(data: any[], periodType: string) {
  return data.map((row, idx) => {
    if (idx === data.length - 1) {
      return { ...row, changes: null };
    }

    const prev = data[idx + 1];
    return {
      ...row,
      changes: {
        total_placed: {
          value: row.total_placed - prev.total_placed,
          pct: prev.total_placed > 0 
            ? Math.round(((row.total_placed - prev.total_placed) / prev.total_placed) * 100) 
            : 0
        },
        otd_pct: {
          value: (row.otd_pct || 0) - (prev.otd_pct || 0),
          direction: (row.otd_pct || 0) >= (prev.otd_pct || 0) ? 'up' : 'down'
        },
        avg_delivery_minutes: {
          value: (row.avg_delivery_minutes || 0) - (prev.avg_delivery_minutes || 0),
          direction: (row.avg_delivery_minutes || 0) <= (prev.avg_delivery_minutes || 0) ? 'improved' : 'worse'
        }
      }
    };
  });
}
```

### 3.4 Date Range Comparison Endpoint

**Endpoint:** `POST /api/compare-periods`

```typescript
// app/api/compare-periods/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface CompareRequest {
  warehouse: string;
  period_a_start: string;
  period_a_end: string;
  period_b_start: string;
  period_b_end: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json() as CompareRequest;
  const { warehouse, period_a_start, period_a_end, period_b_start, period_b_end } = body;

  if (!warehouse || !period_a_start || !period_a_end || !period_b_start || !period_b_end) {
    return NextResponse.json(
      { error: "All fields required: warehouse, period_a_start, period_a_end, period_b_start, period_b_end" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient();

  // Fetch data for both periods
  const [periodA, periodB] = await Promise.all([
    fetchPeriodData(supabase, warehouse, period_a_start, period_a_end),
    fetchPeriodData(supabase, warehouse, period_b_start, period_b_end)
  ]);

  // Calculate comparison
  const comparison = calculateComparison(periodA, periodB);

  return NextResponse.json({
    period_a: {
      start: period_a_start,
      end: period_a_end,
      ...periodA
    },
    period_b: {
      start: period_b_start,
      end: period_b_end,
      ...periodB
    },
    comparison
  });
}

async function fetchPeriodData(supabase: any, warehouse: string, from: string, to: string) {
  const { data, error } = await supabase
    .from("v_parcel_kpi")
    .select("parcel_id, is_on_time, delivered_ts, order_ts, waiting_address")
    .eq("warehouse_code", warehouse)
    .gte("created_date_local", from)
    .lte("created_date_local", to);

  if (error) throw error;

  const totalPlaced = data.length;
  const delivered = data.filter((r: any) => r.delivered_ts !== null);
  const onTime = delivered.filter((r: any) => r.is_on_time === true);
  const waOrders = data.filter((r: any) => r.waiting_address === true);

  const deliveryTimes = delivered
    .filter((r: any) => r.delivered_ts > r.order_ts)
    .map((r: any) => {
      const ms = new Date(r.delivered_ts).getTime() - new Date(r.order_ts).getTime();
      return ms / 60000; // minutes
    });

  const avgDeliveryTime = deliveryTimes.length > 0
    ? deliveryTimes.reduce((a: number, b: number) => a + b, 0) / deliveryTimes.length
    : null;

  return {
    total_placed: totalPlaced,
    total_delivered: delivered.length,
    on_time: onTime.length,
    late: delivered.length - onTime.length,
    otd_pct: delivered.length > 0 ? Math.round((onTime.length / delivered.length) * 10000) / 100 : null,
    avg_delivery_minutes: avgDeliveryTime ? Math.round(avgDeliveryTime) : null,
    wa_count: waOrders.length
  };
}

function calculateComparison(periodA: any, periodB: any) {
  return {
    total_placed: {
      absolute: periodB.total_placed - periodA.total_placed,
      pct: periodA.total_placed > 0 
        ? Math.round(((periodB.total_placed - periodA.total_placed) / periodA.total_placed) * 100) 
        : 0
    },
    total_delivered: {
      absolute: periodB.total_delivered - periodA.total_delivered,
      pct: periodA.total_delivered > 0 
        ? Math.round(((periodB.total_delivered - periodA.total_delivered) / periodA.total_delivered) * 100) 
        : 0
    },
    otd_pct: {
      absolute: (periodB.otd_pct || 0) - (periodA.otd_pct || 0),
      improved: (periodB.otd_pct || 0) >= (periodA.otd_pct || 0)
    },
    avg_delivery_minutes: {
      absolute: (periodB.avg_delivery_minutes || 0) - (periodA.avg_delivery_minutes || 0),
      improved: (periodB.avg_delivery_minutes || 0) <= (periodA.avg_delivery_minutes || 0)
    }
  };
}
```

### 3.5 Data Quality Endpoint

**Endpoint:** `GET /api/data-quality`

```typescript
// app/api/data-quality/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const severity = params.get("severity")?.trim(); // critical, warning, info, or null for all
  const warehouse = params.get("warehouse")?.trim();

  const supabase = getSupabaseAdminClient();

  // Run detection function
  await supabase.rpc("detect_data_quality_issues");

  // Fetch issues
  let query = supabase
    .from("data_quality_issues")
    .select("*")
    .is("resolved_at", null)
    .order("detected_at", { ascending: false });

  if (severity) {
    query = query.eq("severity", severity);
  }
  if (warehouse) {
    query = query.eq("warehouse_code", warehouse);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by severity
  const grouped = {
    critical: data.filter((i: any) => i.severity === "critical"),
    warning: data.filter((i: any) => i.severity === "warning"),
    info: data.filter((i: any) => i.severity === "info")
  };

  return NextResponse.json({
    summary: {
      critical_count: grouped.critical.length,
      warning_count: grouped.warning.length,
      info_count: grouped.info.length
    },
    issues: grouped,
    all: data
  });
}

// Resolve an issue
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { issue_id, resolved_by } = body;

  const supabase = getSupabaseAdminClient();

  const { error } = await supabase
    .from("data_quality_issues")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: resolved_by || "system"
    })
    .eq("id", issue_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

### 3.6 CSV Export Endpoint

**Endpoint:** `GET /api/export/csv`

```typescript
// app/api/export/csv/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type")?.trim() || "dashboard"; // dashboard, zone, wow
  const warehouse = params.get("warehouse")?.trim().toUpperCase();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();

  if (!warehouse) {
    return NextResponse.json({ error: "warehouse is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  let data: any[];
  let filename: string;

  switch (type) {
    case "zone":
      data = await fetchZoneData(supabase, warehouse, from, to);
      filename = `zone_performance_${warehouse}_${from}_${to}.csv`;
      break;
    case "wow":
      data = await fetchWowData(supabase, warehouse);
      filename = `weekly_summary_${warehouse}.csv`;
      break;
    default:
      data = await fetchDashboardData(supabase, warehouse, from, to);
      filename = `dashboard_${warehouse}_${from}_${to}.csv`;
  }

  const csv = generateCsv(data, type);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

function generateCsv(data: any[], type: string): string {
  if (data.length === 0) return "";

  const header = `# Parcel Admin Dashboard Export
# Type: ${type}
# Exported: ${new Date().toISOString()}
#
# OTD Calculation: (on_time_count / delivered_count) * 100
# Avg Time Calculation: AVG(delivered_ts - order_ts) in minutes
#
`;

  const keys = Object.keys(data[0]);
  const csvRows = [keys.join(",")];

  for (const row of data) {
    const values = keys.map(k => {
      const val = row[k];
      if (val === null || val === undefined) return "";
      if (typeof val === "string" && val.includes(",")) return `"${val}"`;
      return String(val);
    });
    csvRows.push(values.join(","));
  }

  return header + csvRows.join("\n");
}
```

---

## 4. Frontend Layer Design

### 4.1 Enhanced Dashboard Page

**File:** `app/dashboard/page.tsx`

```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AppNav } from "@/components/layout/nav";
import { DodSummaryTable } from "@/components/tables/dod-summary-table";
import { WowMomTable } from "@/components/tables/wow-mom-table";
import { OnTimeComboChart } from "@/components/charts/on-time-combo";
import { ComparisonWidget } from "@/components/widgets/comparison-widget";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

export default function DashboardPage() {
  const [warehouse, setWarehouse] = useState<string>("KUWAIT");
  const [from, setFrom] = useState<string>(dateOffset(-45));
  const [to, setTo] = useState<string>(dateOffset(0));
  const [data, setData] = useState<DashboardData | null>(null);
  const [wowData, setWowData] = useState<WowMomData | null>(null);
  const [avgDelivery, setAvgDelivery] = useState<AvgDeliveryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auto-refresh state
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isPaused, setIsPaused] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ warehouse, from, to });
      
      // Parallel fetch all data
      const [dodRes, wowRes, avgRes] = await Promise.all([
        fetch(`/api/dod?${params}`),
        fetch(`/api/wow-summary?warehouse=${warehouse}&periodType=week&limit=4`),
        fetch(`/api/avg-delivery?${params}`)
      ]);

      const dodData = await dodRes.json();
      const wowData = await wowRes.json();
      const avgData = await avgRes.json();

      if (!dodRes.ok) {
        setError(dodData.error || "Failed to load dashboard data.");
        return;
      }

      setData(dodData);
      setWowData(wowData);
      setAvgDelivery(avgData);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch {
      setError("Network error while loading dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [warehouse, from, to]);

  // Initial load
  useEffect(() => {
    load();
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Update "seconds ago" every second
    const secondsInterval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      if (!loading) load();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      clearInterval(secondsInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, lastUpdated, loading, load]);

  return (
    <main className="page-wrap">
      <AppNav />

      {/* Auto-refresh indicator */}
      <div className="refresh-bar">
        <span>Last updated: {secondsAgo} seconds ago</span>
        <button onClick={() => setIsPaused(!isPaused)}>
          {isPaused ? "▶️ Resume" : "⏸️ Pause"}
        </button>
        <button onClick={load} disabled={loading}>
          🔄 Refresh Now
        </button>
      </div>

      {/* Filters */}
      <section className="card grid three">
        <label>
          Warehouse
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            {WAREHOUSE_CODES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="btn-row">
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
          <button className="btn secondary" onClick={() => exportCsv()}>
            📥 Export CSV
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {/* Average Delivery Time Widget */}
      {avgDelivery && (
        <section className="card avg-delivery-widget">
          <h3>Average Delivery Time</h3>
          <div className="avg-stat">
            <span className="big-number">{formatTime(avgDelivery.overall.avg_minutes)}</span>
            <span className={`trend ${avgDelivery.trend.direction}`}>
              {avgDelivery.trend.direction === 'increasing' ? '↑' : 
               avgDelivery.trend.direction === 'decreasing' ? '↓' : '→'} 
              {Math.abs(avgDelivery.trend.change_minutes)}m vs last week
            </span>
          </div>
        </section>
      )}

      {/* Table 1: Including WA */}
      <section className="card">
        <h3>On-Time Delivery - Including Waiting Address Orders</h3>
        <p className="subtitle">WA Orders: {data?.wa_count ?? 0}</p>
        <DodSummaryTable 
          rows={data?.rows_inc_wa ?? []}
          onExport={() => exportTable('inc_wa')}
        />
      </section>

      {/* Table 2: Excluding WA */}
      <section className="card">
        <h3>On-Time Delivery - Excluding Waiting Address Orders</h3>
        <DodSummaryTable 
          rows={data?.rows_exc_wa ?? []}
          onExport={() => exportTable('exc_wa')}
        />
      </section>

      {/* Table 3: Week-over-Week / Month-over-Month */}
      <section className="card">
        <WowMomTable 
          data={wowData}
          warehouse={warehouse}
        />
      </section>

      {/* Comparison Widget */}
      <section className="card">
        <ComparisonWidget 
          warehouse={warehouse}
          onCompare={handleCompare}
        />
      </section>

      {/* Chart */}
      <section className="card">
        <OnTimeComboChart data={data?.chart} />
      </section>
    </main>
  );
}

function formatTime(minutes: number | null): string {
  if (!minutes) return "-:--";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
```

### 4.2 Zone Performance Page

**File:** `app/zone-performance/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/layout/nav";
import { WAREHOUSE_CODES } from "@/lib/csv/mappings";

export default function ZonePerformancePage() {
  const [warehouse, setWarehouse] = useState<string>("KUWAIT");
  const [from, setFrom] = useState<string>(dateOffset(-30));
  const [to, setTo] = useState<string>(dateOffset(0));
  const [data, setData] = useState<ZoneData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [warehouse, from, to]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ warehouse, from, to });
    const res = await fetch(`/api/zone-performance?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  return (
    <main className="page-wrap">
      <AppNav />

      <header className="page-header">
        <h1>Zone Performance</h1>
        <p>Analyze delivery performance by geographic zone</p>
      </header>

      {/* Filters */}
      <section className="card grid three">
        <label>Warehouse
          <select value={warehouse} onChange={e => setWarehouse(e.target.value)}>
            {WAREHOUSE_CODES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>From
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>To
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
      </section>

      {loading ? <div className="loading">Loading...</div> : (
        <>
          {/* Top Performing Zones */}
          <section className="card">
            <h3>🏆 Top Performing Zones</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Orders</th>
                  <th>Delivered</th>
                  <th>On-Time %</th>
                  <th>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.top?.map((zone, i) => (
                  <tr key={zone.zone} className="good">
                    <td>
                      {i === 0 && "🥇 "}
                      {i === 1 && "🥈 "}
                      {i === 2 && "🥉 "}
                      {zone.zone}
                    </td>
                    <td>{zone.total_orders}</td>
                    <td>{zone.delivered_count}</td>
                    <td>{zone.otd_pct?.toFixed(1) ?? "-"}%</td>
                    <td>{formatTime(zone.avg_delivery_minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Needs Attention */}
          <section className="card">
            <h3>⚠️ Needs Attention</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Orders</th>
                  <th>Delivered</th>
                  <th>On-Time %</th>
                  <th>Avg Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.bottom?.map((zone) => (
                  <tr key={zone.zone} className="warning">
                    <td>{zone.zone}</td>
                    <td>{zone.total_orders}</td>
                    <td>{zone.delivered_count}</td>
                    <td className="low">{zone.otd_pct?.toFixed(1) ?? "-"}%</td>
                    <td>{formatTime(zone.avg_delivery_minutes)}</td>
                    <td>
                      {zone.volume_status === 'LOW_VOLUME' && 
                        <span className="badge info">Low Volume</span>}
                      {(zone.otd_pct ?? 0) < 80 && 
                        <span className="badge warning">Below Target</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Export */}
          <section className="card">
            <button className="btn" onClick={() => exportCsv()}>
              📥 Export Zone Data (CSV)
            </button>
          </section>
        </>
      )}
    </main>
  );
}
```

### 4.3 Data Quality Page

**File:** `app/data-quality/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { AppNav } from "@/components/layout/nav";

export default function DataQualityPage() {
  const [data, setData] = useState<DataQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  useEffect(() => {
    load();
    // Auto-refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/data-quality");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function resolveIssue(issueId: string) {
    await fetch("/api/data-quality", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue_id: issueId, resolved_by: "admin" })
    });
    load();
  }

  return (
    <main className="page-wrap">
      <AppNav />

      <header className="page-header">
        <h1>Data Quality Monitor</h1>
        <p>Last updated: {new Date().toLocaleString()}</p>
      </header>

      {/* Summary Cards */}
      <section className="grid three">
        <div className="card summary-card critical">
          <h2>{data?.summary.critical_count ?? 0}</h2>
          <p>Critical Issues</p>
        </div>
        <div className="card summary-card warning">
          <h2>{data?.summary.warning_count ?? 0}</h2>
          <p>Warnings</p>
        </div>
        <div className="card summary-card info">
          <h2>{data?.summary.info_count ?? 0}</h2>
          <p>Info</p>
        </div>
      </section>

      {/* Critical Issues */}
      {data?.issues.critical.length > 0 && (
        <section className="card">
          <h3>🔴 Critical Issues</h3>
          {data.issues.critical.map((issue) => (
            <div key={issue.id} className="issue-card critical">
              <div className="issue-header">
                <strong>{issue.check_name}</strong>
                <span className="count">{issue.affected_count} records</span>
              </div>
              <p>{issue.description}</p>
              {issue.recommendation && (
                <p className="recommendation">💡 {issue.recommendation}</p>
              )}
              <div className="issue-actions">
                <button onClick={() => setExpandedIssue(
                  expandedIssue === issue.id ? null : issue.id
                )}>
                  {expandedIssue === issue.id ? "Hide Records" : "View Records"}
                </button>
                <button className="secondary" onClick={() => exportIssue(issue.id)}>
                  Export List
                </button>
                <button className="resolve" onClick={() => resolveIssue(issue.id)}>
                  Mark Resolved
                </button>
              </div>
              {expandedIssue === issue.id && (
                <div className="sample-records">
                  <h4>Sample Parcel IDs:</h4>
                  <code>{issue.sample_records?.slice(0, 10).join(", ")}</code>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Warnings */}
      {data?.issues.warning.length > 0 && (
        <section className="card">
          <h3>⚠️ Warnings</h3>
          {data.issues.warning.map((issue) => (
            <div key={issue.id} className="issue-card warning">
              <div className="issue-header">
                <strong>{issue.check_name}</strong>
                <span className="warehouse">{issue.warehouse_code}</span>
                <span className="count">{issue.affected_count} records</span>
              </div>
              <p>{issue.description}</p>
              {issue.recommendation && (
                <p className="recommendation">💡 {issue.recommendation}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Info */}
      {data?.issues.info.length > 0 && (
        <section className="card">
          <h3>ℹ️ Information</h3>
          {data.issues.info.map((issue) => (
            <div key={issue.id} className="issue-card info">
              <div className="issue-header">
                <strong>{issue.check_name}</strong>
                <span className="count">{issue.affected_count}</span>
              </div>
              <p>{issue.description}</p>
            </div>
          ))}
        </section>
      )}

      {loading && <div className="loading-overlay">Refreshing...</div>}
    </main>
  );
}
```

### 4.4 Week-over-Week / Month-over-Month Table Component

**File:** `components/tables/wow-mom-table.tsx`

```tsx
"use client";

import { useState } from "react";

interface WowMomTableProps {
  data: any;
  warehouse: string;
}

export function WowMomTable({ data, warehouse }: WowMomTableProps) {
  const [viewType, setViewType] = useState<"week" | "month">("week");

  if (!data?.periods) return null;

  const periods = data.periods;

  return (
    <div className="wow-mom-table">
      <div className="table-header">
        <h3>
          {viewType === "week" ? "Week-over-Week" : "Month-over-Month"} Performance
          <span className="including-wa">(Including WA Orders)</span>
        </h3>
        
        {/* Toggle Switch */}
        <div className="toggle-switch">
          <button 
            className={viewType === "week" ? "active" : ""}
            onClick={() => setViewType("week")}
          >
            Weekly View
          </button>
          <button 
            className={viewType === "month" ? "active" : ""}
            onClick={() => setViewType("month")}
          >
            Monthly View
          </button>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>{viewType === "week" ? "Week" : "Month"}</th>
            <th>Total Placed</th>
            <th>Delivered</th>
            <th>On-Time</th>
            <th>Late</th>
            <th>OTD %</th>
            <th>Avg Time</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((period: any, idx: number) => (
            <tr key={idx}>
              <td className="period-label">
                {viewType === "week" 
                  ? period.week_label 
                  : period.month_label}
              </td>
              <td>{period.total_placed}</td>
              <td>{period.total_delivered}</td>
              <td className="on-time">{period.on_time}</td>
              <td className="late">{period.late}</td>
              <td className={getOtdClass(period.otd_pct)}>
                {period.otd_pct?.toFixed(1) ?? "-"}%
              </td>
              <td>{formatTime(period.avg_delivery_minutes)}</td>
              <td className={getChangeClass(period.changes)}>
                {period.changes ? (
                  <>
                    <span className="otd-change">
                      {period.changes.otd_pct.direction === 'up' ? '↑' : '↓'}
                      {Math.abs(period.changes.otd_pct.value).toFixed(1)}%
                    </span>
                  </>
                ) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getOtdClass(otd: number | null): string {
  if (!otd) return "";
  if (otd >= 90) return "excellent";
  if (otd >= 80) return "good";
  return "needs-attention";
}

function getChangeClass(changes: any): string {
  if (!changes) return "";
  return changes.otd_pct.direction === "up" ? "improved" : "declined";
}

function formatTime(minutes: number | null): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}
```

---

## 5. Mobile Responsive Design

### 5.1 Responsive CSS

**File:** `app/globals.css` (additions)

```css
/* ===========================================
   MOBILE RESPONSIVE STYLES
   =========================================== */

/* Tablet Breakpoint (768px - 1024px) */
@media screen and (max-width: 1024px) {
  .grid.three {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .grid.three > *:last-child {
    grid-column: span 2;
  }
  
  .data-table {
    font-size: 14px;
  }
  
  .card {
    padding: 16px;
  }
}

/* Mobile Breakpoint (< 768px) */
@media screen and (max-width: 768px) {
  /* Navigation */
  .nav-links {
    display: none;
  }
  
  .mobile-menu-btn {
    display: block;
  }
  
  .nav-links.open {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 60px;
    left: 0;
    right: 0;
    background: white;
    padding: 16px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  /* Filters */
  .grid.three {
    grid-template-columns: 1fr;
  }
  
  .grid.three > *:last-child {
    grid-column: span 1;
  }
  
  /* Tables become cards */
  .data-table thead {
    display: none;
  }
  
  .data-table tbody tr {
    display: block;
    margin-bottom: 16px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
  }
  
  .data-table tbody td {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .data-table tbody td:last-child {
    border-bottom: none;
  }
  
  .data-table tbody td::before {
    content: attr(data-label);
    font-weight: 600;
    color: #374151;
  }
  
  /* Cards */
  .card {
    padding: 12px;
    margin-bottom: 16px;
  }
  
  .card h3 {
    font-size: 16px;
  }
  
  /* Summary cards */
  .summary-card h2 {
    font-size: 24px;
  }
  
  /* Toggle switches */
  .toggle-switch {
    flex-direction: column;
    width: 100%;
  }
  
  .toggle-switch button {
    width: 100%;
    margin-bottom: 8px;
  }
  
  /* Charts */
  .chart-container {
    height: 250px;
  }
  
  /* Touch-friendly controls */
  button, input, select {
    min-height: 44px;
    font-size: 16px;
  }
  
  /* Refresh bar */
  .refresh-bar {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
}

/* Small Mobile (< 480px) */
@media screen and (max-width: 480px) {
  .page-header h1 {
    font-size: 20px;
  }
  
  .big-number {
    font-size: 32px;
  }
  
  .btn {
    width: 100%;
  }
  
  .btn-row {
    flex-direction: column;
  }
}
```

### 5.2 Mobile Navigation Component

**File:** `components/layout/mobile-nav.tsx`

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger button */}
      <button 
        className="mobile-menu-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? "✕" : "☰"}
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsOpen(false)}>
          <nav className="mobile-menu" onClick={e => e.stopPropagation()}>
            <Link href="/dashboard" onClick={() => setIsOpen(false)}>
              📊 Dashboard
            </Link>
            <Link href="/zone-performance" onClick={() => setIsOpen(false)}>
              🗺️ Zone Performance
            </Link>
            <Link href="/data-quality" onClick={() => setIsOpen(false)}>
              🔍 Data Quality
            </Link>
            <Link href="/settings" onClick={() => setIsOpen(false)}>
              ⚙️ Settings
            </Link>
            <Link href="/upload" onClick={() => setIsOpen(false)}>
              📤 Upload
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
```

---

## 6. CSV Import Validation

### 6.1 Validation Preview Component

**File:** `components/upload/csv-preview.tsx`

```tsx
"use client";

import { useState, useMemo } from "react";

interface CsvPreviewProps {
  data: any[];
  filename: string;
  onConfirm: (validRows: any[]) => void;
  onCancel: () => void;
}

interface ValidationResult {
  valid: any[];
  warnings: { row: number; field: string; message: string; row_data: any }[];
  errors: { row: number; field: string; message: string; row_data: any }[];
}

export function CsvPreview({ data, filename, onConfirm, onCancel }: CsvPreviewProps) {
  const [showWarnings, setShowWarnings] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const validation = useMemo(() => validateCsvData(data), [data]);

  const validCount = validation.valid.length;
  const warningCount = validation.warnings.length;
  const errorCount = validation.errors.length;
  const canImport = validCount > 0;

  return (
    <div className="csv-preview">
      <h3>CSV Preview - {filename} ({data.length} rows)</h3>

      {/* Summary */}
      <div className="preview-summary">
        <div className="summary-item valid">
          ✅ Valid: {validCount} rows ready to import
        </div>
        <div className="summary-item warning">
          ⚠️ Warnings: {warningCount} rows (can import with defaults)
        </div>
        <div className="summary-item error">
          ❌ Errors: {errorCount} rows (will be skipped)
        </div>
      </div>

      {/* Warnings */}
      {warningCount > 0 && (
        <div className="preview-section">
          <button 
            className="expand-btn"
            onClick={() => setShowWarnings(!showWarnings)}
          >
            {showWarnings ? "▼" : "▶"} Warnings ({warningCount})
          </button>
          {showWarnings && (
            <div className="preview-list warnings">
              {validation.warnings.slice(0, 20).map((w, i) => (
                <div key={i} className="preview-row">
                  <span className="row-num">Row {w.row}:</span>
                  <span className="message">{w.message}</span>
                </div>
              ))}
              {warningCount > 20 && (
                <p className="more">... and {warningCount - 20} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {errorCount > 0 && (
        <div className="preview-section">
          <button 
            className="expand-btn"
            onClick={() => setShowErrors(!showErrors)}
          >
            {showErrors ? "▼" : "▶"} Errors ({errorCount})
          </button>
          {showErrors && (
            <div className="preview-list errors">
              {validation.errors.slice(0, 20).map((e, i) => (
                <div key={i} className="preview-row">
                  <span className="row-num">Row {e.row}:</span>
                  <span className="message">{e.message} - SKIPPED</span>
                </div>
              ))}
              {errorCount > 20 && (
                <p className="more">... and {errorCount - 20} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="preview-actions">
        <button className="btn secondary" onClick={() => exportErrorLog(validation)}>
          📥 Export Error Log
        </button>
        <button 
          className="btn" 
          disabled={!canImport}
          onClick={() => onConfirm(validation.valid)}
        >
          Proceed with {validCount + warningCount} rows
        </button>
        <button className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function validateCsvData(data: any[]): ValidationResult {
  const valid: any[] = [];
  const warnings: any[] = [];
  const errors: any[] = [];

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 for 1-based and header row
    const rowWarnings: any[] = [];
    let hasError = false;

    // Required fields
    if (!row.parcel_id) {
      errors.push({
        row: rowNum,
        field: "parcel_id",
        message: "Missing parcel_id (required field)",
        row_data: row
      });
      hasError = true;
    }

    if (!row.order_date) {
      errors.push({
        row: rowNum,
        field: "order_date",
        message: "Missing order_date (required field)",
        row_data: row
      });
      hasError = true;
    }

    // Date format validation
    if (row.order_date && !isValidDate(row.order_date)) {
      errors.push({
        row: rowNum,
        field: "order_date",
        message: `Invalid date format "${row.order_date}"`,
        row_data: row
      });
      hasError = true;
    }

    // Optional field warnings
    if (!row.zone) {
      rowWarnings.push({
        row: rowNum,
        field: "zone",
        message: "Missing zone - will default to 'UNKNOWN'",
        row_data: row
      });
    }

    if (!row.city) {
      rowWarnings.push({
        row: rowNum,
        field: "city",
        message: "Missing city - will use zone default",
        row_data: row
      });
    }

    if (!hasError) {
      valid.push(row);
      warnings.push(...rowWarnings);
    }
  });

  return { valid, warnings, errors };
}

function isValidDate(dateStr: string): boolean {
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime());
}

function exportErrorLog(validation: ValidationResult) {
  const log = {
    timestamp: new Date().toISOString(),
    summary: {
      valid: validation.valid.length,
      warnings: validation.warnings.length,
      errors: validation.errors.length
    },
    warnings: validation.warnings,
    errors: validation.errors
  };

  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `import_error_log_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 7. Performance Considerations

### 7.1 Database Indexes

```sql
-- Zone performance queries
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_zone 
  ON public.v_parcel_kpi (warehouse_code, zone, created_date_local);

-- Average delivery time queries
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_delivery_time 
  ON public.v_parcel_kpi (warehouse_code, created_date_local, delivered_ts)
  WHERE delivered_ts IS NOT NULL;

-- Week/month aggregation
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_week_agg 
  ON public.v_parcel_kpi (warehouse_code, (DATE_TRUNC('week', created_date_local)));

-- Data quality checks
CREATE INDEX IF NOT EXISTS idx_parcel_kpi_impossible_ts 
  ON public.v_parcel_kpi (parcel_id)
  WHERE delivered_ts IS NOT NULL AND delivered_ts < order_ts;
```

### 7.2 Query Optimization

```sql
-- Use materialized views for expensive aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_zone_performance AS
SELECT * FROM public.v_zone_performance;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_wow_summary AS
SELECT * FROM public.v_wow_summary;

-- Refresh strategy (call after data upload)
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_zone_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_wow_summary;
END;
$$ LANGUAGE plpgsql;
```

### 7.3 Frontend Caching

```typescript
// lib/utils/cache.ts
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return cached.data as T;
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}
```

---

## 8. Security: Rate Limiting

### 8.1 Rate Limiting Middleware

**File:** `lib/middleware/rate-limit.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

const rateLimits = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

export function rateLimit(request: NextRequest): NextResponse | null {
  // Skip rate limiting for internal requests
  const referer = request.headers.get("referer");
  if (referer?.includes(request.nextUrl.host)) {
    return null; // Internal request, skip rate limit
  }

  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
  const key = `${ip}`;
  const now = Date.now();

  const current = rateLimits.get(key);

  if (!current || now > current.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return null;
  }

  if (current.count >= MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { 
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(current.resetTime / 1000))
        }
      }
    );
  }

  current.count++;
  return null;
}

// Apply to API routes
export function withRateLimit(handler: Function) {
  return async (request: NextRequest, context: any) => {
    const limitResponse = rateLimit(request);
    if (limitResponse) return limitResponse;
    return handler(request, context);
  };
}
```

---

## 9. Migration Strategy

### 9.1 Deployment Order

| Step | Action | Duration |
|------|--------|----------|
| 1 | Create new views (v_zone_performance, v_avg_delivery_time, v_wow_summary, v_mom_summary) | 1 min |
| 2 | Create data_quality_issues table | 30 sec |
| 3 | Create detect_data_quality_issues function | 30 sec |
| 4 | Add database indexes | 1 min |
| 5 | Deploy API routes | 2 min |
| 6 | Deploy frontend pages | 2 min |
| 7 | Add mobile responsive CSS | 30 sec |
| 8 | Run initial data quality check | 30 sec |

**Total:** ~8 minutes, no downtime required

### 9.2 Rollback Plan

Keep backup of all previous view definitions. If issues occur:

```sql
-- Restore previous views
DROP VIEW IF EXISTS public.v_dod_summary CASCADE;
-- Recreate from backup definition
```
