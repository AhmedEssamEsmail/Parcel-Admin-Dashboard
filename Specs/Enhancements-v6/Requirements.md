# Enhancements-v6 Requirements

## Goal
Deliver the next operations analytics wave by first fixing City Performance visibility (currently over-grouped as `UNKNOWN`), then adding new control pages for exceptions, promise reliability, and route efficiency.

## In Scope
1. City Performance fix + UX rename (Zone -> City terminology).
2. Exceptions Control Tower page (trend, aging, and actionable table).
3. Promise Reliability page (promise-window hit rate + ETA error distribution).
4. Route Efficiency page (density/efficiency metrics and drill-down).
5. Export + docs + validation coverage updates.

## Success Criteria
- City Performance page no longer collapses valid city rows into `UNKNOWN` when city data exists.
- All zone-performance user-facing text is renamed to City terminology.
- New pages/APIs return stable payloads and support core filters (warehouse/date range).
- CSV exports include newly added page datasets.
- Full verification sequence passes in required order.
