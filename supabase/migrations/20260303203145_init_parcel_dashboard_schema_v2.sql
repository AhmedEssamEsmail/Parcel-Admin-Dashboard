-- Supabase schema for Parcel Admin Dashboard (multi-warehouse)
-- Canonical schema file: supabase_schema_v2.sql

create extension if not exists pgcrypto;

-- 1) Dimensions
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tz text not null default 'Etc/GMT-3',
  sla_minutes int not null default 240,
  default_shift_start time not null,
  default_shift_end time not null,
  created_at timestamptz not null default now()
);

-- Optional per-day overrides; null values fall back to warehouse defaults.
create table if not exists public.warehouse_shift_overrides (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  shift_date date not null,
  shift_start time null,
  shift_end time null,
  created_at timestamptz not null default now(),
  primary key (warehouse_id, shift_date)
);

-- 2) Raw tables
create table if not exists public.delivery_details (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  parcel_id bigint not null,
  order_id bigint null,
  order_date timestamptz not null,
  delivery_date timestamptz null,
  order_status text not null,
  delivery_address text null,
  city text null,
  area text null,
  zone text null,
  inserted_at timestamptz not null default now(),
  primary key (warehouse_id, parcel_id)
);

create table if not exists public.parcel_logs (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  parcel_id bigint not null,
  order_id bigint null,
  parcel_status text not null,
  status_ts timestamptz not null,
  inserted_at timestamptz not null default now(),
  primary key (warehouse_id, parcel_id, parcel_status, status_ts)
);

create table if not exists public.collectors_report (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  parcel_id bigint not null,
  collector text null,
  start_ts timestamptz null,
  finish_ts timestamptz null,
  duration_minutes numeric null,
  inserted_at timestamptz not null default now(),
  primary key (warehouse_id, parcel_id)
);

create table if not exists public.prepare_report (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  parcel_id bigint not null,
  wrapper text null,
  start_ts timestamptz null,
  finish_ts timestamptz null,
  duration_minutes numeric null,
  inserted_at timestamptz not null default now(),
  primary key (warehouse_id, parcel_id)
);

create table if not exists public.items_per_order (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  invoice_id bigint null,
  parcel_id bigint not null,
  item_count int null,
  created_ts timestamptz null,
  inserted_at timestamptz not null default now(),
  primary key (warehouse_id, parcel_id)
);

create table if not exists public.freshdesk_tickets (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  ticket_id bigint not null,
  created_ts timestamptz null,
  status text null,
  agent_name text null,
  group_name text null,
  order_id bigint null,
  parcel_id bigint null,
  contact_type_1 text null,
  contact_type_2 text null,
  contact_type_3 text null,
  inserted_at timestamptz not null default now(),
  primary key (warehouse_id, ticket_id)
);

-- 3) Helper functions

-- Effective shift window for a warehouse/date with override fallback.
create or replace function public.effective_shift_window(
  p_warehouse_id uuid,
  p_date date
) returns table(shift_start time, shift_end time)
language sql
stable
as $$
  select
    coalesce(o.shift_start, w.default_shift_start) as shift_start,
    coalesce(o.shift_end, w.default_shift_end) as shift_end
  from public.warehouses w
  left join public.warehouse_shift_overrides o
    on o.warehouse_id = w.id
   and o.shift_date = p_date
  where w.id = p_warehouse_id;
$$;

-- Work-time seconds between two LOCAL timestamps based on effective shift window.
create or replace function public.work_seconds_between(
  start_local timestamp,
  end_local timestamp,
  p_warehouse_id uuid
) returns int
language plpgsql
stable
as $$
declare
  d date;
  total_seconds int := 0;
  s time;
  e time;
  win_start timestamp;
  win_end timestamp;
  overlap_start timestamp;
  overlap_end timestamp;
begin
  if start_local is null or end_local is null then
    return 0;
  end if;

  if end_local <= start_local then
    return 0;
  end if;

  for d in
    select gs::date
    from generate_series(
      date_trunc('day', start_local)::date,
      date_trunc('day', end_local)::date,
      interval '1 day'
    ) gs
  loop
    select esw.shift_start, esw.shift_end
      into s, e
    from public.effective_shift_window(p_warehouse_id, d) esw;

    if s is null or e is null then
      continue;
    end if;

    win_start := d + s;
    win_end := d + e;

    overlap_start := greatest(start_local, win_start);
    overlap_end := least(end_local, win_end);

    if overlap_end > overlap_start then
      total_seconds := total_seconds + extract(epoch from (overlap_end - overlap_start))::int;
    end if;
  end loop;

  return total_seconds;
end;
$$;

-- 4) Derived views

create or replace view public.v_parcel_status_min as
select
  warehouse_id,
  parcel_id,
  min(status_ts) filter (where parcel_status = 'Collecting') as collecting_ts,
  min(status_ts) filter (where parcel_status = 'Ready For Preparing') as ready_for_preparing_ts,
  min(status_ts) filter (where parcel_status = 'Prepare') as prepare_ts,
  min(status_ts) filter (where parcel_status = 'Ready For Delivery') as ready_for_delivery_ts,
  min(status_ts) filter (where parcel_status = 'On The Way') as on_the_way_ts,
  min(status_ts) filter (where parcel_status = 'Delivered') as delivered_ts
from public.parcel_logs
group by warehouse_id, parcel_id;

-- Base parcel view for both delivered and not-delivered rows.
create or replace view public.v_parcel_base as
select
  dd.warehouse_id,
  w.code as warehouse_code,
  w.tz,
  w.sla_minutes,
  dd.parcel_id,
  dd.order_id,
  dd.order_status,
  dd.order_date as order_ts_utc,
  (dd.order_date at time zone w.tz) as order_local,
  dd.delivery_address,
  (
    coalesce(dd.delivery_address, '') ilike '%extra info: wa%'
    or coalesce(dd.delivery_address, '') ilike '%extra: wa%'
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
  (dd.order_date at time zone w.tz)::date as created_date_local
from public.delivery_details dd
join public.warehouses w on w.id = dd.warehouse_id
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
  *,
  case
    when shift_start is null or shift_end is null then 'Unknown'
    when order_local::time < shift_start then 'Before Shift'
    when order_local::time > shift_end then 'After Cutoff Time'
    else 'Normal'
  end as cutoff_status,
  case
    when shift_start is null or shift_end is null then null::timestamp
    when order_local::time < shift_start
      then (created_date_local + shift_start) + make_interval(mins => sla_minutes)
    when order_local::time > shift_end and next_shift_start is not null
      then ((created_date_local + 1) + next_shift_start) + make_interval(mins => sla_minutes)
    when order_local::time > shift_end and next_shift_start is null
      then null::timestamp
    else order_local + make_interval(mins => sla_minutes)
  end as deadline_local,
  case
    when delivered_ts is null then null
    when shift_start is null or shift_end is null then null
    when order_local::time > shift_end and next_shift_start is null then null
    when delivered_local <= (
      case
        when order_local::time < shift_start
          then (created_date_local + shift_start) + make_interval(mins => sla_minutes)
        when order_local::time > shift_end and next_shift_start is not null
          then ((created_date_local + 1) + next_shift_start) + make_interval(mins => sla_minutes)
        when order_local::time > shift_end and next_shift_start is null
          then null::timestamp
        else order_local + make_interval(mins => sla_minutes)
      end
    ) then true else false
  end as is_on_time
from eff;

create or replace view public.v_parcel_phases as
select
  k.warehouse_id,
  k.warehouse_code,
  k.parcel_id,
  k.created_date_local as day,
  k.waiting_address,
  k.cutoff_status,
  k.is_on_time,
  k.delivered_ts,

  (k.collecting_ts at time zone k.tz) as collecting_local,
  (k.ready_for_preparing_ts at time zone k.tz) as ready_for_preparing_local,
  (k.prepare_ts at time zone k.tz) as prepare_local,
  (k.ready_for_delivery_ts at time zone k.tz) as ready_for_delivery_local,
  (k.on_the_way_ts at time zone k.tz) as on_the_way_local,

  (k.collecting_ts is not null) as has_processing_wait,
  (k.collecting_ts is not null and k.ready_for_preparing_ts is not null) as has_collect_time,
  (k.ready_for_preparing_ts is not null and k.prepare_ts is not null) as has_wait_to_prepare,
  (k.prepare_ts is not null and k.ready_for_delivery_ts is not null) as has_prepare_time,
  (k.ready_for_delivery_ts is not null and k.on_the_way_ts is not null) as has_wait_to_pickup,
  (k.on_the_way_ts is not null and k.delivered_ts is not null) as has_deliver_time,

  case
    when k.collecting_ts is null then 0
    else greatest(0, extract(epoch from ((k.collecting_ts at time zone k.tz) - k.order_local))::int)
  end as processing_wait_raw_s,

  case
    when k.collecting_ts is null or k.ready_for_preparing_ts is null then 0
    else greatest(0, extract(epoch from ((k.ready_for_preparing_ts at time zone k.tz) - (k.collecting_ts at time zone k.tz)))::int)
  end as collect_raw_s,

  case
    when k.ready_for_preparing_ts is null or k.prepare_ts is null then 0
    else greatest(0, extract(epoch from ((k.prepare_ts at time zone k.tz) - (k.ready_for_preparing_ts at time zone k.tz)))::int)
  end as wait_to_prepare_raw_s,

  case
    when k.prepare_ts is null or k.ready_for_delivery_ts is null then 0
    else greatest(0, extract(epoch from ((k.ready_for_delivery_ts at time zone k.tz) - (k.prepare_ts at time zone k.tz)))::int)
  end as prepare_raw_s,

  case
    when k.ready_for_delivery_ts is null or k.on_the_way_ts is null then 0
    else greatest(0, extract(epoch from ((k.on_the_way_ts at time zone k.tz) - (k.ready_for_delivery_ts at time zone k.tz)))::int)
  end as wait_to_pickup_raw_s,

  case
    when k.on_the_way_ts is null or k.delivered_ts is null then 0
    else greatest(0, extract(epoch from (k.delivered_local - (k.on_the_way_ts at time zone k.tz)))::int)
  end as deliver_raw_s,

  case
    when k.collecting_ts is null then null
    else public.work_seconds_between(k.order_local, (k.collecting_ts at time zone k.tz), k.warehouse_id)
  end as processing_wait_adj_s,

  case
    when k.collecting_ts is null or k.ready_for_preparing_ts is null then null
    else public.work_seconds_between((k.collecting_ts at time zone k.tz), (k.ready_for_preparing_ts at time zone k.tz), k.warehouse_id)
  end as collect_adj_s,

  case
    when k.ready_for_preparing_ts is null or k.prepare_ts is null then null
    else public.work_seconds_between((k.ready_for_preparing_ts at time zone k.tz), (k.prepare_ts at time zone k.tz), k.warehouse_id)
  end as wait_to_prepare_adj_s,

  case
    when k.prepare_ts is null or k.ready_for_delivery_ts is null then null
    else public.work_seconds_between((k.prepare_ts at time zone k.tz), (k.ready_for_delivery_ts at time zone k.tz), k.warehouse_id)
  end as prepare_adj_s,

  case
    when k.ready_for_delivery_ts is null or k.on_the_way_ts is null then null
    else public.work_seconds_between((k.ready_for_delivery_ts at time zone k.tz), (k.on_the_way_ts at time zone k.tz), k.warehouse_id)
  end as wait_to_pickup_adj_s,

  case
    when k.on_the_way_ts is null or k.delivered_ts is null then null
    else public.work_seconds_between((k.on_the_way_ts at time zone k.tz), k.delivered_local, k.warehouse_id)
  end as deliver_adj_s
from public.v_parcel_kpi k;

create or replace view public.v_dod_summary as
select
  warehouse_code,
  day,
  count(distinct parcel_id) as total_orders,
  count(distinct parcel_id) filter (where is_on_time is true) as on_time,
  count(distinct parcel_id) filter (where is_on_time is false) as late,
  case
    when count(distinct parcel_id) filter (where is_on_time is not null) = 0 then null
    else (count(distinct parcel_id) filter (where is_on_time is true))::numeric
      / (count(distinct parcel_id) filter (where is_on_time is not null))::numeric
  end as on_time_pct,

  count(distinct parcel_id) filter (where waiting_address) as wa_count,

  avg(processing_wait_adj_s) filter (where processing_wait_adj_s is not null) as avg_processing_wait_s_inc_wa,
  avg(collect_adj_s) filter (where collect_adj_s is not null) as avg_collect_s_inc_wa,
  avg(wait_to_prepare_adj_s) filter (where wait_to_prepare_adj_s is not null) as avg_wait_to_prepare_s_inc_wa,
  avg(prepare_adj_s) filter (where prepare_adj_s is not null) as avg_prepare_s_inc_wa,
  avg(wait_to_pickup_adj_s) filter (where wait_to_pickup_adj_s is not null) as avg_wait_to_pickup_s_inc_wa,
  avg(deliver_adj_s) filter (where deliver_adj_s is not null) as avg_deliver_s_inc_wa,

  avg(processing_wait_adj_s) filter (where processing_wait_adj_s is not null and not waiting_address) as avg_processing_wait_s_exc_wa,
  avg(collect_adj_s) filter (where collect_adj_s is not null and not waiting_address) as avg_collect_s_exc_wa,
  avg(wait_to_prepare_adj_s) filter (where wait_to_prepare_adj_s is not null and not waiting_address) as avg_wait_to_prepare_s_exc_wa,
  avg(prepare_adj_s) filter (where prepare_adj_s is not null and not waiting_address) as avg_prepare_s_exc_wa,
  avg(wait_to_pickup_adj_s) filter (where wait_to_pickup_adj_s is not null and not waiting_address) as avg_wait_to_pickup_s_exc_wa,
  avg(deliver_adj_s) filter (where deliver_adj_s is not null and not waiting_address) as avg_deliver_s_exc_wa
from public.v_parcel_phases
where delivered_ts is not null
group by warehouse_code, day
order by warehouse_code, day;

create or replace view public.v_raw_delivery_stages as
with k as (
  select
    k.*,
    interval '10 minutes' as processing_sla,
    interval '20 minutes' as preparing_sla,
    interval '31 minutes' as ops_issue_threshold,
    make_interval(mins => k.sla_minutes) as delivery_sla,
    (k.collecting_ts at time zone k.tz) as collecting_local,
    (k.ready_for_preparing_ts at time zone k.tz) as ready_for_preparing_local,
    (k.prepare_ts at time zone k.tz) as prepare_local,
    (k.ready_for_delivery_ts at time zone k.tz) as ready_for_delivery_local,
    (k.on_the_way_ts at time zone k.tz) as on_the_way_local
  from public.v_parcel_kpi k
),
eff as (
  select
    k.*,
    (public.effective_shift_window(k.warehouse_id, k.created_date_local)).shift_start as eff_shift_start,
    (public.effective_shift_window(k.warehouse_id, k.created_date_local)).shift_end as eff_shift_end,
    (public.effective_shift_window(k.warehouse_id, (k.created_date_local + 1))).shift_start as eff_next_shift_start
  from k
),
calc as (
  select
    e.*,
    case when e.collecting_ts is null then interval '0' else (e.collecting_local - e.order_local) end as processing_raw,
    case when e.collecting_ts is null or e.ready_for_preparing_ts is null then interval '0' else (e.ready_for_preparing_local - e.collecting_local) end as picker_phase,
    case when e.ready_for_preparing_ts is null or e.prepare_ts is null then interval '0' else (e.prepare_local - e.ready_for_preparing_local) end as prepare_wait,
    case when e.prepare_ts is null or e.ready_for_delivery_ts is null then interval '0' else (e.ready_for_delivery_local - e.prepare_local) end as wrapping_phase,
    case when e.ready_for_delivery_ts is null or e.on_the_way_ts is null then interval '0' else (e.on_the_way_local - e.ready_for_delivery_local) end as delivery_wait,
    case when e.on_the_way_ts is null or e.delivered_ts is null then interval '0' else (e.delivered_local - e.on_the_way_local) end as deliver_time,
    case when e.delivered_ts is null then interval '0' else (e.delivered_local - e.order_local) end as time_to_deliver,
    case
      when e.collecting_ts is null then interval '0'
      when e.eff_shift_start is null or e.eff_shift_end is null then interval '0'
      when e.order_local::time >= e.eff_shift_start and e.order_local::time <= e.eff_shift_end then (e.collecting_local - e.order_local)
      when e.order_local::time < e.eff_shift_start then ((e.created_date_local + e.eff_shift_start) - e.order_local)
      when e.eff_next_shift_start is null then interval '0'
      else (((e.created_date_local + 1) + e.eff_next_shift_start) - e.order_local)
    end as processing_expected_time
  from eff e
),
enrich as (
  select
    c.*,
    case
      when c.collecting_ts is null then interval '0'
      when c.cutoff_status = 'Normal' then c.processing_raw
      else c.processing_raw - c.processing_expected_time
    end as collect_wait_time,
    c.processing_raw as processing_time,
    case
      when c.processing_expected_time <= c.processing_sla then c.processing_raw
      else c.processing_raw - c.processing_expected_time
    end as processing_actual_time,
    case
      when (
        case
          when c.processing_expected_time <= c.processing_sla then c.processing_raw
          else c.processing_raw - c.processing_expected_time
        end
      ) <= c.processing_sla then 'Within SLA' else 'OOSLA'
    end as processing_status,
    case
      when c.ready_for_delivery_ts is null then interval '0'
      when c.cutoff_status = 'Before Shift' then
        (c.processing_raw + c.picker_phase + c.prepare_wait + c.wrapping_phase) - c.processing_expected_time
      else
        (c.processing_raw + c.picker_phase + c.prepare_wait + c.wrapping_phase)
    end as ops_time,
    interval '0' as iftar_time,
    case
      when c.waiting_address then
        (c.picker_phase + c.prepare_wait + c.wrapping_phase + c.delivery_wait)
      else
        (c.picker_phase + c.prepare_wait + c.wrapping_phase + c.delivery_wait + greatest(interval '0', c.processing_raw - c.processing_expected_time))
    end as preparing_actual_time,
    case
      when (
        case
          when c.waiting_address then
            (c.picker_phase + c.prepare_wait + c.wrapping_phase + c.delivery_wait)
          else
            (c.picker_phase + c.prepare_wait + c.wrapping_phase + c.delivery_wait + greatest(interval '0', c.processing_raw - c.processing_expected_time))
        end
      ) <= c.preparing_sla then 'Within SLA' else 'OOSLA'
    end as preparing_status,
    c.delivery_sla as delivery_expected_time,
    c.deliver_time as delivery_actual_time,
    case
      when c.delivered_ts is null then null
      when c.deliver_time <= c.delivery_sla then 'Within SLA'
      else 'OOSLA'
    end as delivery_status
  from calc c
),
tickets as (
  select
    f.warehouse_id,
    f.parcel_id,
    true as has_ticket,
    max(f.contact_type_1) as ticket_type
  from public.freshdesk_tickets f
  where f.parcel_id is not null
  group by f.warehouse_id, f.parcel_id
)
select
  e.warehouse_code as warehouse,
  e.parcel_id,
  e.order_local as order_placed,
  e.collecting_local as collecting,
  e.ready_for_preparing_local as ready_for_preparing,
  e.prepare_local as prepare,
  e.ready_for_delivery_local as ready_for_delivery,
  e.on_the_way_local as on_the_way_ts,
  e.delivered_local as delivered,
  e.delivery_address as address,
  case when e.waiting_address then 'Yes' else 'No' end as waiting_address,
  e.order_local::time as order_hour,
  e.created_date_local as order_date,
  greatest(interval '0', e.collect_wait_time) as collect_wait_time,
  greatest(interval '0', e.processing_time) as processing,
  greatest(interval '0', e.ops_time) as ops_time,
  e.iftar_time,
  greatest(interval '0', e.picker_phase) as picker_phase,
  greatest(interval '0', e.prepare_wait) as prepare_wait_time,
  greatest(interval '0', e.wrapping_phase) as wrapping_phase,
  greatest(interval '0', e.delivery_wait) as delivery_wait_time,
  greatest(interval '0', e.deliver_time) as on_the_way_duration,
  greatest(interval '0', e.time_to_deliver) as time_to_deliver,
  e.deadline_local as expected_delivery_time,
  case
    when e.delivered_ts is null then null
    when e.is_on_time then 'On Time'
    else 'Late'
  end as delivery_kpi,
  case
    when e.delivered_ts is null then 'Not Delivered'
    else 'Delivered'
  end as order_status,
  io.item_count as number_of_items,
  cr.collector as collector,
  pr.wrapper as wrapper,
  case
    when e.delivered_ts is null then ''
    when e.is_on_time then ''
    when e.waiting_address then ''
    when coalesce(t.has_ticket, false) then ''
    when e.ops_time >= e.ops_issue_threshold then 'Ops Issue'
    else 'Wait on Delivery Issue'
  end as ops_exceeded_30_mins,
  e.cutoff_status,
  e.processing_expected_time as expected_time_processing,
  e.processing_time as processing_time,
  e.processing_actual_time as actual_time_processing,
  e.processing_status as processing_time_status,
  case when coalesce(t.has_ticket, false) then 'Yes' else 'No' end as has_a_ticket,
  t.ticket_type,
  e.preparing_sla as expected_time_preparing,
  e.preparing_actual_time as actual_time_preparing,
  e.preparing_status as preparing_time_status,
  e.zone,
  e.city,
  e.area,
  e.delivery_expected_time as expected_time_delivery,
  e.delivery_actual_time as actual_time_delivery,
  e.delivery_status as delivery_time_status
from enrich e
left join public.items_per_order io
  on io.warehouse_id = e.warehouse_id and io.parcel_id = e.parcel_id
left join public.collectors_report cr
  on cr.warehouse_id = e.warehouse_id and cr.parcel_id = e.parcel_id
left join public.prepare_report pr
  on pr.warehouse_id = e.warehouse_id and pr.parcel_id = e.parcel_id
left join tickets t
  on t.warehouse_id = e.warehouse_id and t.parcel_id = e.parcel_id;

-- 5) Seed warehouse defaults (idempotent)
insert into public.warehouses (code, name, tz, sla_minutes, default_shift_start, default_shift_end)
values
  ('KUWAIT',  'Kuwait warehouse',  'Etc/GMT-3', 240, '08:00', '19:00'),
  ('RIYADH',  'Riyadh warehouse',  'Etc/GMT-3', 240, '08:00', '18:00'),
  ('DAMMAM',  'Dammam warehouse',  'Etc/GMT-3', 240, '09:00', '19:00'),
  ('JEDDAH',  'Jeddah warehouse',  'Etc/GMT-3', 240, '09:30', '18:00'),
  ('UAE',     'UAE warehouse',     'Etc/GMT-3', 240, '08:00', '19:00'),
  ('QATAR',   'Qatar warehouse',   'Etc/GMT-3', 240, '09:30', '19:00'),
  ('BAHRAIN', 'Bahrain warehouse', 'Etc/GMT-3', 240, '09:30', '19:00')
on conflict (code) do update
set
  name = excluded.name,
  tz = excluded.tz,
  sla_minutes = excluded.sla_minutes,
  default_shift_start = excluded.default_shift_start,
  default_shift_end = excluded.default_shift_end;
