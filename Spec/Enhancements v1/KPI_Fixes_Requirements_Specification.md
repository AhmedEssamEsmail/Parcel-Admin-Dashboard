# Requirements Specification
## Logistics KPI Calculation Fixes - Parcel Admin Dashboard

**Project:** Parcel Admin Dashboard  
**Date:** March 2026  
**Version:** 2.0

---

## 1. Executive Summary

This document specifies the requirements for fixing calculation logic issues in the Parcel Admin Dashboard's logistics KPI system. The issues were identified during a comprehensive code review and affect the accuracy of On-Time Delivery (OTD) metrics across multiple warehouses in the GCC region.

The project now includes:
1. **KPI Calculation Fixes** - Correcting OTD percentage and deadline calculations
2. **Settings Page** - New configuration interface for shifts, SLAs, and holidays
3. **Dashboard Redesign** - Dual tables with WA/Non-WA breakdown
4. **Performance Optimization** - Real-time (<1 second) response requirements

---

## 2. Scope

### 2.1 In Scope

| Category | Items |
|----------|-------|
| **KPI Calculations** | On-Time Delivery percentage fix, After-cutoff order handling, API-SQL alignment |
| **Settings Page** | Warehouse shift configuration, SLA configuration per warehouse, Holiday/Ramadan override management |
| **Dashboard** | Dual table display (with/without WA), Three-metric layout (Placed, Delivered, OTD%) |
| **Performance** | Query optimization, Indexing, Caching for real-time response |
| **Timezone** | GMT+3 standardization (no conversion needed) |

### 2.2 Out of Scope

- Historical data migration (user will clear DB and reupload)
- UI/UX redesign beyond dashboard tables
- New authentication features
- Mobile responsive design changes

---

## 3. Functional Requirements

### 3.1 On-Time Delivery Calculation (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-1.1 | The system shall calculate OTD percentage as: `(On-Time Deliveries / Total Delivered Orders) × 100` |
| REQ-1.2 | The system shall include ALL delivered parcels in the denominator |
| REQ-1.3 | The system shall display two separate tables: one including WA orders, one excluding WA orders |
| REQ-1.4 | Both tables shall use the same SLA configuration |
| REQ-1.5 | The system shall track WA orders separately with column: `waiting_address` flag |

### 3.2 Dashboard Table Structure (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-2.1 | Each table shall display three columns: Total Orders Placed, Total Delivered, On-Time % |
| REQ-2.2 | "Total Orders Placed" = COUNT of all orders within date range |
| REQ-2.3 | "Total Delivered" = COUNT of orders where `delivered_ts IS NOT NULL` |
| REQ-2.4 | "On-Time %" = (Delivered On-Time / Total Delivered) × 100 |
| REQ-2.5 | Table 1: Includes all orders (with WA) |
| REQ-2.6 | Table 2: Excludes orders where `waiting_address = true` |

**Table Structure Example:**

```
Table 1: Including Waiting Address Orders
| Day       | Total Placed | Total Delivered | On-Time % |
|-----------|--------------|-----------------|-----------|
| 2026-03-01| 150          | 142             | 85.2%     |

Table 2: Excluding Waiting Address Orders  
| Day       | Total Placed | Total Delivered | On-Time % |
|-----------|--------------|-----------------|-----------|
| 2026-03-01| 145          | 138             | 87.5%     |
```

### 3.3 Settings Page - Shift Configuration (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-3.1 | The system shall provide a Settings page accessible from navigation |
| REQ-3.2 | The system shall allow configuring shift start/end times per warehouse per day of week |
| REQ-3.3 | Shift configuration shall support 7-day week with individual day settings |
| REQ-3.4 | Default shift times shall be pre-populated from existing warehouse defaults |
| REQ-3.5 | Changes to shift times shall only affect NEW orders uploaded after the change |
| REQ-3.6 | The system shall validate shift times (end > start, valid time format) |

**Shift Configuration Data Structure:**

```typescript
interface WarehouseShiftConfig {
  warehouse_id: string;
  day_of_week: 0-6;  // Sunday = 0
  shift_start: string;  // "HH:mm" format
  shift_end: string;    // "HH:mm" format
  is_active: boolean;
}
```

### 3.4 Settings Page - SLA Configuration (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-4.1 | The system shall allow configuring SLA (in minutes) per warehouse |
| REQ-4.2 | Default SLA shall be 240 minutes (4 hours) |
| REQ-4.3 | SLA changes shall only affect calculations for NEW orders |
| REQ-4.4 | The system shall display current SLA alongside warehouse name |

### 3.5 Settings Page - Holiday/Override Management (MEDIUM PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-5.1 | The system shall allow adding holiday/override dates |
| REQ-5.2 | Each override shall specify: date, modified shift start, modified shift end |
| REQ-5.3 | Overrides shall apply to specific warehouse(s) |
| REQ-5.4 | The system shall support bulk override creation (e.g., Ramadan period) |
| REQ-5.5 | Overrides shall be displayed in a calendar or list view |

**Holiday Override Data Structure:**

```typescript
interface WarehouseShiftOverride {
  warehouse_id: string;
  override_date: string;  // "YYYY-MM-DD"
  shift_start: string | null;  // null = closed
  shift_end: string | null;
  reason: string;  // "Ramadan", "Public Holiday", etc.
}
```

### 3.6 Timezone Handling (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-6.1 | All timestamps shall be stored and displayed in GMT+3 (GCC time) |
| REQ-6.2 | The system shall NOT subtract hours when parsing CSV timestamps |
| REQ-6.3 | CSV imports shall treat all timestamps as GMT+3 without conversion |
| REQ-6.4 | Database timezone shall remain `Etc/GMT-3` for PostgreSQL compatibility |

### 3.7 After-Cutoff Order Handling (MEDIUM PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-7.1 | Orders placed after shift end shall be scheduled for next business day |
| REQ-7.2 | Deadline for after-cutoff orders: `next_day + next_shift_start + SLA_minutes` |
| REQ-7.3 | If no next day shift configured, use warehouse default shift as fallback |

### 3.8 Pre-Shift Order Handling (CONFIRMED - NO CHANGE)

| Req ID | Requirement |
|--------|-------------|
| REQ-8.1 | Orders placed before shift start shall have deadline = `shift_start + SLA_minutes` |
| REQ-8.2 | This behavior is confirmed correct and shall remain unchanged |

### 3.9 API-SQL Consistency (MEDIUM PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-9.1 | TypeScript API fallback shall produce identical results to SQL views |
| REQ-9.2 | Both calculations shall use same denominator logic |
| REQ-9.3 | Integration tests shall verify consistency |

---

## 4. Non-Functional Requirements

### 4.1 Performance Requirements

| Req ID | Requirement |
|--------|-------------|
| NFR-1.1 | Dashboard page shall load in **< 1 second** for 45-day date range |
| NFR-1.2 | Settings page shall load in < 500ms |
| NFR-1.3 | API endpoints shall respond in < 200ms (p95) |
| NFR-1.4 | Query performance shall not degrade by more than 10% after changes |

### 4.2 Scalability Requirements

| Req ID | Requirement |
|--------|-------------|
| NFR-2.1 | System shall support up to 100,000 orders per warehouse per month |
| NFR-2.2 | System shall support up to 10 warehouses |
| NFR-2.3 | Dashboard shall handle 90-day date range queries |

### 4.3 Data Integrity

| Req ID | Requirement |
|--------|-------------|
| NFR-3.1 | All existing data shall remain accessible after changes |
| NFR-3.2 | Settings changes shall be audited (who, when, what) |
| NFR-3.3 | Concurrent settings edits shall be prevented (optimistic locking) |

### 4.4 Maintainability

| Req ID | Requirement |
|--------|-------------|
| NFR-4.1 | All SQL views shall include comments explaining calculation logic |
| NFR-4.2 | Timezone handling shall be documented in code comments |
| NFR-4.3 | Settings API shall be versioned for future extensions |

---

## 5. Acceptance Criteria

| ID | Criteria | Verification Method |
|----|----------|---------------------|
| AC-1 | OTD % matches industry standard formula | Manual calculation verification with test data |
| AC-2 | Dashboard displays two tables (with/without WA) | Visual inspection |
| AC-3 | All timestamps remain in GMT+3 | Compare CSV import with stored DB value |
| AC-4 | API and SQL produce identical results | Automated integration test |
| AC-5 | Settings page allows shift configuration | Manual testing, save/reload verification |
| AC-6 | Settings page allows SLA configuration | Manual testing, calculation verification |
| AC-7 | Holiday overrides work correctly | Test with known holiday date |
| AC-8 | Dashboard loads in < 1 second | Performance testing with 50K orders |
| AC-9 | After-cutoff orders get next day deadline | Verify with order placed after shift end |
| AC-10 | Pre-shift orders get shift_start + SLA deadline | Verify with order placed before shift start |

---

## 6. Data Model Changes

### 6.1 New Tables

#### `warehouse_shift_configs`
```sql
CREATE TABLE warehouse_shift_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, day_of_week)
);
```

### 6.2 Modified Tables

#### `warehouses`
```sql
ALTER TABLE warehouses ADD COLUMN sla_minutes INT NOT NULL DEFAULT 240;
-- Column already exists, ensure default is correct
```

### 6.3 Existing Tables (No Changes)

#### `warehouse_shift_overrides`
- Already exists
- Used for holidays and Ramadan
- Settings page will provide CRUD interface

---

## 7. API Endpoints

### 7.1 Settings Endpoints (New)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/warehouses` | List all warehouses with settings |
| PUT | `/api/settings/warehouses/:id/sla` | Update SLA for warehouse |
| GET | `/api/settings/warehouses/:id/shifts` | Get shift config for warehouse |
| PUT | `/api/settings/warehouses/:id/shifts` | Update shift config for warehouse |
| GET | `/api/settings/overrides` | List all holiday overrides |
| POST | `/api/settings/overrides` | Create holiday override |
| PUT | `/api/settings/overrides/:id` | Update holiday override |
| DELETE | `/api/settings/overrides/:id` | Delete holiday override |

### 7.2 Dashboard Endpoints (Modified)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dod` | Returns dual table data (with/without WA breakdown) |

---

## 8. User Interface Requirements

### 8.1 Dashboard Page

```
┌─────────────────────────────────────────────────────────────┐
│ Filters: [Warehouse ▼] [From ▼] [To ▼] [Apply]             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Including Waiting Address Orders                        │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ | Day       | Total Placed | Delivered | On-Time % |   │ │
│ │ |-----------|--------------|-----------|-----------|   │ │
│ │ | 2026-03-01| 150          | 142       | 85.2%     |   │ │
│ │ | 2026-03-02| 165          | 158       | 88.1%     |   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Excluding Waiting Address Orders                        │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ | Day       | Total Placed | Delivered | On-Time % |   │ │
│ │ |-----------|--------------|-----------|-----------|   │ │
│ │ | 2026-03-01| 145          | 138       | 87.5%     |   │ │
│ │ | 2026-03-02| 160          | 154       | 90.2%     |   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Combo Chart: Total Orders + On-Time % Trend]              │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Settings Page

```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Tabs: [Warehouses] [Shifts] [Holidays]                      │
│                                                             │
│ ┌─ Warehouses Tab ─────────────────────────────────────────┐│
│ │ | Warehouse | SLA (min) | Default Shift Start | End |   ││
│ │ |-----------|-----------|-------------------|-------|   ││
│ │ | KUWAIT    | [240   ▼] | 08:00            | 19:00 |   ││
│ │ | RIYADH    | [240   ▼] | 08:00            | 18:00 |   ││
│ │ | ...       |           |                   |       |   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Shifts Tab ─────────────────────────────────────────────┐│
│ │ Warehouse: [KUWAIT ▼]                                    ││
│ │ | Day       | Start  | End    | Active |               ││
│ │ |-----------|--------|--------|--------|               ││
│ │ | Sunday    | 08:00  | 19:00  | [✓]    |               ││
│ │ | Monday    | 08:00  | 19:00  | [✓]    |               ││
│ │ | ...       |        |        |        |               ││
│ │ [Save Changes]                                           ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Holidays Tab ───────────────────────────────────────────┐│
│ │ [Add Holiday]  [Bulk Add (Ramadan)]                      ││
│ │ | Date       | Warehouse | Start | End | Reason       | ││
│ │ |------------|-----------|-------|-----|--------------| ││
│ │ | 2026-03-15 | KUWAIT    | 10:00 | 17:00| National Day | ││
│ │ | 2026-03-16 | ALL       | -     | -   | Holiday      | ││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Next.js 16 | Framework | Already in use |
| Supabase | Database | Already in use |
| Chart.js | Visualization | Already in use |
| React Hook Form | Forms | For settings page forms |
| Zod | Validation | For settings validation |

---

## 10. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance degradation with new tables | Medium | High | Add proper indexes, implement caching |
| Settings misconfiguration | Medium | High | Add validation, confirmation dialogs |
| Breaking existing data after timezone fix | Low | High | User will clear DB and reupload |
| Complex shift calculations | Medium | Medium | Comprehensive unit tests |

---

## 11. Glossary

| Term | Definition |
|------|------------|
| OTD | On-Time Delivery - percentage of orders delivered within SLA |
| SLA | Service Level Agreement - maximum allowed delivery time (default 240 min) |
| WA | Waiting Address - orders with incomplete/unclear delivery address |
| Shift | Operating hours for warehouse (start to end time) |
| Cutoff | End of shift; orders after cutoff scheduled for next day |
| Override | Exception to normal shift hours (holidays, Ramadan) |
