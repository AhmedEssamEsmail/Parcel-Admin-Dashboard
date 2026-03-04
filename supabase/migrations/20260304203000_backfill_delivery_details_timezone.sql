-- Idempotent delivery_details timezone correction.
-- Applies +3 hours only for warehouses with a median +180 minute mismatch
-- between delivered status timestamps and delivery_details.delivery_date.

with delivered_pairs as (
  select
    dd.warehouse_id,
    extract(epoch from (ps.delivered_ts - dd.delivery_date)) / 60.0 as diff_minutes
  from public.delivery_details dd
  join public.v_parcel_status_min ps
    on ps.warehouse_id = dd.warehouse_id
   and ps.parcel_id = dd.parcel_id
  where ps.delivered_ts is not null
    and dd.delivery_date is not null
),
warehouse_stats as (
  select
    warehouse_id,
    percentile_cont(0.5) within group (order by diff_minutes) as median_diff_minutes
  from delivered_pairs
  group by warehouse_id
),
target_warehouses as (
  select warehouse_id
  from warehouse_stats
  where median_diff_minutes between 179 and 181
)
update public.delivery_details dd
set
  order_date = dd.order_date + interval '3 hours',
  delivery_date = case
    when dd.delivery_date is null then null
    else dd.delivery_date + interval '3 hours'
  end
where dd.warehouse_id in (
  select warehouse_id from target_warehouses
);
