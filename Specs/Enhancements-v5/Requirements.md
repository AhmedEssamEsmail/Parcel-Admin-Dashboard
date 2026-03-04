# Enhancements-v5 Requirements

## Goal
Improve mobile navigation usability, fix desktop WoW/MoM UX issues, ensure chart readability, and harden raw-data pages against missing optional views.

## In Scope
1. Mobile nav drawer redesign (left side, larger actions, logout at bottom).
2. Desktop WoW/MoM toggle and grouped collapse UX fixes.
3. Dashboard refresh tooltip and chart layering fix.
4. Raw Delivery Stages fallback when timing-source view is missing.
5. Ingest-health API graceful fallback when observability objects are missing.

## Success Criteria
- Mobile drawer is left-opening and usable with large touch targets.
- Collapsed warehouse rows show totals for selected dashboard date range.
- Chart lines render in front of bars.
- Raw Delivery Stages no longer fails hard if `v_raw_delivery_stages_with_source` is missing.
- Ingest health endpoint returns safe empty payload instead of 500 when schema objects are absent.
