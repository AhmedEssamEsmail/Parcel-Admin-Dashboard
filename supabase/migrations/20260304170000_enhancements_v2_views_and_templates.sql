-- Phase 2 enhancements: KPI views, data quality, shift templates

create or replace view public.v_zone_performance as
with zone_stats as (
  select
    k.warehouse_code,
    coalesce(k.zone, 'UNKNOWN') as zone,
    coalesce(k.city, 'UNKNOWN') as city,
    k.area,
    k.created_date_local as day,
    count(distinct k.parcel_id) as total_orders,
    count(distinct k.parcel_id) filter (where k.delivered_ts is not null) as delivered_count,
    count(distinct k.parcel_id) filter (where k.is_on_time is true) as on_time_count,
    avg(extract(epoch from (k.delivered_ts - k.order_ts_utc)) / 60)
      filter (where k.delivered_ts is not null and k.delivered_ts > k.order_ts_utc) as avg_delivery_minutes
  from public.v_parcel_kpi k
  group by k.warehouse_code, k.zone, k.city, k.area, k.created_date_local
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
  round(avg_delivery_minutes::numeric, 0) as avg_delivery_minutes,
  case when total_orders < 5 then 'LOW_VOLUME' else 'NORMAL' end as volume_status
from zone_stats;

create or replace view public.v_avg_delivery_time as
select
  k.warehouse_code,
  k.created_date_local as day,
  count(*) as delivered_count,
  round(avg(extract(epoch from (k.delivered_ts - k.order_ts_utc)) / 60)::numeric, 0) as avg_minutes,
  round(
    percentile_cont(0.5) within group (
      order by extract(epoch from (k.delivered_ts - k.order_ts_utc)) / 60
    )::numeric,
    0
  ) as median_minutes,
  round(min(extract(epoch from (k.delivered_ts - k.order_ts_utc)) / 60)::numeric, 0) as min_minutes,
  round(max(extract(epoch from (k.delivered_ts - k.order_ts_utc)) / 60)::numeric, 0) as max_minutes
from public.v_parcel_kpi k
where k.delivered_ts is not null
  and k.delivered_ts > k.order_ts_utc
group by k.warehouse_code, k.created_date_local;

create or replace view public.v_wow_summary as
with week_calc as (
  select
    warehouse_code,
    created_date_local,
    (created_date_local - (extract(dow from created_date_local)::int))::date as week_start,
    parcel_id,
    delivered_ts,
    is_on_time,
    waiting_address,
    order_ts_utc
  from public.v_parcel_kpi
)
select
  warehouse_code,
  week_start,
  week_start + 6 as week_end,
  to_char(week_start, 'Mon DD') || ' - ' || to_char(week_start + 6, 'Mon DD, YYYY') as week_label,
  count(distinct parcel_id) as total_placed,
  count(distinct parcel_id) filter (where delivered_ts is not null) as total_delivered,
  count(distinct parcel_id) filter (where is_on_time is true) as on_time,
  count(distinct parcel_id) filter (where waiting_address is true) as wa_count,
  round(
    avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
      filter (where delivered_ts is not null)::numeric,
    0
  ) as avg_delivery_minutes,
  case
    when count(distinct parcel_id) filter (where delivered_ts is not null) = 0 then null
    else round(
      (count(distinct parcel_id) filter (where is_on_time is true)::numeric
        / count(distinct parcel_id) filter (where delivered_ts is not null)::numeric) * 100,
      2
    )
  end as otd_pct,
  'week' as period_type
from week_calc
group by warehouse_code, week_start
order by warehouse_code, week_start desc;

create or replace view public.v_mom_summary as
select
  warehouse_code,
  date_trunc('month', created_date_local)::date as month_start,
  (date_trunc('month', created_date_local) + interval '1 month - 1 day')::date as month_end,
  to_char(date_trunc('month', created_date_local), 'Month YYYY') as month_label,
  count(distinct parcel_id) as total_placed,
  count(distinct parcel_id) filter (where delivered_ts is not null) as total_delivered,
  count(distinct parcel_id) filter (where is_on_time is true) as on_time,
  count(distinct parcel_id) filter (where waiting_address is true) as wa_count,
  round(
    avg(extract(epoch from (delivered_ts - order_ts_utc)) / 60)
      filter (where delivered_ts is not null)::numeric,
    0
  ) as avg_delivery_minutes,
  case
    when count(distinct parcel_id) filter (where delivered_ts is not null) = 0 then null
    else round(
      (count(distinct parcel_id) filter (where is_on_time is true)::numeric
        / count(distinct parcel_id) filter (where delivered_ts is not null)::numeric) * 100,
      2
    )
  end as otd_pct,
  'month' as period_type
from public.v_parcel_kpi
group by warehouse_code, date_trunc('month', created_date_local)
order by warehouse_code, month_start desc;

create table if not exists public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  check_id text not null,
  check_name text not null,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  warehouse_code text,
  description text not null,
  affected_count int not null default 0,
  sample_records jsonb,
  recommendation text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_data_quality_severity
  on public.data_quality_issues(severity, resolved_at)
  where resolved_at is null;

create index if not exists idx_data_quality_warehouse
  on public.data_quality_issues(warehouse_code)
  where resolved_at is null;

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
    'delivered_ts is before order_ts',
    count(*),
    (
      select jsonb_agg(parcel_id)
      from (
        select parcel_id
        from public.v_parcel_kpi
        where delivered_ts is not null and delivered_ts < order_ts
        limit 10
      ) samples
    )
  from public.v_parcel_kpi
  where delivered_ts is not null and delivered_ts < order_ts
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

  insert into public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count, sample_records)
  select
    'DQ-004',
    'Missing Area',
    'info',
    warehouse_code,
    'No area assigned to order',
    count(*),
    (
      select jsonb_agg(parcel_id)
      from (
        select parcel_id
        from public.v_parcel_kpi samples
        where samples.warehouse_code = vpk.warehouse_code
          and (samples.area is null or samples.area = '' or samples.area = 'UNKNOWN')
        limit 10
      ) samples
    )
  from public.v_parcel_kpi vpk
  where area is null or area = '' or area = 'UNKNOWN'
  group by warehouse_code
  having count(*) > 0;

  insert into public.data_quality_issues (check_id, check_name, severity, description, affected_count, sample_records)
  select
    'DQ-009',
    'Missing On-Time Status',
    'critical',
    'is_on_time is NULL for delivered parcel',
    count(*),
    (
      select jsonb_agg(parcel_id)
      from (
        select parcel_id
        from public.v_parcel_kpi
        where delivered_ts is not null and is_on_time is null
        limit 10
      ) samples
    )
  from public.v_parcel_kpi
  where delivered_ts is not null and is_on_time is null
  having count(*) > 0;

  insert into public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count)
  select
    'DQ-006',
    'Missing Shift Configuration',
    'warning',
    w.code,
    'No shift config for today (' || to_char(current_date, 'Day') || ')',
    1
  from public.warehouses w
  where not exists (
    select 1
    from public.warehouse_shift_configs sc
    where sc.warehouse_id = w.id
      and sc.day_of_week = extract(dow from current_date)
      and sc.is_active = true
  );

  insert into public.data_quality_issues (check_id, check_name, severity, warehouse_code, description, affected_count, sample_records)
  select
    'DQ-010',
    'Low Volume Zones',
    'info',
    warehouse_code,
    zone || ' zone has fewer than 5 orders',
    total_orders,
    '[]'::jsonb
  from public.v_zone_performance
  where volume_status = 'LOW_VOLUME'
    and day = current_date;

  return query
  select check_id, severity, affected_count::int, description
  from public.data_quality_issues
  where resolved_at is null
  order by
    case severity
      when 'critical' then 1
      when 'warning' then 2
      else 3
    end,
    affected_count desc;
end;
$$;

create table if not exists public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  config jsonb not null,
  created_at timestamptz default now()
);