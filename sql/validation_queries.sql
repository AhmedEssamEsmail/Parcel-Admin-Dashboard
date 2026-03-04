-- 1. Verify no NULL is_on_time for delivered parcels
SELECT COUNT(*) AS null_count
FROM v_parcel_kpi
WHERE delivered_ts IS NOT NULL AND is_on_time IS NULL;

-- 2. Verify OTD calculation matches manual (including WA)
SELECT
  day,
  on_time_inc_wa,
  total_delivered_inc_wa,
  otd_pct_inc_wa,
  ROUND((on_time_inc_wa::NUMERIC / NULLIF(total_delivered_inc_wa, 0)) * 100, 2) AS manual_calc
FROM v_dod_summary
WHERE day = CURRENT_DATE - 1
LIMIT 5;

-- 3. Verify shift configs populated (7 days per warehouse)
SELECT w.code, COUNT(sc.day_of_week) AS configured_days
FROM warehouses w
LEFT JOIN warehouse_shift_configs sc ON sc.warehouse_id = w.id
GROUP BY w.code;

-- 4. Verify after-cutoff orders have deadline
SELECT COUNT(*) AS missing_deadline
FROM v_parcel_kpi
WHERE cutoff_status = 'After Cutoff Time' AND deadline_local IS NULL;

-- 5. Performance check (expect < 1000ms)
EXPLAIN ANALYZE
SELECT *
FROM v_dod_summary
WHERE warehouse_code = 'KUWAIT'
  AND day BETWEEN CURRENT_DATE - 45 AND CURRENT_DATE;