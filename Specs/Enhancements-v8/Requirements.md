# Enhancements-v8.0 Requirements (v7.1 UI/Format Polish)

## Scope
This spec documents the implemented v7.1 polish plan under Enhancements-v8.0 for traceability.

## Functional Requirements
1. Date display format for analytics table/chart date fields shall be `MMM-DD`.
2. Week-over-Week / Month-over-Month period labels shall render in `MMM-DD`.
3. Dashboard On-Time chart height shall increase by 25% (chart-only scope).
4. On-Time chart legend swatches for line datasets shall render as solid color boxes.
5. On-Time % line shall use medium gray instead of black.
6. Compare Periods "Change (B vs A)" section shall render as a card and align with Period A/B cards.
7. WoW table shall provide global Expand All / Collapse All control in grouped mode.
8. Delivery Minutes Trend shall display values as `HH:MM` in axis and tooltip.
9. Route Efficiency table Avg Minutes shall display as `HH:MM`.
10. Raw Delivery Stages datetime-like values shall display as `MMM-DD HH:MM:SS` and date-only values as `MMM-DD`.

## Non-Functional / Constraints
- No backend API contract changes.
- No database schema/migration changes.
- Frontend-only formatting/rendering updates.
