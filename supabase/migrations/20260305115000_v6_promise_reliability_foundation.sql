create or replace view public.v_promise_reliability_daily as
with base as (
  select
    warehouse_code,
    created_date_local as day,
    coalesce(nullif(btrim(city), ''), 'UNKNOWN') as city,
    parcel_id,
    delivered_ts,
    deadline_local,
    order_ts_utc,
    delivered_local
  from public.v_parcel_kpi
)
select
  warehouse_code,
  day,
  city,
  count(distinct parcel_id) as total_orders,
  count(distinct parcel_id) filter (where delivered_ts is not null and deadline_local is not null) as delivered_with_promise,
  count(distinct parcel_id) filter (
    where delivered_ts is not null
      and deadline_local is not null
      and delivered_local <= deadline_local
  ) as within_promise_window,
  case
    when count(distinct parcel_id) filter (where delivered_ts is not null and deadline_local is not null) = 0 then null
    else round(
      (
        count(distinct parcel_id) filter (
          where delivered_ts is not null and deadline_local is not null and delivered_local <= deadline_local
        )::numeric
        / count(distinct parcel_id) filter (where delivered_ts is not null and deadline_local is not null)::numeric
      ) * 100,
      2
    )
  end as promise_hit_rate,
  round(
    avg(extract(epoch from (delivered_local - deadline_local)) / 60)
      filter (where delivered_ts is not null and deadline_local is not null)::numeric,
    2
  ) as avg_eta_error_minutes
from base
group by warehouse_code, day, city;
