# Metric Dictionary (Enhancements-v6)

## City Performance
- **City OTD %** = `on_time_count / delivered_count * 100`
- **City Avg Delivery Time (min)** = `AVG(delivered_ts - order_ts_utc)` in minutes for valid positive durations.
- **City Late Count** = `delivered_count - on_time_count`

## Exceptions Control Tower
- **Open Exceptions** = unresolved exception rows.
- **Aging (hrs)** = `now - detected_at` for unresolved exceptions.

## Promise Reliability
- **Promise Hit Rate %** = `within_promise_window / delivered_with_promise * 100`
- **ETA Error (min)** = `actual_delivery_time - predicted_delivery_time`

## Route Efficiency
- **Parcels per Active Area** = `delivered_parcels / active_areas`
- **Efficiency Index** = configurable composite of OTD, avg time, and density.
