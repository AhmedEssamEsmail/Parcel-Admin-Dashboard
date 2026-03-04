-- Idempotent repair for delivery_details timestamp offset.
-- Applies +3 hours only for warehouses whose median delivered timestamp mismatch
-- (parcel_logs Delivered - delivery_details.delivery_date) is in [179, 181] minutes.

begin;

-- Snapshot mismatches before update.
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
    count(*) as pair_count,
    percentile_cont(0.5) within group (order by diff_minutes) as median_diff_minutes
  from delivered_pairs
  group by warehouse_id
)
select
  w.code as warehouse_code,
  ws.pair_count,
  ws.median_diff_minutes
from warehouse_stats ws
join public.warehouses w on w.id = ws.warehouse_id
order by w.code;

create temp table tmp_dd_timezone_candidates on commit drop as
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
    count(*) as pair_count,
    percentile_cont(0.5) within group (order by diff_minutes) as median_diff_minutes
  from delivered_pairs
  group by warehouse_id
)
select
  warehouse_id,
  pair_count,
  median_diff_minutes
from warehouse_stats
where median_diff_minutes between 179 and 181;

-- Apply correction only to detected candidate warehouses.
with updated as (
  update public.delivery_details dd
  set
    order_date = dd.order_date + interval '3 hours',
    delivery_date = case
      when dd.delivery_date is null then null
      else dd.delivery_date + interval '3 hours'
    end
  where dd.warehouse_id in (
    select warehouse_id from tmp_dd_timezone_candidates
  )
  returning dd.warehouse_id
)
select
  w.code as warehouse_code,
  count(*) as shifted_rows
from updated u
join public.warehouses w on w.id = u.warehouse_id
group by w.code
order by w.code;

-- Post-update mismatch report for candidate warehouses.
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
    and dd.warehouse_id in (
      select warehouse_id from tmp_dd_timezone_candidates
    )
),
warehouse_stats as (
  select
    warehouse_id,
    count(*) as pair_count,
    percentile_cont(0.5) within group (order by diff_minutes) as median_diff_minutes
  from delivered_pairs
  group by warehouse_id
)
select
  w.code as warehouse_code,
  ws.pair_count,
  ws.median_diff_minutes
from warehouse_stats ws
join public.warehouses w on w.id = ws.warehouse_id
order by w.code;

commit;
