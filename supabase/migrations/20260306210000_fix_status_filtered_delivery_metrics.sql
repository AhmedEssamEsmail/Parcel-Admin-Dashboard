create or replace view public.v_parcel_base as
select
  dd.warehouse_id,
  w.code as warehouse_code,
  w.tz,
  w.sla_minutes,
  w.default_shift_start,
  w.default_shift_end,
  dd.parcel_id,
  dd.order_id,
  dd.order_status,
  dd.order_date as order_ts_utc,
  (dd.order_date at time zone w.tz) as order_local,
  dd.delivery_address,
  (
    coalesce(dd.delivery_address, '') ilike '%extra info: wa%'
    or coalesce(dd.delivery_address, '') ilike '%extra: wa%'
    or exists (
      select 1
      from public.wa_orders wao
      where wao.warehouse_id = dd.warehouse_id
        and wao.parcel_id = dd.parcel_id
    )
  ) as waiting_address,
  dd.zone,
  dd.city,
  dd.area,
  ps.collecting_ts,
  ps.ready_for_preparing_ts,
  ps.prepare_ts,
  ps.ready_for_delivery_ts,
  ps.on_the_way_ts,
  ps.delivered_ts,
  (ps.delivered_ts at time zone w.tz) as delivered_local,
  (dd.order_date at time zone w.tz)::date as created_date_local,
  coalesce(csc.sla_minutes, w.sla_minutes) as effective_sla_minutes,
  lower(btrim(coalesce(dd.order_status, ''))) as normalized_order_status,
  case
    when lower(btrim(coalesce(dd.order_status, ''))) in ('expired', 'cancelled', 'system cancelled', 'pending payment') then false
    else true
  end as is_countable_order,
  lower(btrim(coalesce(dd.order_status, ''))) = 'delivered' as is_delivered_status,
  dd.delivery_date as delivery_date_utc,
  (dd.delivery_date at time zone w.tz) as delivery_date_local_ts,
  (dd.delivery_date at time zone w.tz)::date as delivery_date_local
from public.delivery_details dd
join public.warehouses w on w.id = dd.warehouse_id
left join public.warehouse_city_sla_configs csc
  on csc.warehouse_id = dd.warehouse_id
 and csc.city_normalized = lower(btrim(coalesce(dd.city, '')))
left join public.v_parcel_status_min ps
  on ps.warehouse_id = dd.warehouse_id
 and ps.parcel_id = dd.parcel_id;

create or replace view public.v_parcel_kpi as
with eff as (
  select
    b.*,
    (public.effective_shift_window(b.warehouse_id, b.created_date_local)).shift_start as shift_start,
    (public.effective_shift_window(b.warehouse_id, b.created_date_local)).shift_end as shift_end,
    (public.effective_shift_window(b.warehouse_id, (b.created_date_local + 1))).shift_start as next_shift_start
  from public.v_parcel_base b
)
select
  warehouse_id,
  warehouse_code,
  tz,
  sla_minutes,
  default_shift_start,
  default_shift_end,
  parcel_id,
  order_id,
  order_status,
  order_ts_utc,
  order_local,
  delivery_address,
  waiting_address,
  zone,
  city,
  area,
  collecting_ts,
  ready_for_preparing_ts,
  prepare_ts,
  ready_for_delivery_ts,
  on_the_way_ts,
  delivered_ts,
  delivered_local,
  created_date_local,
  effective_sla_minutes,
  shift_start,
  shift_end,
  next_shift_start,
  case
    when shift_start is null or shift_end is null then 'Unknown'
    when order_local::time < shift_start then 'Before Shift'
    when order_local::time > shift_end then 'After Cutoff Time'
    else 'Normal'
  end as cutoff_status,
  case
    when shift_start is null or shift_end is null then null::timestamp
    when order_local::time < shift_start
      then (created_date_local + shift_start) + make_interval(mins => effective_sla_minutes)
    when order_local::time > shift_end and next_shift_start is not null
      then ((created_date_local + 1) + next_shift_start) + make_interval(mins => effective_sla_minutes)
    when order_local::time > shift_end and next_shift_start is null
      then ((created_date_local + 1) + coalesce(default_shift_start, shift_start))
        + make_interval(mins => effective_sla_minutes)
    else order_local + make_interval(mins => effective_sla_minutes)
  end as deadline_local,
  case
    when delivered_ts is null then null
    when shift_start is null or shift_end is null then null
    when order_local::time > shift_end then
      case
        when next_shift_start is not null then
          delivered_local <= ((created_date_local + 1) + next_shift_start) + make_interval(mins => effective_sla_minutes)
        else
          delivered_local <= ((created_date_local + 1) + coalesce(default_shift_start, shift_start)) + make_interval(mins => effective_sla_minutes)
      end
    when delivered_local <= (
      case
        when order_local::time < shift_start
          then (created_date_local + shift_start) + make_interval(mins => effective_sla_minutes)
        else order_local + make_interval(mins => effective_sla_minutes)
      end
    ) then true else false
  end as is_on_time,
  normalized_order_status,
  is_countable_order,
  is_delivered_status,
  delivery_date_utc,
  delivery_date_local_ts,
  delivery_date_local
from eff;

create or replace view public.v_dod_summary as
with base_data as (
  select
    warehouse_code,
    created_date_local,
    delivery_date_local,
    parcel_id,
    is_on_time,
    waiting_address,
    is_countable_order,
    is_delivered_status
  from public.v_parcel_kpi
), placed as (
  select
    warehouse_code,
    created_date_local as day,
    count(distinct parcel_id) filter (where is_countable_order) as total_placed_inc_wa,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as total_delivered_inc_wa,
    count(distinct parcel_id) filter (where is_countable_order and is_on_time is true) as on_time_inc_wa,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status and is_on_time is null) as null_on_time_count,
    count(distinct parcel_id) filter (where is_countable_order and waiting_address) as wa_count,
    count(distinct parcel_id) filter (where is_countable_order and (not waiting_address or waiting_address is null)) as total_placed_exc_wa,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status and (not waiting_address or waiting_address is null)) as total_delivered_exc_wa,
    count(distinct parcel_id) filter (where is_countable_order and is_on_time is true and (not waiting_address or waiting_address is null)) as on_time_exc_wa,
    count(distinct parcel_id) filter (where is_countable_order and waiting_address and is_delivered_status) as wa_delivered_count
  from base_data
  group by warehouse_code, created_date_local
), delivered as (
  select
    warehouse_code,
    delivery_date_local as day,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as total_delivered_inc_wa_delivery_date,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status and (not waiting_address or waiting_address is null)) as total_delivered_exc_wa_delivery_date
  from base_data
  where delivery_date_local is not null
  group by warehouse_code, delivery_date_local
)
select
  coalesce(p.warehouse_code, d.warehouse_code) as warehouse_code,
  coalesce(p.day, d.day) as day,
  coalesce(p.total_placed_inc_wa, 0)::bigint as total_placed_inc_wa,
  coalesce(p.total_delivered_inc_wa, 0)::bigint as total_delivered_inc_wa,
  coalesce(p.on_time_inc_wa, 0)::bigint as on_time_inc_wa,
  case
    when coalesce(p.total_delivered_inc_wa, 0) = 0 then null
    else round((coalesce(p.on_time_inc_wa, 0)::numeric / p.total_delivered_inc_wa::numeric) * 100, 2)
  end as otd_pct_inc_wa,
  coalesce(p.null_on_time_count, 0)::bigint as null_on_time_count,
  coalesce(p.wa_count, 0)::bigint as wa_count,
  coalesce(p.total_placed_exc_wa, 0)::bigint as total_placed_exc_wa,
  coalesce(p.total_delivered_exc_wa, 0)::bigint as total_delivered_exc_wa,
  coalesce(p.on_time_exc_wa, 0)::bigint as on_time_exc_wa,
  case
    when coalesce(p.total_delivered_exc_wa, 0) = 0 then null
    else round((coalesce(p.on_time_exc_wa, 0)::numeric / p.total_delivered_exc_wa::numeric) * 100, 2)
  end as otd_pct_exc_wa,
  coalesce(p.wa_delivered_count, 0)::bigint as wa_delivered_count,
  coalesce(d.total_delivered_inc_wa_delivery_date, 0)::bigint as total_delivered_inc_wa_delivery_date,
  coalesce(d.total_delivered_exc_wa_delivery_date, 0)::bigint as total_delivered_exc_wa_delivery_date
from placed p
full outer join delivered d
  on d.warehouse_code = p.warehouse_code
 and d.day = p.day
order by warehouse_code, day;

drop function if exists public.get_wow_summary_fast(text, text, int);

create or replace view public.v_wow_summary as
with base as (
  select
    warehouse_code,
    created_date_local,
    delivery_date_local,
    parcel_id,
    is_countable_order,
    is_delivered_status,
    is_on_time,
    waiting_address,
    order_ts_utc,
    delivered_ts
  from public.v_parcel_kpi
), placed as (
  select
    warehouse_code,
    (created_date_local - (extract(dow from created_date_local)::int))::date as week_start,
    count(distinct parcel_id) filter (where is_countable_order) as total_placed,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as total_delivered,
    count(distinct parcel_id) filter (where is_countable_order and is_on_time is true) as on_time,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status and (is_on_time is false or is_on_time is null)) as late,
    count(distinct parcel_id) filter (where is_countable_order and waiting_address is true) as wa_count,
    count(distinct parcel_id) filter (where is_countable_order and waiting_address is true and is_delivered_status) as wa_delivered_count,
    round(
      (
        avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
          filter (where is_countable_order and is_delivered_status and delivered_ts is not null)
      )::numeric,
      0
    ) as avg_delivery_minutes
  from base
  group by warehouse_code, (created_date_local - (extract(dow from created_date_local)::int))::date
), delivered as (
  select
    warehouse_code,
    (delivery_date_local - (extract(dow from delivery_date_local)::int))::date as week_start,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as total_delivered_delivery_date
  from base
  where delivery_date_local is not null
  group by warehouse_code, (delivery_date_local - (extract(dow from delivery_date_local)::int))::date
)
select
  coalesce(p.warehouse_code, d.warehouse_code) as warehouse_code,
  coalesce(p.week_start, d.week_start) as week_start,
  coalesce(p.week_start, d.week_start) + 6 as week_end,
  to_char(coalesce(p.week_start, d.week_start), 'Mon DD') || ' - ' || to_char(coalesce(p.week_start, d.week_start) + 6, 'Mon DD, YYYY') as week_label,
  coalesce(p.total_placed, 0)::bigint as total_placed,
  coalesce(p.total_delivered, 0)::bigint as total_delivered,
  coalesce(p.on_time, 0)::bigint as on_time,
  coalesce(p.wa_count, 0)::bigint as wa_count,
  coalesce(p.avg_delivery_minutes, null) as avg_delivery_minutes,
  case
    when coalesce(p.total_delivered, 0) = 0 then null
    else round((coalesce(p.on_time, 0)::numeric / p.total_delivered::numeric) * 100, 2)
  end as otd_pct,
  'week'::text as period_type,
  coalesce(p.late, 0)::bigint as late,
  coalesce(p.wa_delivered_count, 0)::bigint as wa_delivered_count,
  coalesce(d.total_delivered_delivery_date, 0)::bigint as total_delivered_delivery_date
from placed p
full outer join delivered d
  on d.warehouse_code = p.warehouse_code
 and d.week_start = p.week_start
order by warehouse_code, week_start desc;

create or replace view public.v_mom_summary as
with base as (
  select
    warehouse_code,
    created_date_local,
    delivery_date_local,
    parcel_id,
    is_countable_order,
    is_delivered_status,
    is_on_time,
    waiting_address,
    order_ts_utc,
    delivered_ts
  from public.v_parcel_kpi
), placed as (
  select
    warehouse_code,
    date_trunc('month', created_date_local)::date as month_start,
    count(distinct parcel_id) filter (where is_countable_order) as total_placed,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as total_delivered,
    count(distinct parcel_id) filter (where is_countable_order and is_on_time is true) as on_time,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status and (is_on_time is false or is_on_time is null)) as late,
    count(distinct parcel_id) filter (where is_countable_order and waiting_address is true) as wa_count,
    count(distinct parcel_id) filter (where is_countable_order and waiting_address is true and is_delivered_status) as wa_delivered_count,
    round(
      (
        avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
          filter (where is_countable_order and is_delivered_status and delivered_ts is not null)
      )::numeric,
      0
    ) as avg_delivery_minutes
  from base
  group by warehouse_code, date_trunc('month', created_date_local)::date
), delivered as (
  select
    warehouse_code,
    date_trunc('month', delivery_date_local)::date as month_start,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as total_delivered_delivery_date
  from base
  where delivery_date_local is not null
  group by warehouse_code, date_trunc('month', delivery_date_local)::date
)
select
  coalesce(p.warehouse_code, d.warehouse_code) as warehouse_code,
  coalesce(p.month_start, d.month_start) as month_start,
  (coalesce(p.month_start, d.month_start) + interval '1 month - 1 day')::date as month_end,
  to_char(coalesce(p.month_start, d.month_start), 'Month YYYY') as month_label,
  coalesce(p.total_placed, 0)::bigint as total_placed,
  coalesce(p.total_delivered, 0)::bigint as total_delivered,
  coalesce(p.on_time, 0)::bigint as on_time,
  coalesce(p.wa_count, 0)::bigint as wa_count,
  coalesce(p.avg_delivery_minutes, null) as avg_delivery_minutes,
  case
    when coalesce(p.total_delivered, 0) = 0 then null
    else round((coalesce(p.on_time, 0)::numeric / p.total_delivered::numeric) * 100, 2)
  end as otd_pct,
  'month'::text as period_type,
  coalesce(p.late, 0)::bigint as late,
  coalesce(p.wa_delivered_count, 0)::bigint as wa_delivered_count,
  coalesce(d.total_delivered_delivery_date, 0)::bigint as total_delivered_delivery_date
from placed p
full outer join delivered d
  on d.warehouse_code = p.warehouse_code
 and d.month_start = p.month_start
order by warehouse_code, month_start desc;

create or replace function public.get_wow_summary_fast(
  p_warehouse_code text,
  p_period_type text default 'week',
  p_limit int default 6
)
returns table(
  warehouse_code text,
  period_start date,
  period_label text,
  total_placed bigint,
  total_delivered bigint,
  total_delivered_delivery_date bigint,
  on_time bigint,
  late bigint,
  wa_count bigint,
  wa_delivered_count bigint,
  avg_delivery_minutes numeric,
  otd_pct numeric
)
language sql
stable
as $$
  select
    s.warehouse_code,
    case when lower(coalesce(p_period_type, 'week')) = 'month' then s.month_start else s.week_start end as period_start,
    case when lower(coalesce(p_period_type, 'week')) = 'month' then s.month_label else s.week_label end as period_label,
    s.total_placed,
    s.total_delivered,
    s.total_delivered_delivery_date,
    s.on_time,
    s.late,
    s.wa_count,
    s.wa_delivered_count,
    s.avg_delivery_minutes,
    s.otd_pct
  from (
    select warehouse_code, week_start, null::date as month_start, week_label, null::text as month_label, total_placed, total_delivered, total_delivered_delivery_date, on_time, late, wa_count, wa_delivered_count, avg_delivery_minutes, otd_pct
    from public.v_wow_summary
    where lower(coalesce(p_period_type, 'week')) <> 'month'
    union all
    select warehouse_code, null::date as week_start, month_start, null::text as week_label, month_label, total_placed, total_delivered, total_delivered_delivery_date, on_time, late, wa_count, wa_delivered_count, avg_delivery_minutes, otd_pct
    from public.v_mom_summary
    where lower(coalesce(p_period_type, 'week')) = 'month'
  ) s
  where (
    p_warehouse_code is null
    or upper(trim(p_warehouse_code)) = 'ALL'
    or s.warehouse_code = upper(trim(p_warehouse_code))
  )
  order by s.warehouse_code asc, period_start desc
  limit greatest(coalesce(p_limit, 6), 1) * case when upper(trim(coalesce(p_warehouse_code, 'ALL'))) = 'ALL' then 20 else 1 end;
$$;

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
    k.created_date_local,
    k.delivery_date_local,
    k.parcel_id,
    k.is_countable_order,
    k.is_delivered_status,
    k.is_on_time,
    k.order_ts_utc,
    k.delivered_ts
  from public.v_parcel_kpi k
), placed as (
  select
    warehouse_code,
    coalesce(city_name, zone_name, 'UNKNOWN') as city,
    coalesce(zone_name, 'UNKNOWN') as zone,
    area_name as area,
    created_date_local as day,
    count(distinct parcel_id) filter (where is_countable_order) as total_orders,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as delivered_count,
    count(distinct parcel_id) filter (where is_countable_order and is_on_time is true) as on_time_count,
    round(
      (
        avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
          filter (where is_countable_order and is_delivered_status and delivered_ts is not null and delivered_ts > order_ts_utc)
      )::numeric,
      0
    ) as avg_delivery_minutes
  from normalized
  group by warehouse_code, coalesce(city_name, zone_name, 'UNKNOWN'), coalesce(zone_name, 'UNKNOWN'), area_name, created_date_local
), delivered as (
  select
    warehouse_code,
    coalesce(city_name, zone_name, 'UNKNOWN') as city,
    coalesce(zone_name, 'UNKNOWN') as zone,
    area_name as area,
    delivery_date_local as day,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as delivered_count_delivery_date
  from normalized
  where delivery_date_local is not null
  group by warehouse_code, coalesce(city_name, zone_name, 'UNKNOWN'), coalesce(zone_name, 'UNKNOWN'), area_name, delivery_date_local
)
select
  coalesce(p.warehouse_code, d.warehouse_code) as warehouse_code,
  coalesce(p.zone, d.zone) as zone,
  coalesce(p.city, d.city) as city,
  coalesce(p.area, d.area) as area,
  coalesce(p.day, d.day) as day,
  coalesce(p.total_orders, 0)::bigint as total_orders,
  coalesce(p.delivered_count, 0)::bigint as delivered_count,
  coalesce(p.on_time_count, 0)::bigint as on_time_count,
  case
    when coalesce(p.delivered_count, 0) = 0 then null
    else round((coalesce(p.on_time_count, 0)::numeric / p.delivered_count::numeric) * 100, 2)
  end as otd_pct,
  p.avg_delivery_minutes,
  case when coalesce(p.total_orders, 0) < 5 then 'LOW_VOLUME' else 'NORMAL' end as volume_status,
  coalesce(d.delivered_count_delivery_date, 0)::bigint as delivered_count_delivery_date
from placed p
full outer join delivered d
  on d.warehouse_code = p.warehouse_code
 and d.day = p.day
 and d.city = p.city
 and d.zone = p.zone
 and d.area is not distinct from p.area;

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
  volume_status,
  delivered_count_delivery_date
from public.v_city_performance;

create or replace view public.v_route_efficiency_daily as
with base as (
  select
    warehouse_code,
    created_date_local,
    delivery_date_local,
    coalesce(nullif(btrim(city), ''), 'UNKNOWN') as city,
    coalesce(nullif(btrim(area), ''), 'UNKNOWN') as area,
    parcel_id,
    is_countable_order,
    is_delivered_status,
    is_on_time,
    order_ts_utc,
    delivered_ts
  from public.v_parcel_kpi
), placed as (
  select
    warehouse_code,
    created_date_local as day,
    city,
    count(distinct parcel_id) filter (where is_countable_order) as total_orders,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as delivered_count,
    count(distinct parcel_id) filter (where is_countable_order and is_on_time is true) as on_time_count,
    count(distinct area) filter (where is_countable_order) as active_areas,
    case
      when count(distinct area) filter (where is_countable_order) = 0 then null
      else round(
        (
          (count(distinct parcel_id) filter (where is_countable_order))::numeric
          / (count(distinct area) filter (where is_countable_order))::numeric
        ),
        2
      )
    end as parcels_per_active_area,
    round(
      (
        avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
          filter (where is_countable_order and is_delivered_status and delivered_ts is not null and delivered_ts > order_ts_utc)
      )::numeric,
      2
    ) as avg_delivery_minutes
  from base
  group by warehouse_code, created_date_local, city
), delivered as (
  select
    warehouse_code,
    delivery_date_local as day,
    city,
    count(distinct parcel_id) filter (where is_countable_order and is_delivered_status) as delivered_count_delivery_date
  from base
  where delivery_date_local is not null
  group by warehouse_code, delivery_date_local, city
)
select
  coalesce(p.warehouse_code, d.warehouse_code) as warehouse_code,
  coalesce(p.day, d.day) as day,
  coalesce(p.city, d.city) as city,
  coalesce(p.total_orders, 0)::bigint as total_orders,
  coalesce(p.delivered_count, 0)::bigint as delivered_count,
  coalesce(p.on_time_count, 0)::bigint as on_time_count,
  coalesce(p.active_areas, 0)::bigint as active_areas,
  p.parcels_per_active_area,
  p.avg_delivery_minutes,
  case
    when coalesce(p.delivered_count, 0) = 0 then null
    else round((coalesce(p.on_time_count, 0)::numeric / p.delivered_count::numeric) * 100, 2)
  end as otd_pct,
  coalesce(d.delivered_count_delivery_date, 0)::bigint as delivered_count_delivery_date
from placed p
full outer join delivered d
  on d.warehouse_code = p.warehouse_code
 and d.day = p.day
 and d.city = p.city;

create or replace view public.v_route_efficiency_daily_rollup as
with per_warehouse as (
  select
    warehouse_code,
    day,
    total_orders,
    delivered_count,
    on_time_count,
    active_areas,
    parcels_per_active_area,
    avg_delivery_minutes,
    otd_pct,
    delivered_count_delivery_date
  from public.v_route_efficiency_daily
), all_warehouses as (
  select
    'ALL'::text as warehouse_code,
    day,
    sum(total_orders)::bigint as total_orders,
    sum(delivered_count)::bigint as delivered_count,
    sum(on_time_count)::bigint as on_time_count,
    sum(active_areas)::bigint as active_areas,
    case
      when sum(active_areas) = 0 then null
      else round((sum(total_orders)::numeric / sum(active_areas)::numeric), 2)
    end as parcels_per_active_area,
    round(avg(avg_delivery_minutes)::numeric, 2) as avg_delivery_minutes,
    case
      when sum(delivered_count) = 0 then null
      else round((sum(on_time_count)::numeric / sum(delivered_count)::numeric) * 100, 2)
    end as otd_pct,
    sum(delivered_count_delivery_date)::bigint as delivered_count_delivery_date
  from public.v_route_efficiency_daily
  group by day
)
select * from per_warehouse
union all
select * from all_warehouses;

create or replace view public.v_promise_reliability_daily as
with base as (
  select
    warehouse_code,
    created_date_local as day,
    coalesce(nullif(btrim(city), ''), 'UNKNOWN') as city,
    parcel_id,
    is_countable_order,
    is_delivered_status,
    delivered_ts,
    deadline_local,
    delivered_local
  from public.v_parcel_kpi
)
select
  warehouse_code,
  day,
  city,
  count(distinct parcel_id) filter (where is_countable_order) as total_orders,
  count(distinct parcel_id) filter (where is_countable_order and is_delivered_status and delivered_ts is not null and deadline_local is not null) as delivered_with_promise,
  count(distinct parcel_id) filter (
    where is_countable_order
      and is_delivered_status
      and delivered_ts is not null
      and deadline_local is not null
      and delivered_local <= deadline_local
  ) as within_promise_window,
  case
    when count(distinct parcel_id) filter (where is_countable_order and is_delivered_status and delivered_ts is not null and deadline_local is not null) = 0 then null
    else round(
      (
        (count(distinct parcel_id) filter (
          where is_countable_order and is_delivered_status and delivered_ts is not null and deadline_local is not null and delivered_local <= deadline_local
        ))::numeric
        / (count(distinct parcel_id) filter (where is_countable_order and is_delivered_status and delivered_ts is not null and deadline_local is not null))::numeric
      ) * 100,
      2
    )
  end as promise_hit_rate,
  round(
    (
      avg(extract(epoch from (delivered_local - deadline_local)) / 60)
        filter (where is_countable_order and is_delivered_status and delivered_ts is not null and deadline_local is not null)
    )::numeric,
    2
  ) as avg_eta_error_minutes
from base
group by warehouse_code, day, city;

create or replace view public.v_promise_reliability_daily_rollup as
with per_warehouse as (
  select
    warehouse_code,
    day,
    total_orders,
    delivered_with_promise,
    within_promise_window,
    promise_hit_rate,
    avg_eta_error_minutes
  from public.v_promise_reliability_daily
), all_warehouses as (
  select
    'ALL'::text as warehouse_code,
    day,
    sum(total_orders)::bigint as total_orders,
    sum(delivered_with_promise)::bigint as delivered_with_promise,
    sum(within_promise_window)::bigint as within_promise_window,
    case
      when sum(delivered_with_promise) = 0 then null
      else round((sum(within_promise_window)::numeric / sum(delivered_with_promise)::numeric) * 100, 2)
    end as promise_hit_rate,
    round(avg(avg_eta_error_minutes)::numeric, 2) as avg_eta_error_minutes
  from public.v_promise_reliability_daily
  group by day
)
select * from per_warehouse
union all
select * from all_warehouses;

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
    wa_delivered_count,
    total_delivered_inc_wa_delivery_date,
    total_delivered_exc_wa_delivery_date
  from public.v_dod_summary
), all_warehouses as (
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
    sum(wa_delivered_count)::bigint as wa_delivered_count,
    sum(total_delivered_inc_wa_delivery_date)::bigint as total_delivered_inc_wa_delivery_date,
    sum(total_delivered_exc_wa_delivery_date)::bigint as total_delivered_exc_wa_delivery_date
  from public.v_dod_summary
  group by day
)
select * from per_warehouse
union all
select * from all_warehouses;

create or replace function public.detect_data_quality_issues()
returns table(check_id text, severity text, count int, description text)
language plpgsql
as $$
begin
  delete from public.data_quality_issues where resolved_at is null;

  insert into public.data_quality_issues (check_id, check_name, severity, description, affected_count, sample_records)
  select
    'DQ-001',
    'Impossible Timestamps',
    'critical',
    'delivered_ts is before order_ts_utc',
    count(*),
    (
      select jsonb_agg(parcel_id)
      from (
        select parcel_id
        from public.v_parcel_kpi
        where delivered_ts is not null and delivered_ts < order_ts_utc
        limit 10
      ) samples
    )
  from public.v_parcel_kpi
  where delivered_ts is not null and delivered_ts < order_ts_utc
  having count(*) > 0;

  insert into public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count, sample_records)
  select
    'DQ-002',
    'Missing Zone',
    'warning',
    warehouse_code,
    'No zone assigned to order',
    count(*),
    (
      select jsonb_agg(parcel_id)
      from (
        select parcel_id
        from public.v_parcel_kpi samples
        where samples.warehouse_code = vpk.warehouse_code
          and (samples.zone is null or samples.zone = '' or samples.zone = 'UNKNOWN')
        limit 10
      ) samples
    )
  from public.v_parcel_kpi vpk
  where zone is null or zone = '' or zone = 'UNKNOWN'
  group by warehouse_code
  having count(*) > 0;

  insert into public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count, sample_records)
  select
    'DQ-003',
    'Missing City',
    'warning',
    warehouse_code,
    'No city assigned to order',
    count(*),
    (
      select jsonb_agg(parcel_id)
      from (
        select parcel_id
        from public.v_parcel_kpi samples
        where samples.warehouse_code = vpk.warehouse_code
          and (samples.city is null or samples.city = '' or samples.city = 'UNKNOWN')
        limit 10
      ) samples
    )
  from public.v_parcel_kpi vpk
  where city is null or city = '' or city = 'UNKNOWN'
  group by warehouse_code
  having count(*) > 0;

  insert into public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count)
  select
    'DQ-011',
    'WA Delivered Ratio Anomaly',
    'critical',
    warehouse_code,
    'wa_delivered_count exceeds total_delivered_inc_wa',
    count(*)
  from public.v_dod_summary
  where wa_delivered_count > total_delivered_inc_wa
  group by warehouse_code
  having count(*) > 0;

  insert into public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count)
  select
    'DQ-012',
    'Missing Delivery Timing Rule Coverage',
    'warning',
    b.warehouse_code,
    'City has orders but no delivery timing rule configured',
    count(distinct lower(btrim(coalesce(b.city, ''))))
  from public.v_parcel_base b
  left join public.warehouse_delivery_timing_rules dtr
    on dtr.warehouse_id = b.warehouse_id
   and dtr.city_normalized = lower(btrim(coalesce(b.city, '')))
  where b.city is not null
    and b.city <> ''
    and dtr.city_normalized is null
  group by b.warehouse_code
  having count(distinct lower(btrim(coalesce(b.city, '')))) > 0;

  insert into public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count)
  select
    'DQ-013',
    'High Fill-Forward Usage',
    'warning',
    ir.warehouse_code,
    'Parcel logs upload contains many blank timestamps filled-forward',
    sum(ir.warning_count)::int
  from public.ingest_runs ir
  where ir.dataset_type = 'parcel_logs'
    and ir.started_at >= now() - interval '7 days'
  group by ir.warehouse_code
  having sum(ir.warning_count) >= 10;

  insert into public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count, sample_records)
  select
    'DQ-014',
    'Missing Delivery Date For Delivered Status',
    'warning',
    warehouse_code,
    'order_status is Delivered but delivery_date is NULL',
    count(*),
    (
      select jsonb_agg(parcel_id)
      from (
        select parcel_id
        from public.v_parcel_kpi samples
        where samples.warehouse_code = vpk.warehouse_code
          and samples.is_delivered_status is true
          and samples.delivery_date_local is null
        limit 10
      ) samples
    )
  from public.v_parcel_kpi vpk
  where is_delivered_status is true
    and delivery_date_local is null
  group by warehouse_code
  having count(*) > 0;

  return query
  select dqi.check_id, dqi.severity, dqi.affected_count::int, dqi.description
  from public.data_quality_issues dqi
  where dqi.resolved_at is null
  order by
    case dqi.severity
      when 'critical' then 1
      when 'warning' then 2
      else 3
    end,
    dqi.affected_count desc;
end;
$$;

alter view public.v_dod_summary_daily_rollup set (security_invoker = true);
alter view public.v_route_efficiency_daily_rollup set (security_invoker = true);
alter view public.v_promise_reliability_daily_rollup set (security_invoker = true);
