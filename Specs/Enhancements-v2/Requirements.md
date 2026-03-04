# Requirements Specification - Enhancements v2
## Parcel Admin Dashboard - SLA, Layout, and Refresh Improvements

**Project:** Parcel Admin Dashboard  
**Date:** March 2026  
**Version:** Enhancements v2

---

## 1. Executive Summary

This enhancement set introduces warehouse→city SLA configurations, bulk import/export for SLA management, dashboard section reordering, a slower auto-refresh cadence, and wider layout spacing across all pages. The goal is to reflect city-specific delivery expectations, improve operational control at scale, and optimize dashboard readability.

---

## 2. Scope

### 2.1 In Scope

| Category | Items |
|----------|-------|
| **SLA Management** | Warehouse → City SLA configuration, fallback to warehouse defaults |
| **Bulk Operations** | SLA CSV import/export (city-level) |
| **Dashboard Layout** | Section reorder (chart + WoW + compare + leaderboard above OTD sections) |
| **Auto Refresh** | Refresh every 2 hours, remove pause button, keep manual refresh |
| **UI Layout** | Wider cards/sections across all pages |

### 2.2 Out of Scope

- Changes to authentication flow
- Changes to warehouse definitions beyond SLA configuration
- SLA changes to existing historical data (recalculation handled by regular data refresh)

---

## 3. Functional Requirements

### 3.1 Warehouse → City SLA Configuration

| Req ID | Requirement |
|--------|-------------|
| REQ-SLA-1.1 | System shall allow SLA configuration per city within a warehouse |
| REQ-SLA-1.2 | SLA configuration shall fall back to warehouse default SLA if no city override exists |
| REQ-SLA-1.3 | SLA config must be editable via Settings UI |
| REQ-SLA-1.4 | SLA values must be integer minutes between 1 and 1440 |

### 3.2 SLA Bulk Import/Export

| Req ID | Requirement |
|--------|-------------|
| REQ-SLA-2.1 | System shall export city SLA configurations to CSV |
| REQ-SLA-2.2 | Export file shall include: warehouse_code, city, sla_minutes |
| REQ-SLA-2.3 | System shall import city SLA configurations from CSV |
| REQ-SLA-2.4 | Import must validate warehouse codes, city names, and SLA ranges |
| REQ-SLA-2.5 | Import shall upsert rows (insert new, update existing) |
| REQ-SLA-2.6 | Import shall return row-level validation errors |

### 3.3 Dashboard Section Order

| Req ID | Requirement |
|--------|-------------|
| REQ-UI-3.1 | On-Time Performance chart shall be displayed above OTD tables |
| REQ-UI-3.2 | Week-over-Week Performance (including WA orders) shall appear above OTD sections |
| REQ-UI-3.3 | Compare Periods widget shall appear above OTD sections |
| REQ-UI-3.4 | Performance Leaderboard shall appear above OTD sections |
| REQ-UI-3.5 | OTD Including WA and OTD Excluding WA sections shall appear last |

### 3.4 Auto-Refresh Behavior

| Req ID | Requirement |
|--------|-------------|
| REQ-AR-4.1 | Dashboard shall auto-refresh every 2 hours |
| REQ-AR-4.2 | Pause/resume control shall be removed |
| REQ-AR-4.3 | Manual refresh button shall remain available |
| REQ-AR-4.4 | Last updated indicator shall continue to display |

### 3.5 Layout Widening

| Req ID | Requirement |
|--------|-------------|
| REQ-LAYOUT-5.1 | Page sections/cards shall use wider viewport constraints |
| REQ-LAYOUT-5.2 | Layout should minimize large blank margins on widescreens |
| REQ-LAYOUT-5.3 | Tablet/mobile breakpoints must remain functional |

---

## 4. Non-Functional Requirements

| Req ID | Requirement |
|--------|-------------|
| NFR-1 | All changes must preserve backward compatibility in API responses |
| NFR-2 | Import/export must complete within 5 seconds for 2,000 rows |
| NFR-3 | SLA fallback logic must not add >200ms to KPI query time |
| NFR-4 | UI changes must pass existing responsive breakpoints |

---

## 5. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-1 | City-specific SLA applies in KPI calculations | SQL query validation |
| AC-2 | Warehouse SLA remains fallback when no city row exists | SQL query validation |
| AC-3 | SLA CSV export produces correct header + rows | Manual export review |
| AC-4 | SLA CSV import upserts data and reports errors | Manual import test |
| AC-5 | Dashboard sections appear in required order | UI review |
| AC-6 | Auto-refresh triggers every 2 hours, pause removed | Manual UI verification |
| AC-7 | Layout uses wider width on desktop | UI review |
| AC-8 | All checks pass: build/validate/tests/type-check/lint | CLI verification |
