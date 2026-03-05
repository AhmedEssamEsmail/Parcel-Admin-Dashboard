-- Option D: daily rollup views with explicit ALL-warehouse rows.

create or replace view public.v_dod_summary_daily_rollup as
with per_warehouse as (
  select
    warehouse_code,
    day,
    total_placed_inc_wa,
    total_delivered_inc_wa,
    on_time_inc_wa,
    otd_pct_inc_wa,
    null_on_time_count,
    wa_count,
    total_placed_exc_wa,
    total_delivered_exc_wa,
    on_time_exc_wa,
    otd_pct_exc_wa,
    wa_delivered_count
  from public.v_dod_summary
),
all_warehouses as (
  select
    'ALL'::text as warehouse_code,
    day,
    sum(total_placed_inc_wa)::bigint as total_placed_inc_wa,
    sum(total_delivered_inc_wa)::bigint as total_delivered_inc_wa,
    sum(on_time_inc_wa)::bigint as on_time_inc_wa,
    case
      when sum(total_delivered_inc_wa) = 0 then null
      else round((sum(on_time_inc_wa)::numeric / sum(total_delivered_inc_wa)::numeric) * 100, 2)
    end as otd_pct_inc_wa,
    sum(null_on_time_count)::bigint as null_on_time_count,
    sum(wa_count)::bigint as wa_count,
    sum(total_placed_exc_wa)::bigint as total_placed_exc_wa,
    sum(total_delivered_exc_wa)::bigint as total_delivered_exc_wa,
    sum(on_time_exc_wa)::bigint as on_time_exc_wa,
    case
      when sum(total_delivered_exc_wa) = 0 then null
      else round((sum(on_time_exc_wa)::numeric / sum(total_delivered_exc_wa)::numeric) * 100, 2)
    end as otd_pct_exc_wa,
    sum(wa_delivered_count)::bigint as wa_delivered_count
  from public.v_dod_summary
  group by day
)
select * from per_warehouse
union all
select * from all_warehouses;

create or replace view public.v_avg_delivery_time_daily_rollup as
with base as (
  select
    warehouse_code,
    created_date_local as day,
    extract(epoch from (delivered_ts - order_ts_utc)) / 60.0 as delivery_minutes
  from public.v_parcel_kpi
  where delivered_ts is not null
    and delivered_ts > order_ts_utc
)
select
  case
    when grouping(warehouse_code) = 1 then 'ALL'::text
    else warehouse_code
  end as warehouse_code,
  day,
  count(*)::bigint as delivered_count,
  round(avg(delivery_minutes)::numeric, 0) as avg_minutes,
  round(
    percentile_cont(0.5) within group (order by delivery_minutes)::numeric,
    0
  ) as median_minutes,
  round(min(delivery_minutes)::numeric, 0) as min_minutes,
  round(max(delivery_minutes)::numeric, 0) as max_minutes
from base
group by grouping sets ((warehouse_code, day), (day));

create or replace view public.v_route_efficiency_daily_rollup as
with base as (
  select
    warehouse_id,
    warehouse_code,
    created_date_local as day,
    (warehouse_id::text || ':' || parcel_id::text) as parcel_key,
    (warehouse_id::text || ':' || coalesce(nullif(btrim(area), ''), 'UNKNOWN')) as area_key,
    delivered_ts,
    is_on_time,
    order_ts_utc
  from public.v_parcel_kpi
),
per_warehouse as (
  select
    warehouse_code,
    day,
    count(distinct parcel_key)::bigint as total_orders,
    count(distinct parcel_key) filter (where delivered_ts is not null)::bigint as delivered_count,
    count(distinct parcel_key) filter (where is_on_time is true)::bigint as on_time_count,
    count(distinct area_key)::bigint as active_areas,
    case
      when count(distinct area_key) = 0 then null
      else round(
        (count(distinct parcel_key)::numeric / count(distinct area_key)::numeric),
        2
      )
    end as parcels_per_active_area,
    round(
      avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
        filter (where delivered_ts is not null and delivered_ts > order_ts_utc)::numeric,
      2
    ) as avg_delivery_minutes,
    case
      when count(distinct parcel_key) filter (where delivered_ts is not null) = 0 then null
      else round(
        (
          count(distinct parcel_key) filter (where is_on_time is true)::numeric
          / count(distinct parcel_key) filter (where delivered_ts is not null)::numeric
        ) * 100,
        2
      )
    end as otd_pct
  from base
  group by warehouse_code, day
),
all_warehouses as (
  select
    'ALL'::text as warehouse_code,
    day,
    count(distinct parcel_key)::bigint as total_orders,
    count(distinct parcel_key) filter (where delivered_ts is not null)::bigint as delivered_count,
    count(distinct parcel_key) filter (where is_on_time is true)::bigint as on_time_count,
    count(distinct area_key)::bigint as active_areas,
    case
      when count(distinct area_key) = 0 then null
      else round(
        (count(distinct parcel_key)::numeric / count(distinct area_key)::numeric),
        2
      )
    end as parcels_per_active_area,
    round(
      avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
        filter (where delivered_ts is not null and delivered_ts > order_ts_utc)::numeric,
      2
    ) as avg_delivery_minutes,
    case
      when count(distinct parcel_key) filter (where delivered_ts is not null) = 0 then null
      else round(
        (
          count(distinct parcel_key) filter (where is_on_time is true)::numeric
          / count(distinct parcel_key) filter (where delivered_ts is not null)::numeric
        ) * 100,
        2
      )
    end as otd_pct
  from base
  group by day
)
select * from per_warehouse
union all
select * from all_warehouses;

create or replace view public.v_promise_reliability_daily_rollup as
with base as (
  select
    warehouse_code,
    created_date_local as day,
    (warehouse_id::text || ':' || parcel_id::text) as parcel_key,
    delivered_ts,
    deadline_local,
    delivered_local,
    extract(epoch from (delivered_local - deadline_local)) / 60.0 as eta_error_minutes
  from public.v_parcel_kpi
),
per_warehouse as (
  select
    warehouse_code,
    day,
    count(distinct parcel_key)::bigint as total_orders,
    count(distinct parcel_key) filter (where delivered_ts is not null and deadline_local is not null)::bigint as delivered_with_promise,
    count(distinct parcel_key) filter (
      where delivered_ts is not null
        and deadline_local is not null
        and delivered_local <= deadline_local
    )::bigint as within_promise_window,
    case
      when count(distinct parcel_key) filter (where delivered_ts is not null and deadline_local is not null) = 0 then null
      else round(
        (
          count(distinct parcel_key) filter (
            where delivered_ts is not null
              and deadline_local is not null
              and delivered_local <= deadline_local
          )::numeric
          / count(distinct parcel_key) filter (
            where delivered_ts is not null and deadline_local is not null
          )::numeric
        ) * 100,
        2
      )
    end as promise_hit_rate,
    round(
      avg(eta_error_minutes)
        filter (where delivered_ts is not null and deadline_local is not null)::numeric,
      2
    ) as avg_eta_error_minutes
  from base
  group by warehouse_code, day
),
all_warehouses as (
  select
    'ALL'::text as warehouse_code,
    day,
    count(distinct parcel_key)::bigint as total_orders,
    count(distinct parcel_key) filter (where delivered_ts is not null and deadline_local is not null)::bigint as delivered_with_promise,
    count(distinct parcel_key) filter (
      where delivered_ts is not null
        and deadline_local is not null
        and delivered_local <= deadline_local
    )::bigint as within_promise_window,
    case
      when count(distinct parcel_key) filter (where delivered_ts is not null and deadline_local is not null) = 0 then null
      else round(
        (
          count(distinct parcel_key) filter (
            where delivered_ts is not null
              and deadline_local is not null
              and delivered_local <= deadline_local
          )::numeric
          / count(distinct parcel_key) filter (
            where delivered_ts is not null and deadline_local is not null
          )::numeric
        ) * 100,
        2
      )
    end as promise_hit_rate,
    round(
      avg(eta_error_minutes)
        filter (where delivered_ts is not null and deadline_local is not null)::numeric,
      2
    ) as avg_eta_error_minutes
  from base
  group by day
)
select * from per_warehouse
union all
select * from all_warehouses;

alter view public.v_dod_summary_daily_rollup set (security_invoker = true);
alter view public.v_avg_delivery_time_daily_rollup set (security_invoker = true);
alter view public.v_route_efficiency_daily_rollup set (security_invoker = true);
alter view public.v_promise_reliability_daily_rollup set (security_invoker = true);
