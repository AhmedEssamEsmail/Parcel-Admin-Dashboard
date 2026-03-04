# Tasks Breakdown - Phase 2 Enhancements
## Implementation Tasks for Visibility & KPI Improvements

**Project:** Parcel Admin Dashboard  
**Date:** March 2026  
**Version:** 2.1

---

## 1. Task Overview

### 1.2 Verification
- ✅ 2026-03-04: npm run build, npm run validate, npm run test:run, npm run test:integration, npm run type-check, npm run lint
- ✅ 2026-03-04: npm run build, npm run validate, npm run test:run, npm run test:integration, npm run type-check, npm run lint (post-enhancements)
- ✅ 2026-03-04: supabase db push --include-all (migration fixes for order_ts_utc + data_quality_issues sampling)
- ✅ 2026-03-04: npm run build, npm run validate, npm run test:run, npm run test:integration, npm run type-check, npm run lint (Enhancements v1.0 branch prep)

This document breaks down all Phase 2 enhancement tasks with dependencies, estimates, and acceptance criteria. Tasks are organized by functional area.

### 1.1 Task Summary

| Area | Tasks | Total Hours |
|------|-------|-------------|
| Database Views | 5 | 4 hours |
| Zone Performance | 3 | 4 hours |
| Average Delivery Time | 2 | 2 hours |
| Week/Month Over Period | 3 | 4 hours |
| Date Range Comparison | 2 | 3 hours |
| CSV Export | 2 | 2 hours |
| Data Quality Page | 4 | 5 hours |
| Mobile Responsive | 3 | 4 hours |
| Auto-Refresh | 2 | 2 hours |
| CSV Import Validation | 2 | 3 hours |
| Performance Leaderboard | 2 | 2 hours |
| Shift Management | 3 | 3 hours |
| Rate Limiting | 1 | 1 hour |
| **TOTAL** | **34 tasks** | **39 hours** |

---

## 2. Database Views Tasks

### TASK-DB-V1: Create v_zone_performance View

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** KPI Fixes Phase 1

**Description:**
Create database view for zone-level performance metrics.

**Steps:**
1. Design view schema with zone, city, area grouping
2. Implement OTD% calculation per zone
3. Add average delivery time calculation
4. Add low volume detection
5. Create index for zone queries

**SQL:**
```sql
CREATE OR REPLACE VIEW public.v_zone_performance AS
WITH zone_stats AS (
  SELECT
    k.warehouse_code,
    COALESCE(k.zone, 'UNKNOWN') as zone,
    COALESCE(k.city, 'UNKNOWN') as city,
    k.area,
    k.created_date_local as day,
    COUNT(DISTINCT k.parcel_id) as total_orders,
    COUNT(DISTINCT k.parcel_id) FILTER (WHERE k.delivered_ts IS NOT NULL) as delivered_count,
    COUNT(DISTINCT k.parcel_id) FILTER (WHERE k.is_on_time IS TRUE) as on_time_count,
    AVG(EXTRACT(EPOCH FROM (k.delivered_ts - k.order_ts)) / 60) 
      FILTER (WHERE k.delivered_ts IS NOT NULL AND k.delivered_ts > k.order_ts) as avg_delivery_minutes
  FROM public.v_parcel_kpi k
  GROUP BY k.warehouse_code, k.zone, k.city, k.area, k.created_date_local
)
SELECT
  warehouse_code, zone, city, area, day,
  total_orders, delivered_count, on_time_count,
  CASE WHEN delivered_count = 0 THEN NULL 
       ELSE ROUND((on_time_count::NUMERIC / delivered_count::NUMERIC) * 100, 2) 
  END as otd_pct,
  ROUND(avg_delivery_minutes::NUMERIC, 0) as avg_delivery_minutes,
  CASE WHEN total_orders < 5 THEN 'LOW_VOLUME' ELSE 'NORMAL' END as volume_status
FROM zone_stats;

CREATE INDEX idx_zone_perf ON v_parcel_kpi (warehouse_code, zone, created_date_local);
```

**Acceptance Criteria:**
- [ ] View returns data grouped by zone
- [ ] OTD% calculated correctly
- [ ] Low volume flag works
- [ ] Query performance < 500ms
- [x] View returns data grouped by zone
- [x] OTD% calculated correctly
- [x] Low volume flag works

---

### TASK-DB-V2: Create v_avg_delivery_time View

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** KPI Fixes Phase 1

**Description:**
Create view for average delivery time metrics.

**SQL:**
```sql
CREATE OR REPLACE VIEW public.v_avg_delivery_time AS
SELECT
  k.warehouse_code,
  k.created_date_local as day,
  COUNT(*) as delivered_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (k.delivered_ts - k.order_ts)) / 60)::NUMERIC, 0) as avg_minutes,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP 
    (ORDER BY EXTRACT(EPOCH FROM (k.delivered_ts - k.order_ts)) / 60)::NUMERIC, 0) as median_minutes,
  ROUND(MIN(EXTRACT(EPOCH FROM (k.delivered_ts - k.order_ts)) / 60)::NUMERIC, 0) as min_minutes,
  ROUND(MAX(EXTRACT(EPOCH FROM (k.delivered_ts - k.order_ts)) / 60)::NUMERIC, 0) as max_minutes
FROM public.v_parcel_kpi k
WHERE k.delivered_ts IS NOT NULL
  AND k.delivered_ts > k.order_ts  -- Exclude impossible timestamps
GROUP BY k.warehouse_code, k.created_date_local;
```

**Acceptance Criteria:**
- [ ] Average calculated in minutes
- [ ] Impossible timestamps excluded
- [ ] Median included for better accuracy
- [x] Average calculated in minutes
- [x] Impossible timestamps excluded
- [x] Median included for better accuracy

---

### TASK-DB-V3: Create v_wow_summary View

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** KPI Fixes Phase 1

**Description:**
Create weekly summary view with Sunday as week start.

**SQL:**
```sql
CREATE OR REPLACE VIEW public.v_wow_summary AS
WITH week_calc AS (
  SELECT
    warehouse_code,
    created_date_local,
    -- Sunday-start week calculation
    (created_date_local - (EXTRACT(DOW FROM created_date_local)::INT))::DATE as week_start,
    parcel_id, delivered_ts, is_on_time, waiting_address, order_ts
  FROM public.v_parcel_kpi
)
SELECT
  warehouse_code,
  week_start,
  week_start + 6 as week_end,
  TO_CHAR(week_start, 'Mon DD') || ' - ' || TO_CHAR(week_start + 6, 'Mon DD, YYYY') as week_label,
  COUNT(DISTINCT parcel_id) as total_placed,
  COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL) as total_delivered,
  COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE) as on_time,
  COUNT(DISTINCT parcel_id) FILTER (WHERE waiting_address IS TRUE) as wa_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (delivered_ts - order_ts)) / 60) 
    FILTER (WHERE delivered_ts IS NOT NULL)::NUMERIC, 0) as avg_delivery_minutes,
  CASE WHEN COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL) = 0 THEN NULL
       ELSE ROUND((COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE)::NUMERIC 
         / COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL)::NUMERIC) * 100, 2)
  END as otd_pct,
  'week' as period_type
FROM week_calc
GROUP BY warehouse_code, week_start
ORDER BY warehouse_code, week_start DESC;
```

**Acceptance Criteria:**
- [ ] Weeks start on Sunday
- [ ] Week labels formatted correctly
- [ ] All metrics calculated per week
- [ ] Results ordered by date DESC
- [x] Weeks start on Sunday
- [x] Week labels formatted correctly
- [x] All metrics calculated per week
- [x] Results ordered by date DESC

---

### TASK-DB-V4: Create v_mom_summary View

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-DB-V3

**SQL:**
```sql
CREATE OR REPLACE VIEW public.v_mom_summary AS
SELECT
  warehouse_code,
  DATE_TRUNC('month', created_date_local)::DATE as month_start,
  (DATE_TRUNC('month', created_date_local) + INTERVAL '1 month - 1 day')::DATE as month_end,
  TO_CHAR(DATE_TRUNC('month', created_date_local), 'Month YYYY') as month_label,
  COUNT(DISTINCT parcel_id) as total_placed,
  COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL) as total_delivered,
  COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE) as on_time,
  COUNT(DISTINCT parcel_id) FILTER (WHERE waiting_address IS TRUE) as wa_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (delivered_ts - order_ts)) / 60) 
    FILTER (WHERE delivered_ts IS NOT NULL)::NUMERIC, 0) as avg_delivery_minutes,
  CASE WHEN COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL) = 0 THEN NULL
       ELSE ROUND((COUNT(DISTINCT parcel_id) FILTER (WHERE is_on_time IS TRUE)::NUMERIC 
         / COUNT(DISTINCT parcel_id) FILTER (WHERE delivered_ts IS NOT NULL)::NUMERIC) * 100, 2)
  END as otd_pct,
  'month' as period_type
FROM public.v_parcel_kpi
GROUP BY warehouse_code, DATE_TRUNC('month', created_date_local)
ORDER BY warehouse_code, month_start DESC;
```

---

### TASK-DB-V5: Create data_quality_issues Table and Function

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** None

**SQL:**
```sql
-- Table
CREATE TABLE public.data_quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id TEXT NOT NULL,
  check_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  warehouse_code TEXT,
  description TEXT NOT NULL,
  affected_count INT NOT NULL DEFAULT 0,
  sample_records JSONB,
  recommendation TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Detection function
CREATE OR REPLACE FUNCTION public.detect_data_quality_issues()
RETURNS void AS $$
-- See Design Spec section 2.6 for full implementation
$$ LANGUAGE plpgsql;
```

**Acceptance Criteria:**
- [ ] Table created with proper schema
- [ ] Function detects all 6 issue types
- [ ] Issues stored and retrievable
- [ ] Resolution tracking works
- [x] Table created with proper schema
- [x] Function detects all 6 issue types
- [x] Issues stored and retrievable
- [x] Resolution tracking works

---

## 3. Zone Performance Tasks

### TASK-ZONE-1: Create Zone Performance API Endpoint

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-DB-V1

**File:** `app/api/zone-performance/route.ts`

**Steps:**
1. Create API route file
2. Implement GET handler with query params
3. Add aggregation logic
4. Add top/bottom filtering
5. Add error handling

**Acceptance Criteria:**
- [ ] Endpoint returns zone data
- [ ] Supports view=top, bottom, all
- [ ] Aggregation works correctly
- [ ] Response time < 500ms
- [x] Endpoint returns zone data
- [x] Supports view=top, bottom, all
- [x] Aggregation works correctly

---

### TASK-ZONE-2: Create Zone Performance Page

**Priority:** HIGH  
**Estimate:** 1.5 hours  
**Dependencies:** TASK-ZONE-1

**File:** `app/zone-performance/page.tsx`

**Steps:**
1. Create page component
2. Add filters (warehouse, date range)
3. Create top zones table
4. Create needs attention table
5. Add export button

**Acceptance Criteria:**
- [ ] Page displays top 5 zones
- [ ] Page displays bottom 5 zones
- [ ] Filters work correctly
- [ ] Export downloads CSV
- [x] Page displays top 5 zones
- [x] Page displays bottom 5 zones
- [x] Filters work correctly
- [x] Export downloads CSV

---

### TASK-ZONE-3: Add Zone Drill-Down

**Priority:** MEDIUM  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-ZONE-2

**Steps:**
1. Add click handler on zone rows
2. Show city breakdown on click
3. Show area breakdown on city click
4. Add breadcrumb navigation

**Acceptance Criteria:**
- [x] Drill-down supports zone → city → area
- [x] Breadcrumb navigation resets selection

---

## 4. Average Delivery Time Tasks

### TASK-ADT-1: Create Average Delivery Time API

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** TASK-DB-V2

**File:** `app/api/avg-delivery/route.ts`

**Steps:**
1. Create API route
2. Calculate overall average
3. Calculate trend vs previous period
4. Format response

**Acceptance Criteria:**
- [ ] Returns average in minutes
- [ ] Includes trend direction
- [ ] Includes change amount
- [ ] Response time < 200ms
- [x] Returns average in minutes
- [x] Includes trend direction
- [x] Includes change amount

---

### TASK-ADT-2: Create Average Delivery Widget

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** TASK-ADT-1

**File:** `components/widgets/avg-delivery-widget.tsx`

**Steps:**
1. Create widget component
2. Display big number (hours and minutes)
3. Show trend indicator
4. Add tooltip with calculation info

**Acceptance Criteria:**
- [ ] Displays time in "Xh Ym" format
- [ ] Shows up/down trend arrow
- [ ] Tooltip explains calculation
- [x] Displays time in "Xh Ym" format
- [x] Shows up/down trend arrow

---

## 5. Week/Month Over Period Tasks

### TASK-WOW-1: Create WoW/MoM API Endpoint

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-DB-V3, TASK-DB-V4

**File:** `app/api/wow-summary/route.ts`

**Steps:**
1. Create API route
2. Support periodType param (week/month)
3. Fetch from correct view
4. Calculate period-over-period changes
5. Return formatted response

**Acceptance Criteria:**
- [ ] Returns weekly data when periodType=week
- [ ] Returns monthly data when periodType=month
- [ ] Includes change calculations
- [ ] Limit parameter works
- [x] Returns weekly data when periodType=week
- [x] Returns monthly data when periodType=month
- [x] Includes change calculations
- [x] Limit parameter works

---

### TASK-WOW-2: Create WoW/MoM Table Component

**Priority:** HIGH  
**Estimate:** 1.5 hours  
**Dependencies:** TASK-WOW-1

**File:** `components/tables/wow-mom-table.tsx`

**Steps:**
1. Create table component
2. Add toggle switch for week/month
3. Display period rows with changes
4. Color code improvements/declines
5. Add export button

**Acceptance Criteria:**
- [ ] Toggle switches views
- [ ] Changes displayed with arrows
- [ ] Colors indicate direction
- [ ] Export works
- [x] Toggle switches views
- [x] Changes displayed with arrows
- [x] Colors indicate direction
- [x] Export works

---

### TASK-WOW-3: Integrate WoW/MoM into Dashboard

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-WOW-2

**Steps:**
1. Add component to dashboard page
2. Connect to warehouse filter
3. Test with real data

**Acceptance Criteria:**
- [x] Component renders on dashboard
- [x] Uses warehouse filter context

---

## 6. Date Range Comparison Tasks

### TASK-COMP-1: Create Compare Periods API

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** None

**File:** `app/api/compare-periods/route.ts`

**Steps:**
1. Create POST endpoint
2. Accept two date ranges
3. Fetch metrics for each range
4. Calculate differences
5. Return comparison object

**Acceptance Criteria:**
- [ ] Accepts two date ranges
- [ ] Returns metrics for both periods
- [ ] Calculates absolute and pct differences
- [ ] Identifies improvement/decline
- [x] Accepts two date ranges
- [x] Returns metrics for both periods
- [x] Calculates absolute and pct differences
- [x] Identifies improvement/decline

---

### TASK-COMP-2: Create Comparison Widget

**Priority:** HIGH  
**Estimate:** 1 hour  
**Dependencies:** TASK-COMP-1

**File:** `components/widgets/comparison-widget.tsx`

**Steps:**
1. Create widget component
2. Add date pickers for both periods
3. Add "Compare" button
4. Display side-by-side results
5. Show change indicators

**Acceptance Criteria:**
- [ ] Two date pickers work
- [ ] Results display side-by-side
- [ ] Changes highlighted in color
- [ ] Export comparison data
- [x] Two date pickers work
- [x] Results display side-by-side
- [x] Changes highlighted in color
- [x] Export comparison data

---

## 7. CSV Export Tasks

### TASK-EXP-1: Create Export API Endpoint

**Priority:** HIGH  
**Estimate:** 1.5 hours  
**Dependencies:** None

**File:** `app/api/export/csv/route.ts`

**Steps:**
1. Create API route
2. Support type param (dashboard, zone, wow)
3. Fetch appropriate data
4. Generate CSV with header comments
5. Return with proper headers

**Acceptance Criteria:**
- [ ] Supports multiple export types
- [ ] Includes calculation notes
- [ ] Proper filename format
- [ ] Works with Excel
- [x] Supports multiple export types
- [x] Includes calculation notes
- [x] Proper filename format

---

### TASK-EXP-2: Add Export Buttons to UI

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-EXP-1

**Steps:**
1. Add export button to dashboard
2. Add export button to zone performance
3. Add export button to WoW table
4. Add loading state during export

**Acceptance Criteria:**
- [x] Export buttons trigger CSV downloads
- [x] Loading state shown during export

---

## 8. Data Quality Page Tasks

### TASK-DQ-1: Create Data Quality API

**Priority:** HIGH  
**Estimate:** 1.5 hours  
**Dependencies:** TASK-DB-V5

**File:** `app/api/data-quality/route.ts`

**Steps:**
1. Create API route
2. Call detection function
3. Return grouped by severity
4. Add resolve endpoint (PATCH)

**Acceptance Criteria:**
- [ ] Runs detection on request
- [ ] Returns grouped issues
- [ ] Supports resolve operation
- [x] Runs detection on request
- [x] Returns grouped issues
- [x] Supports resolve operation

---

### TASK-DQ-2: Create Data Quality Page

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** TASK-DQ-1

**File:** `app/data-quality/page.tsx`

**Steps:**
1. Create page component
2. Add summary cards
3. Display issues by severity
4. Add expand/collapse for details
5. Add resolve button

**Acceptance Criteria:**
- [ ] Summary cards show counts
- [ ] Issues grouped by severity
- [ ] Details expandable
- [ ] Resolve updates status
- [x] Summary cards show counts
- [x] Issues grouped by severity
- [x] Details expandable
- [x] Resolve updates status

---

### TASK-DQ-3: Add Sample Records Display

**Priority:** MEDIUM  
**Estimate:** 1 hour  
**Dependencies:** TASK-DQ-2

**Steps:**
1. Add "View Records" button
2. Fetch sample parcel IDs
3. Display in modal or expandable section
4. Add "Export List" functionality

**Acceptance Criteria:**
- [x] View Records expands sample IDs for all severities
- [x] Export List downloads parcel IDs

---

### TASK-DQ-4: Add Navigation Link

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-DQ-2

**Steps:**
1. Add link to AppNav
2. Add mobile menu entry
3. Test navigation

**Acceptance Criteria:**
- [x] AppNav link present
- [x] Mobile menu link present

---

## 9. Mobile Responsive Tasks

### TASK-MOB-1: Add Responsive CSS

**Priority:** HIGH  
**Estimate:** 2 hours  
**Dependencies:** None

**File:** `app/globals.css`

**Steps:**
1. Add tablet breakpoint styles
2. Add mobile breakpoint styles
3. Convert tables to cards on mobile
4. Add touch-friendly controls
5. Stack charts on mobile

**Acceptance Criteria:**
- [ ] Layout adapts to screen size
- [ ] Tables convert to cards
- [ ] Touch targets >= 44px
- [ ] Charts stack vertically
- [x] Layout adapts to screen size
- [x] Tables convert to cards
- [x] Touch targets >= 44px

---

### TASK-MOB-2: Create Mobile Navigation

**Priority:** HIGH  
**Estimate:** 1.5 hours  
**Dependencies:** None

**File:** `components/layout/mobile-nav.tsx`

**Steps:**
1. Create hamburger menu button
2. Create slide-out menu
3. Add all navigation links
4. Implement open/close state

**Acceptance Criteria:**
- [ ] Hamburger appears on mobile
- [ ] Menu slides in from side
- [ ] All pages accessible
- [ ] Closes on selection
- [x] Hamburger appears on mobile
- [x] Menu slides in from side
- [x] All pages accessible
- [x] Closes on selection

---

### TASK-MOB-3: Test Mobile Experience

**Priority:** MEDIUM  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-MOB-1, TASK-MOB-2

**Steps:**
1. Test on iOS Safari
2. Test on Chrome Android
3. Test on tablet
4. Fix any issues found

**Acceptance Criteria:**
- [ ] Manual device testing completed

---

## 10. Auto-Refresh Tasks

### TASK-AR-1: Implement Auto-Refresh Logic

**Priority:** HIGH  
**Estimate:** 1.5 hours  
**Dependencies:** None

**File:** `app/dashboard/page.tsx` (modify)

**Steps:**
1. Add useEffect for interval
2. Track last updated time
3. Implement pause/resume
4. Add refresh indicator UI
5. Prevent refresh during interactions

**Acceptance Criteria:**
- [ ] Refreshes every 30 seconds
- [ ] Shows time since last refresh
- [ ] Pause button works
- [ ] Manual refresh available
- [x] Refreshes every 30 seconds
- [x] Shows time since last refresh
- [x] Pause button works
- [x] Manual refresh available

---

### TASK-AR-2: Add Refresh Indicator UI

**Priority:** MEDIUM  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-AR-1

**Steps:**
1. Create refresh bar component
2. Show seconds ago counter
3. Add pause/resume button
4. Add manual refresh button

**Acceptance Criteria:**
- [x] Refresh bar shows seconds since update
- [x] Pause/resume controls available

---

## 11. CSV Import Validation Tasks

### TASK-CSV-1: Create Validation Preview Component

**Priority:** HIGH  
**Estimate:** 2.5 hours  
**Dependencies:** None

**File:** `components/upload/csv-preview.tsx`

**Steps:**
1. Create preview modal component
2. Implement validation logic
3. Categorize rows (valid/warning/error)
4. Display summary counts
5. Add expandable details

**Acceptance Criteria:**
- [ ] Shows row counts by category
- [ ] Warnings expandable
- [ ] Errors expandable
- [ ] Proceed button counts correct
- [x] Shows row counts by category
- [x] Warnings expandable
- [x] Errors expandable
- [x] Proceed button counts correct

---

### TASK-CSV-2: Integrate with Upload Flow

**Priority:** HIGH  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-CSV-1

**Steps:**
1. Modify upload page
2. Show preview before commit
3. Pass only valid rows to API
4. Show success/error message

**Acceptance Criteria:**
- [x] Preview gate runs before ingestion
- [x] Only valid rows are sent to API

---

## 12. Leaderboard Tasks

### TASK-LB-1: Create Leaderboard Component

**Priority:** MEDIUM  
**Estimate:** 1.5 hours  
**Dependencies:** TASK-WOW-1

**File:** `components/widgets/leaderboard.tsx`

**Steps:**
1. Create component
2. Fetch WoW data
3. Sort by OTD%
4. Add medal icons for top 3
5. Add warning for low performers

**Acceptance Criteria:**
- [ ] Displays all warehouses
- [ ] Top 3 have medals
- [ ] Low performers highlighted
- [ ] Shows trend vs last week
- [x] Displays all warehouses
- [x] Top 3 have medals
- [x] Low performers highlighted

---

### TASK-LB-2: Add Leaderboard to Dashboard

**Priority:** MEDIUM  
**Estimate:** 0.5 hours  
**Dependencies:** TASK-LB-1

**Steps:**
1. Import component
2. Place prominently on dashboard
3. Connect to warehouse filter

**Acceptance Criteria:**
- [x] Leaderboard renders on dashboard
- [x] Uses filtered warehouse context

---

## 13. Shift Management Enhancement Tasks

### TASK-SHIFT-1: Add Shift Templates Feature

**Priority:** MEDIUM  
**Estimate:** 1.5 hours  
**Dependencies:** Settings Page Phase 1

**Steps:**
1. Create templates table
2. Add save template button
3. Add apply template dropdown
4. Pre-populate with defaults

**Acceptance Criteria:**
- [x] Templates persisted via API
- [x] Save/apply workflow updates shifts

**SQL:**
```sql
CREATE TABLE public.shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  config JSONB NOT NULL,  -- Array of 7 shift configs
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### TASK-SHIFT-2: Add Ramadan Mode Toggle

**Priority:** MEDIUM  
**Estimate:** 1 hour  
**Dependencies:** TASK-SHIFT-1

**Steps:**
1. Add toggle in settings
2. Define Ramadan shift defaults
3. Apply to all warehouses
4. Support date range

**Acceptance Criteria:**
- [x] Ramadan toggle applies default times
- [x] Bulk override supports date ranges and all warehouses

---

### TASK-SHIFT-3: Add Calendar View for Overrides

**Priority:** MEDIUM  
**Estimate:** 0.5 hours  
**Dependencies:** Settings Page Phase 1

**Steps:**
1. Install calendar library
2. Display overrides on calendar
3. Allow click to edit
4. Color code by type

**Acceptance Criteria:**
- [x] Calendar-style month filter displays overrides
- [x] Overrides can be edited inline

---

## 14. Rate Limiting Task

### TASK-SEC-1: Implement Rate Limiting

**Priority:** MEDIUM  
**Estimate:** 1 hour  
**Dependencies:** None

**File:** `lib/middleware/rate-limit.ts`

**Steps:**
1. Create rate limiting middleware
2. Track requests by IP
3. Enforce 100/15min limit
4. Add rate limit headers
5. Apply to all API routes

**Acceptance Criteria:**
- [ ] Limits enforced per IP
- [ ] Returns 429 when exceeded
- [ ] Internal requests exempt
- [ ] Headers include remaining count
- [x] Limits enforced per IP
- [x] Returns 429 when exceeded
- [x] Internal requests exempt
- [x] Headers include remaining count

**Coverage Update:**
- [x] Rate limit applied to remaining API routes

---

## 15. Effort Summary by Phase

### Phase A: Database Views (4 hours)
| Task | Hours |
|------|-------|
| TASK-DB-V1: v_zone_performance | 1h |
| TASK-DB-V2: v_avg_delivery_time | 0.5h |
| TASK-DB-V3: v_wow_summary | 1h |
| TASK-DB-V4: v_mom_summary | 0.5h |
| TASK-DB-V5: data_quality_issues | 1h |

### Phase B: Zone Performance (4 hours)
| Task | Hours |
|------|-------|
| TASK-ZONE-1: API endpoint | 2h |
| TASK-ZONE-2: Page | 1.5h |
| TASK-ZONE-3: Drill-down | 0.5h |

### Phase C: Average Delivery Time (2 hours)
| Task | Hours |
|------|-------|
| TASK-ADT-1: API | 1h |
| TASK-ADT-2: Widget | 1h |

### Phase D: Week/Month Over Period (4 hours)
| Task | Hours |
|------|-------|
| TASK-WOW-1: API | 2h |
| TASK-WOW-2: Component | 1.5h |
| TASK-WOW-3: Integration | 0.5h |

### Phase E: Date Comparison (3 hours)
| Task | Hours |
|------|-------|
| TASK-COMP-1: API | 2h |
| TASK-COMP-2: Widget | 1h |

### Phase F: CSV Export (2 hours)
| Task | Hours |
|------|-------|
| TASK-EXP-1: API | 1.5h |
| TASK-EXP-2: UI buttons | 0.5h |

### Phase G: Data Quality Page (5 hours)
| Task | Hours |
|------|-------|
| TASK-DQ-1: API | 1.5h |
| TASK-DQ-2: Page | 2h |
| TASK-DQ-3: Sample records | 1h |
| TASK-DQ-4: Navigation | 0.5h |

### Phase H: Mobile Responsive (4 hours)
| Task | Hours |
|------|-------|
| TASK-MOB-1: CSS | 2h |
| TASK-MOB-2: Navigation | 1.5h |
| TASK-MOB-3: Testing | 0.5h |

### Phase I: Auto-Refresh (2 hours)
| Task | Hours |
|------|-------|
| TASK-AR-1: Logic | 1.5h |
| TASK-AR-2: UI | 0.5h |

### Phase J: CSV Import Validation (3 hours)
| Task | Hours |
|------|-------|
| TASK-CSV-1: Component | 2.5h |
| TASK-CSV-2: Integration | 0.5h |

### Phase K: Leaderboard (2 hours)
| Task | Hours |
|------|-------|
| TASK-LB-1: Component | 1.5h |
| TASK-LB-2: Integration | 0.5h |

### Phase L: Shift Enhancements (3 hours)
| Task | Hours |
|------|-------|
| TASK-SHIFT-1: Templates | 1.5h |
| TASK-SHIFT-2: Ramadan mode | 1h |
| TASK-SHIFT-3: Calendar | 0.5h |

### Phase M: Security (1 hour)
| Task | Hours |
|------|-------|
| TASK-SEC-1: Rate limiting | 1h |

---

## 16. Critical Path

```
Phase A (Database Views)
    │
    ├─→ Phase B (Zone Performance)
    │
    ├─→ Phase C (Average Delivery)
    │
    ├─→ Phase D (WoW/MoM) ─→ Phase K (Leaderboard)
    │
    └─→ Phase G (Data Quality)

Phase H (Mobile) ─→ Can run in parallel

Phase I (Auto-Refresh) ─→ Can run in parallel

Phase J (CSV Validation) ─→ Can run in parallel

Phase E (Comparison), Phase F (Export) ─→ Can run in parallel

Phase L (Shift), Phase M (Security) ─→ Can run in parallel
```

---

## 17. Recommended Execution Order

### Sprint 1: Core KPIs (Week 1)
1. TASK-DB-V1, TASK-DB-V2, TASK-DB-V5 (parallel)
2. TASK-DB-V3, TASK-DB-V4 (parallel)
3. TASK-ZONE-1, TASK-ADT-1, TASK-WOW-1 (parallel)
4. TASK-DQ-1

### Sprint 2: UI Components (Week 1-2)
5. TASK-ZONE-2, TASK-ADT-2 (parallel)
6. TASK-WOW-2, TASK-WOW-3
7. TASK-COMP-1, TASK-COMP-2 (parallel)
8. TASK-EXP-1, TASK-EXP-2 (parallel)

### Sprint 3: Data Quality & Mobile (Week 2)
9. TASK-DQ-2, TASK-DQ-3, TASK-DQ-4
10. TASK-MOB-1, TASK-MOB-2 (parallel)
11. TASK-MOB-3

### Sprint 4: Enhancements (Week 3)
12. TASK-AR-1, TASK-AR-2
13. TASK-CSV-1, TASK-CSV-2
14. TASK-LB-1, TASK-LB-2
15. TASK-SHIFT-1, TASK-SHIFT-2, TASK-SHIFT-3
16. TASK-SEC-1

---

## 18. Acceptance Testing Checklist

### New KPIs
- [ ] Average Delivery Time displays correctly
- [ ] Zone Performance shows top/bottom zones
- [ ] Calculations match manual verification

### Dashboard Tables
- [ ] Third table (WoW/MoM) displays
- [ ] Toggle switches between week/month
- [ ] Changes calculated correctly
- [ ] Date range comparison works

### Export
- [ ] CSV export includes all data
- [ ] Calculation notes included
- [ ] File downloads with correct name

### Data Quality
- [ ] All 6 checks run successfully
- [ ] Issues displayed by severity
- [ ] Sample records viewable
- [ ] Resolve button works

### Mobile
- [ ] Tables convert to cards
- [ ] Navigation works
- [ ] All features accessible
- [ ] Touch targets adequate

### Auto-Refresh
- [ ] Refreshes every 30 seconds
- [ ] Pause/resume works
- [ ] Manual refresh available
- [ ] Counter shows time since update

### CSV Import
- [ ] Preview shows before import
- [ ] Warnings detected
- [ ] Errors detected
- [ ] Only valid rows imported
