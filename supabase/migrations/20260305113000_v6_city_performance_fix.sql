create or replace view public.v_city_performance as
with normalized as (
  select
    k.warehouse_code,
    case
      when k.city is null then null
      when btrim(k.city) = '' then null
      when lower(btrim(k.city)) in ('unknown', 'n/a', 'na', '-') then null
      else btrim(k.city)
    end as city_name,
    case
      when k.zone is null then null
      when btrim(k.zone) = '' then null
      when lower(btrim(k.zone)) in ('unknown', 'n/a', 'na', '-') then null
      else btrim(k.zone)
    end as zone_name,
    nullif(btrim(coalesce(k.area, '')), '') as area_name,
    k.created_date_local as day,
    k.parcel_id,
    k.delivered_ts,
    k.is_on_time,
    k.order_ts_utc
  from public.v_parcel_kpi k
), aggregated as (
  select
    warehouse_code,
    coalesce(city_name, zone_name, 'UNKNOWN') as city,
    coalesce(zone_name, 'UNKNOWN') as zone,
    area_name as area,
    day,
    count(distinct parcel_id) as total_orders,
    count(distinct parcel_id) filter (where delivered_ts is not null) as delivered_count,
    count(distinct parcel_id) filter (where is_on_time is true) as on_time_count,
    round(
      avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
        filter (where delivered_ts is not null and delivered_ts > order_ts_utc)::numeric,
      0
    ) as avg_delivery_minutes
  from normalized
  group by warehouse_code, coalesce(city_name, zone_name, 'UNKNOWN'), coalesce(zone_name, 'UNKNOWN'), area_name, day
)
select
  warehouse_code,
  zone,
  city,
  area,
  day,
  total_orders,
  delivered_count,
  on_time_count,
  case
    when delivered_count = 0 then null
    else round((on_time_count::numeric / delivered_count::numeric) * 100, 2)
  end as otd_pct,
  avg_delivery_minutes,
  case when total_orders < 5 then 'LOW_VOLUME' else 'NORMAL' end as volume_status
from aggregated;

create or replace view public.v_zone_performance as
select
  warehouse_code,
  coalesce(nullif(zone, 'UNKNOWN'), city, 'UNKNOWN') as zone,
  city,
  area,
  day,
  total_orders,
  delivered_count,
  on_time_count,
  otd_pct,
  avg_delivery_minutes,
  volume_status
from public.v_city_performance;
