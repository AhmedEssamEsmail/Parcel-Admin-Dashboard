create or replace view public.v_route_efficiency_daily as
with base as (
  select
    warehouse_code,
    created_date_local as day,
    coalesce(nullif(btrim(city), ''), 'UNKNOWN') as city,
    coalesce(nullif(btrim(area), ''), 'UNKNOWN') as area,
    parcel_id,
    delivered_ts,
    is_on_time,
    order_ts_utc
  from public.v_parcel_kpi
)
select
  warehouse_code,
  day,
  city,
  count(distinct parcel_id) as total_orders,
  count(distinct parcel_id) filter (where delivered_ts is not null) as delivered_count,
  count(distinct parcel_id) filter (where is_on_time is true) as on_time_count,
  count(distinct area) as active_areas,
  case when count(distinct area) = 0 then null else round((count(distinct parcel_id)::numeric / count(distinct area)::numeric), 2) end as parcels_per_active_area,
  round(
    avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
      filter (where delivered_ts is not null and delivered_ts > order_ts_utc)::numeric,
    2
  ) as avg_delivery_minutes,
  case
    when count(distinct parcel_id) filter (where delivered_ts is not null) = 0 then null
    else round(
      (count(distinct parcel_id) filter (where is_on_time is true)::numeric
      / count(distinct parcel_id) filter (where delivered_ts is not null)::numeric) * 100,
      2
    )
  end as otd_pct
from base
group by warehouse_code, day, city;
