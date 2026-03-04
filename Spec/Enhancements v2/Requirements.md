# Requirements Specification - Phase 2 Enhancements
## Parcel Admin Dashboard - Visibility & KPI Improvements

**Project:** Parcel Admin Dashboard  
**Date:** March 2026  
**Version:** 2.1

---

## 1. Executive Summary

This document specifies requirements for Phase 2 enhancements to the Parcel Admin Dashboard. The focus is on improving visibility into KPI calculations, adding new metrics, and enhancing data quality monitoring. These changes address the core pain point: "not enough visibility, don't trust the calculations."

**Key Objectives:**
1. Add transparency to all KPI calculations
2. Introduce new KPIs: Average Delivery Time and Zone Performance
3. Provide week-over-week and month-over-month trend views
4. Enable data export and comparison features
5. Create data quality monitoring dashboard
6. Build mobile-responsive interface

---

## 2. Scope

### 2.1 In Scope

| Category | Items |
|----------|-------|
| **New KPIs** | Average Delivery Time, Zone Performance breakdown |
| **Dashboard Tables** | Week-over-week view, Month-over-month toggle, Date range comparison |
| **Export Features** | CSV export for all tables |
| **Data Quality** | Dedicated monitoring page with issue detection |
| **Mobile** | Responsive design for all dashboard pages |
| **Auto-Refresh** | 30-second automatic data refresh |
| **CSV Import** | Validation preview before database commit |
| **Performance** | Leaderboard for top/bottom performers |
| **Security** | API rate limiting |
| **Shift Management** | Templates, calendar view, weekend patterns |

### 2.2 Out of Scope

- Email notifications (deferred to future phase)
- Authentication changes (keep single password)
- API documentation (not needed)
- Backup/recovery automation (single manager)
- Error tracking service (not needed)

---

## 3. Functional Requirements

### 3.1 New KPI: Average Delivery Time (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-ADT-1.1 | The system shall calculate Average Delivery Time as: `AVG(delivered_ts - order_ts)` in minutes |
| REQ-ADT-1.2 | Calculation shall exclude non-delivered orders |
| REQ-ADT-1.3 | System shall show breakdown by: Overall, By Warehouse, By Zone, By Day |
| REQ-ADT-1.4 | System shall display in hours and minutes format (e.g., "3h 45m") |
| REQ-ADT-1.5 | System shall track trend: increasing/decreasing vs previous period |

**Calculation Details:**
```
Average Delivery Time = SUM(delivery_duration_minutes) / COUNT(delivered_orders)

Where:
  delivery_duration_minutes = EXTRACT(EPOCH FROM (delivered_ts - order_ts)) / 60
  
Exclusions:
  - Orders where delivered_ts IS NULL
  - Orders where delivered_ts < order_ts (data error)
```

**Display Example:**
```
┌─────────────────────────────────────────────────────────────┐
│ Average Delivery Time                                       │
├─────────────────────────────────────────────────────────────┤
│ Overall: 3h 42m  ↑ 12m vs last week                        │
│                                                             │
│ By Warehouse:                                               │
│ KUWAIT:   3h 15m  ↓ 8m   (improving)                       │
│ RIYADH:   3h 52m  ↑ 22m  (needs attention)                 │
│ UAE:      4h 05m  ↑ 15m  (needs attention)                 │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.2 New KPI: Zone Performance (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-ZONE-2.1 | The system shall calculate OTD% grouped by zone |
| REQ-ZONE-2.2 | System shall display top 5 best zones and bottom 5 problem zones |
| REQ-ZONE-2.3 | Each zone row shall show: Zone name, Total Orders, Delivered, OTD%, Avg Delivery Time |
| REQ-ZONE-2.4 | System shall allow drilling down from zone to city to area |
| REQ-ZONE-2.5 | Zones with < 5 orders shall be flagged as "low volume" |

**Display Example:**
```
┌─────────────────────────────────────────────────────────────┐
│ Zone Performance - Week of Mar 2-8, 2026                   │
├─────────────────────────────────────────────────────────────┤
│ Top Performing Zones:                                       │
│ Zone         | Orders | Delivered | OTD%  | Avg Time       │
│ Hawally      | 145    | 142       | 97.2% | 2h 45m        │
│ Salmiya      | 198    | 192       | 95.8% | 2h 58m        │
│ Jabriya      | 112    | 107       | 94.7% | 3h 05m        │
│                                                              │
│ Needs Attention:                                            │
│ Zone         | Orders | Delivered | OTD%  | Avg Time       │
│ Jahra        | 89     | 78        | 71.8% | 5h 32m        │
│ Farwaniya    | 156    | 128       | 76.5% | 4h 48m        │
│ Ahmadi       | 67     | 55        | 79.2% | 4h 22m        │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.3 Dashboard Table 3: Week-over-Week / Month-over-Month View (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-WOW-3.1 | The system shall display a third main table showing period-over-period comparison |
| REQ-WOW-3.2 | Week shall start on Sunday |
| REQ-WOW-3.3 | Toggle switch shall allow switching between Weekly and Monthly view |
| REQ-WOW-3.4 | Weekly view shall show current week vs previous week |
| REQ-WOW-3.5 | Monthly view shall show current month vs previous month |
| REQ-WOW-3.6 | Table shall include WA orders (as per user request) |
| REQ-WOW-3.7 | Change indicators shall show ↑ or ↓ with percentage change |

**Weekly View (Default):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Weekly View] ○━━━━━━○ [Monthly View]                               │
│ Week-over-Week Performance (Including WA Orders)                    │
├─────────────────────────────────────────────────────────────────────┤
│ Week              | Total Placed | Delivered | On-Time | OTD%      │
│ Mar 2-8, 2026     | 1,245        | 1,198     | 1,024   | 85.5%     │
│ Feb 23-Mar 1      | 1,102        | 1,067     | 923     | 86.5%     │
│ Change            | ↑ 13%        | ↑ 12%     | ↑ 11%   | ↓ 1.0%   │
├─────────────────────────────────────────────────────────────────────┤
│ Mar 9-15, 2026    | (in progress)                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Monthly View:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ [Weekly View] ○━━━━━━○ [Monthly View]                               │
│ Month-over-Month Performance (Including WA Orders)                  │
├─────────────────────────────────────────────────────────────────────┤
│ Month        | Total Placed | Delivered | On-Time | OTD%  | Trend  │
│ March 2026   | 3,456        | 3,312     | 2,845   | 85.9% | ↑      │
│ February 2026| 3,102        | 2,987     | 2,512   | 84.1% | ↑      │
│ January 2026 | 2,890        | 2,756     | 2,289   | 83.0% | -      │
├─────────────────────────────────────────────────────────────────────┤
│ 3-Month Trend: ↑ Improving (+2.9% OTD over 3 months)               │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 Date Range Comparison (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-COMP-4.1 | Dashboard shall allow selecting two date ranges for side-by-side comparison |
| REQ-COMP-4.2 | Each range shall show: Total Placed, Delivered, OTD%, Avg Delivery Time |
| REQ-COMP-4.3 | Comparison shall show absolute and percentage difference |
| REQ-COMP-4.4 | Visual indicator (green/red) for improvement/decline |

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Compare Periods                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ Period A: [Feb 1-15, 2026 ▼]    Period B: [Feb 16-28, 2026 ▼]      │
│                                                                      │
│ ┌───────────────────────┐    ┌───────────────────────┐             │
│ │ Period A              │    │ Period B              │             │
│ │ Feb 1-15, 2026        │    │ Feb 16-28, 2026       │             │
│ ├───────────────────────┤    ├───────────────────────┤             │
│ │ Placed:    1,523      │    │ Placed:    1,678      │             │
│ │ Delivered: 1,456      │    │ Delivered: 1,612      │             │
│ │ OTD%:      84.2%      │    │ OTD%:      87.1%      │             │
│ │ Avg Time:  3h 32m     │    │ Avg Time:  3h 18m     │             │
│ └───────────────────────┘    └───────────────────────┘             │
│                                                                      │
│ Change (B vs A):                                                     │
│ Placed:    ↑ 10.2%     Delivered: ↑ 10.7%                          │
│ OTD%:      ↑ 2.9% ✓    Avg Time:  ↓ 14m ✓                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.5 CSV Export Functionality (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-EXP-5.1 | Each data table shall have an "Export CSV" button |
| REQ-EXP-5.2 | Export shall include all visible columns plus additional metadata |
| REQ-EXP-5.3 | Filename shall include: warehouse, date range, export timestamp |
| REQ-EXP-5.4 | Export shall include calculation breakdown for transparency |

**Export Format Example:**
```csv
# Parcel Admin Dashboard Export
# Warehouse: KUWAIT
# Date Range: 2026-02-01 to 2026-02-28
# Exported: 2026-03-04 14:32:00
# 
# OTD Calculation: on_time_count / delivered_count * 100
# Avg Time Calculation: AVG(delivered_ts - order_ts) in minutes
#
day,total_placed,total_delivered,on_time,late,otd_pct,avg_delivery_mins,wa_count
2026-02-01,145,142,124,18,87.3%,218,3
2026-02-02,156,151,132,19,87.4%,225,5
...
```

---

### 3.6 Data Quality Monitoring Page (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-DQ-6.1 | System shall provide dedicated Data Quality page accessible from navigation |
| REQ-DQ-6.2 | Page shall display all data quality issues detected |
| REQ-DQ-6.3 | Issues shall be categorized by severity: Critical, Warning, Info |
| REQ-DQ-6.4 | Each issue shall show: description, count, affected records, recommendation |
| REQ-DQ-6.5 | User shall be able to view sample records for each issue |

**Data Quality Checks:**

| Check ID | Category | Description | Severity |
|----------|----------|-------------|----------|
| DQ-001 | Data Integrity | delivered_ts < order_ts (impossible timestamps) | Critical |
| DQ-002 | Missing Data | Missing zone information | Warning |
| DQ-003 | Missing Data | Missing city information | Warning |
| DQ-004 | Missing Data | Missing area information | Info |
| DQ-005 | Data Integrity | Duplicate parcel_id in same warehouse | Critical |
| DQ-006 | Configuration | Warehouse missing shift config for day | Warning |
| DQ-007 | Data Integrity | Order status mismatch (delivered_ts exists but status != Delivered) | Warning |
| DQ-008 | Missing Data | Missing collector name | Info |
| DQ-009 | Calculation | is_on_time is NULL for delivered parcel | Critical |
| DQ-010 | Data Integrity | Waiting address flagged but address is complete | Info |

**Page Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Data Quality Monitor                              Last Updated: 2m ago│
├─────────────────────────────────────────────────────────────────────┤
│ Summary: 2 Critical | 5 Warnings | 8 Info                          │
├─────────────────────────────────────────────────────────────────────┤
│ 🔴 CRITICAL ISSUES                                                   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Impossible Timestamps                                            │ │
│ │ 3 records have delivered_ts before order_ts                      │ │
│ │ Affected: KUWAIT (2), RIYADH (1)                                 │ │
│ │ [View Records] [Export List]                                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ⚠️ WARNINGS                                                          │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Missing Zone Information                                         │ │
│ │ 47 records have no zone assigned                                 │ │
│ │ Recommendation: Update zone mapping or set default               │ │
│ │ [View Records] [Export List]                                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ℹ️ INFO                                                              │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Low Volume Zones                                                 │ │
│ │ 12 zones have < 5 orders this month                              │ │
│ │ This may affect statistical significance                         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.7 Mobile Responsive Design (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-MOB-7.1 | All dashboard pages shall be fully responsive for mobile devices |
| REQ-MOB-7.2 | Tables shall convert to card layout on screens < 768px width |
| REQ-MOB-7.3 | Navigation shall collapse to hamburger menu on mobile |
| REQ-MOB-7.4 | Touch-friendly controls (larger tap targets) |
| REQ-MOB-7.5 | Charts shall stack vertically on mobile |

**Responsive Breakpoints:**
```
Desktop:  > 1024px  - Full layout with side-by-side tables
Tablet:   768-1024px - Condensed tables, stacked sections
Mobile:   < 768px   - Card layout, hamburger nav, stacked charts
```

**Mobile Card Layout:**
```
┌─────────────────────────────────┐
│ ≡ Menu              KUWAIT ▼   │
├─────────────────────────────────┤
│ 📊 Mar 4, 2026                  │
│ ┌─────────────────────────────┐ │
│ │ Total Placed: 145           │ │
│ │ Delivered: 142              │ │
│ │ On-Time: 124 (87.3%)        │ │
│ │ Avg Time: 3h 28m            │ │
│ └─────────────────────────────┘ │
│                                 │
│ 📊 Mar 3, 2026                  │
│ ┌─────────────────────────────┐ │
│ │ Total Placed: 156           │ │
│ │ Delivered: 151              │ │
│ │ On-Time: 132 (87.4%)        │ │
│ │ Avg Time: 3h 35m            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

### 3.8 Auto-Refresh (MEDIUM PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-AR-8.1 | Dashboard shall auto-refresh data every 30 seconds |
| REQ-AR-8.2 | Refresh indicator shall show "Last updated: X seconds ago" |
| REQ-AR-8.3 | User shall be able to pause/resume auto-refresh |
| REQ-AR-8.4 | Auto-refresh shall not interrupt user interactions (filters, scrolling) |
| REQ-AR-8.5 | Visual indicator during data loading |

**UI Element:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Last updated: 15 seconds ago  [⏸ Pause] [🔄 Refresh Now]          │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.9 CSV Import Validation Preview (HIGH PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-CSV-9.1 | CSV upload shall show preview before committing to database |
| REQ-CSV-9.2 | Preview shall categorize rows: Valid, Warnings, Errors |
| REQ-CSV-9.3 | User shall be able to proceed with valid rows only |
| REQ-CSV-9.4 | Detailed error messages shall explain why rows are invalid |
| REQ-CSV-9.5 | Progress indicator during large file processing |

**Preview UI:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ CSV Preview - delivery_details.csv (1,523 rows)                     │
├─────────────────────────────────────────────────────────────────────┤
│ ✅ Valid: 1,498 rows ready to import                                │
│ ⚠️ Warnings: 18 rows (can import with defaults)                     │
│ ❌ Errors: 7 rows (will be skipped)                                 │
│                                                                     │
│ ⚠️ WARNINGS (click to expand)                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Row 45: Missing zone - will default to "UNKNOWN"                │ │
│ │ Row 89: Missing city - will use zone default                    │ │
│ │ Row 156: Invalid order_status - will default to "Unknown"       │ │
│ │ ... + 15 more                                                   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ❌ ERRORS (click to expand)                                         │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Row 102: Missing parcel_id (required field) - SKIPPED           │ │
│ │ Row 234: Invalid date format "32/13/2026" - SKIPPED             │ │
│ │ Row 456: Duplicate parcel_id 12345 already exists - SKIPPED     │ │
│ │ ... + 4 more                                                    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Export Error Log] [Proceed with 1,516 rows] [Cancel]              │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.10 Performance Leaderboard (MEDIUM PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-LB-10.1 | Dashboard shall display warehouse performance leaderboard |
| REQ-LB-10.2 | Top 3 performers shall be highlighted with medals (🥇🥈🥉) |
| REQ-LB-10.3 | Bottom performers shall be flagged with warning icon |
| REQ-LB-10.4 | Threshold indicators: Green (≥90%), Yellow (80-90%), Red (<80%) |

**Leaderboard UI:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Performance Leaderboard - Week of Mar 2-8, 2026                     │
├─────────────────────────────────────────────────────────────────────┤
│ 🥇 KUWAIT    94.2% OTD  │ 3h 15m avg │ ↑ 2.1% from last week       │
│ 🥈 RIYADH   91.8% OTD  │ 3h 28m avg │ ↑ 0.5% from last week       │
│ 🥉 JEDDAH   89.5% OTD  │ 3h 42m avg │ ↓ 1.2% from last week       │
│ 4.  DAMMAM  87.2% OTD  │ 3h 55m avg │ ↑ 3.4% from last week       │
│ 5.  BAHRAIN 85.1% OTD  │ 4h 02m avg │ ↑ 1.8% from last week       │
│ 6.  UAE     82.4% OTD  │ 4h 15m avg │ ↓ 0.8% from last week       │
│ ⚠️ QATAR   78.3% OTD  │ 4h 45m avg │ ↓ 2.1% from last week       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.11 Shift Management Enhancements (MEDIUM PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-SHIFT-11.1 | System shall support shift templates (save/load presets) |
| REQ-SHIFT-11.2 | System shall provide calendar view for holiday overrides |
| REQ-SHIFT-11.3 | System shall support weekend patterns (different shifts for weekends) |
| REQ-SHIFT-11.4 | "Ramadan Mode" toggle shall auto-adjust shifts for Ramadan period |

**Shift Template Feature:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Shift Templates                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Saved Templates:                                                    │
│ • Standard Week (8am-7pm Sun-Thu, 9am-5pm Fri-Sat)                 │
│ • Ramadan Schedule (10am-5pm all days)                              │
│ • Eid Period (9am-3pm)                                              │
│                                                                     │
│ [Save Current as Template] [Apply Template: Standard Week ▼]       │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.12 API Rate Limiting (MEDIUM PRIORITY)

| Req ID | Requirement |
|--------|-------------|
| REQ-SEC-12.1 | API shall implement rate limiting: 100 requests per 15 minutes per IP |
| REQ-SEC-12.2 | Rate limit headers shall be returned (X-RateLimit-Remaining) |
| REQ-SEC-12.3 | Graceful error message when limit exceeded |
| REQ-SEC-12.4 | Internal/dashboard requests exempt from rate limiting |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Req ID | Requirement |
|--------|-------------|
| NFR-P-1.1 | Dashboard load time < 1 second for standard date range |
| NFR-P-1.2 | Data Quality page load < 2 seconds |
| NFR-P-1.3 | CSV preview generation < 5 seconds for 10,000 rows |
| NFR-P-1.4 | Auto-refresh shall not cause visible page flicker |

### 4.2 Usability

| Req ID | Requirement |
|--------|-------------|
| NFR-U-2.1 | All KPI calculations shall be visible/explainable to users |
| NFR-U-2.2 | Tooltips shall explain each metric's formula |
| NFR-U-2.3 | Data quality issues shall include remediation recommendations |

### 4.3 Compatibility

| Req ID | Requirement |
|--------|-------------|
| NFR-C-3.1 | Support Chrome, Firefox, Safari, Edge (latest 2 versions) |
| NFR-C-3.2 | Mobile support: iOS Safari, Chrome for Android |
| NFR-C-3.3 | CSV export compatible with Excel, Google Sheets |

---

## 5. Visibility & Transparency Requirements

### 5.1 Calculation Breakdown Display

| Req ID | Requirement |
|--------|-------------|
| REQ-VIS-1.1 | Each KPI shall have an "info" icon showing calculation formula |
| REQ-VIS-1.2 | Clicking KPI shall expand to show raw numbers used in calculation |
| REQ-VIS-1.3 | Dashboard shall include "How OTD is Calculated" help section |

**Tooltip Example:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ ℹ️ On-Time Delivery %                                               │
├─────────────────────────────────────────────────────────────────────┤
│ Formula: (On-Time Deliveries / Total Deliveries) × 100              │
│                                                                     │
│ This Period:                                                        │
│ On-Time: 1,024 parcels                                              │
│ Total Delivered: 1,198 parcels                                      │
│ Calculation: 1,024 ÷ 1,198 = 0.8547 × 100 = 85.5%                  │
│                                                                     │
│ Exclusions:                                                          │
│ • Orders not yet delivered (47 parcels)                             │
│ • Orders with missing delivery timestamp (0 parcels)                │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Drill-Down Capability

| Req ID | Requirement |
|--------|-------------|
| REQ-VIS-2.1 | User shall be able to click any KPI to see underlying data |
| REQ-VIS-2.2 | Drill-down path: Warehouse → Zone → City → Area → Individual parcels |
| REQ-VIS-2.3 | Each level shall show same KPI metrics recalculated for that scope |

---

## 6. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-1 | Average Delivery Time displays with trend indicators | Manual testing |
| AC-2 | Zone Performance shows top/bottom 5 zones | Manual testing |
| AC-3 | Week-over-week table correctly calculates Sunday-start weeks | Date boundary testing |
| AC-4 | Monthly toggle switches view correctly | Manual testing |
| AC-5 | Date range comparison shows correct differences | Calculation verification |
| AC-6 | CSV export includes all data with calculation notes | Export file review |
| AC-7 | Data Quality page detects all specified issues | Test with known bad data |
| AC-8 | Mobile view is fully functional | Device testing |
| AC-9 | Auto-refresh works without interrupting user | Usability testing |
| AC-10 | CSV preview catches all validation errors | Test with various invalid files |
| AC-11 | Leaderboard rankings are correct | Calculation verification |
| AC-12 | Calculation tooltips show correct formulas | Manual review |

---

## 7. User Personas

### Primary Users

| Persona | Role | Primary Needs |
|---------|------|---------------|
| **Operations Manager** | Daily operations oversight | Real-time visibility, drill-down, alerts |
| **Warehouse Supervisor** | Local warehouse management | Zone performance, collector tracking |
| **Executive** | High-level performance view | Week/month trends, comparisons |

### Usage Patterns

| User | Frequency | Device | Features Used |
|------|-----------|--------|---------------|
| Operations Manager | Multiple times daily | Desktop + Mobile | All features |
| Warehouse Supervisor | Daily | Desktop | Zone performance, collector data |
| Executive | Weekly | Desktop | Week-over-week, comparisons, exports |

---

## 8. Glossary

| Term | Definition |
|------|------------|
| OTD | On-Time Delivery - percentage of orders delivered within SLA |
| WA | Waiting Address - orders with incomplete/unclear delivery address |
| WoW | Week-over-Week - comparison between consecutive weeks |
| MoM | Month-over-Month - comparison between consecutive months |
| SLA | Service Level Agreement - maximum allowed delivery time |
| Zone | Geographic delivery area grouping |
| Leaderboard | Ranked display of warehouse performance |
