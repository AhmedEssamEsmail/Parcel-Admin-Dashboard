-- Enhancements v3: WA source table, delivery timing rules, and KPI/view alignment.

create table if not exists public.wa_orders (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  parcel_id bigint not null,
  invoice_cdate timestamptz null,
  address_text text null,
  country_name text null,
  inserted_at timestamptz not null default now(),
  primary key (warehouse_id, parcel_id)
);

create index if not exists idx_wa_orders_lookup
  on public.wa_orders (warehouse_id, parcel_id);

comment on table public.wa_orders is
  'Explicit Waiting Address parcel list (source: WA sheet).';

create table if not exists public.warehouse_delivery_timing_rules (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  city text not null,
  city_normalized text not null,
  cutoff_time time null,
  start_time time null,
  sla_mode text not null check (sla_mode in ('SAME_DAY', 'FIXED_HOURS')),
  sla_hours numeric(8,3) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, city_normalized),
  check (
    (sla_mode = 'SAME_DAY' and sla_hours is null)
    or (sla_mode = 'FIXED_HOURS' and sla_hours is not null and sla_hours > 0 and sla_hours <= 72)
  )
);

create index if not exists idx_delivery_timing_rules_lookup
  on public.warehouse_delivery_timing_rules (warehouse_id, city_normalized);

comment on table public.warehouse_delivery_timing_rules is
  'Per warehouse/city delivery timing rules (source: Delivery Timing sheet).';

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
  coalesce(csc.sla_minutes, w.sla_minutes) as effective_sla_minutes
from public.delivery_details dd
join public.warehouses w on w.id = dd.warehouse_id
left join public.warehouse_city_sla_configs csc
  on csc.warehouse_id = dd.warehouse_id
 and csc.city_normalized = lower(btrim(coalesce(dd.city, '')))
left join public.v_parcel_status_min ps
  on ps.warehouse_id = dd.warehouse_id
 and ps.parcel_id = dd.parcel_id;

create or replace view public.v_dod_summary as
with base_data as (
  select
    warehouse_code,
    created_date_local as day,
    parcel_id,
    is_on_time,
    waiting_address,
    delivered_ts
  from public.v_parcel_kpi
)
select
  warehouse_code,
  day,
  count(distinct parcel_id) as total_placed_inc_wa,
  count(distinct parcel_id) filter (where delivered_ts is not null) as total_delivered_inc_wa,
  count(distinct parcel_id) filter (where is_on_time is true) as on_time_inc_wa,
  case
    when count(distinct parcel_id) filter (where delivered_ts is not null) = 0 then null
    else round(
      (count(distinct parcel_id) filter (where is_on_time is true))::numeric
      / (count(distinct parcel_id) filter (where delivered_ts is not null))::numeric
      * 100, 2
    )
  end as otd_pct_inc_wa,
  count(distinct parcel_id) filter (where delivered_ts is not null and is_on_time is null) as null_on_time_count,
  count(distinct parcel_id) filter (where waiting_address) as wa_count,
  count(distinct parcel_id) filter (where waiting_address and delivered_ts is not null) as wa_delivered_count,
  count(distinct parcel_id) filter (where not waiting_address or waiting_address is null) as total_placed_exc_wa,
  count(distinct parcel_id) filter (where delivered_ts is not null and (not waiting_address or waiting_address is null)) as total_delivered_exc_wa,
  count(distinct parcel_id) filter (where is_on_time is true and (not waiting_address or waiting_address is null)) as on_time_exc_wa,
  case
    when count(distinct parcel_id) filter (where delivered_ts is not null and (not waiting_address or waiting_address is null)) = 0 then null
    else round(
      (count(distinct parcel_id) filter (where is_on_time is true and (not waiting_address or waiting_address is null)))::numeric
      / (count(distinct parcel_id) filter (where delivered_ts is not null and (not waiting_address or waiting_address is null)))::numeric
      * 100, 2
    )
  end as otd_pct_exc_wa
from base_data
group by warehouse_code, day
order by warehouse_code, day;

create or replace view public.v_raw_delivery_stages as
with k as (
  select
    k.*,
    interval '10 minutes' as processing_sla,
    interval '20 minutes' as preparing_sla,
    interval '31 minutes' as ops_issue_threshold,
    make_interval(mins => k.effective_sla_minutes) as delivery_sla,
    (k.collecting_ts at time zone k.tz) as collecting_local,
    (k.ready_for_preparing_ts at time zone k.tz) as ready_for_preparing_local,
    (k.prepare_ts at time zone k.tz) as prepare_local,
    (k.ready_for_delivery_ts at time zone k.tz) as ready_for_delivery_local,
    (k.on_the_way_ts at time zone k.tz) as on_the_way_local,
    dtr.sla_mode as delivery_timing_sla_mode,
    dtr.sla_hours as delivery_timing_sla_hours,
    dtr.cutoff_time as delivery_timing_cutoff_time,
    dtr.start_time as delivery_timing_start_time
  from public.v_parcel_kpi k
  left join public.warehouse_delivery_timing_rules dtr
    on dtr.warehouse_id = k.warehouse_id
   and dtr.city_normalized = lower(btrim(coalesce(k.city, '')))
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
    case
      when c.delivery_timing_sla_mode = 'SAME_DAY' and c.cutoff_status = 'After Cutoff Time' then
        greatest(interval '0', (date_trunc('day', c.order_local) + interval '2 day') - c.order_local)
      when c.delivery_timing_sla_mode = 'SAME_DAY' and c.cutoff_status = 'Before Shift' then
        greatest(interval '0', (date_trunc('day', c.order_local) + interval '1 day') - c.order_local) + c.processing_expected_time
      when c.delivery_timing_sla_mode = 'SAME_DAY' then
        greatest(interval '0', (date_trunc('day', c.order_local) + interval '1 day') - c.order_local)
      when c.delivery_timing_sla_mode = 'FIXED_HOURS' and c.delivery_timing_sla_hours is not null and c.cutoff_status = 'After Cutoff Time' then
        make_interval(secs => (c.delivery_timing_sla_hours * 3600)::int)
        + greatest(interval '0', (date_trunc('day', c.order_local) + interval '1 day') - c.order_local)
      when c.delivery_timing_sla_mode = 'FIXED_HOURS' and c.delivery_timing_sla_hours is not null and c.cutoff_status = 'Before Shift' then
        make_interval(secs => (c.delivery_timing_sla_hours * 3600)::int) + c.processing_expected_time
      when c.delivery_timing_sla_mode = 'FIXED_HOURS' and c.delivery_timing_sla_hours is not null then
        make_interval(secs => (c.delivery_timing_sla_hours * 3600)::int)
      else c.delivery_sla
    end as delivery_expected_time,
    c.deliver_time as delivery_actual_time,
    case
      when c.delivered_ts is null then null
      when c.deliver_time <= (
        case
          when c.delivery_timing_sla_mode = 'SAME_DAY' and c.cutoff_status = 'After Cutoff Time' then
            greatest(interval '0', (date_trunc('day', c.order_local) + interval '2 day') - c.order_local)
          when c.delivery_timing_sla_mode = 'SAME_DAY' and c.cutoff_status = 'Before Shift' then
            greatest(interval '0', (date_trunc('day', c.order_local) + interval '1 day') - c.order_local) + c.processing_expected_time
          when c.delivery_timing_sla_mode = 'SAME_DAY' then
            greatest(interval '0', (date_trunc('day', c.order_local) + interval '1 day') - c.order_local)
          when c.delivery_timing_sla_mode = 'FIXED_HOURS' and c.delivery_timing_sla_hours is not null and c.cutoff_status = 'After Cutoff Time' then
            make_interval(secs => (c.delivery_timing_sla_hours * 3600)::int)
            + greatest(interval '0', (date_trunc('day', c.order_local) + interval '1 day') - c.order_local)
          when c.delivery_timing_sla_mode = 'FIXED_HOURS' and c.delivery_timing_sla_hours is not null and c.cutoff_status = 'Before Shift' then
            make_interval(secs => (c.delivery_timing_sla_hours * 3600)::int) + c.processing_expected_time
          when c.delivery_timing_sla_mode = 'FIXED_HOURS' and c.delivery_timing_sla_hours is not null then
            make_interval(secs => (c.delivery_timing_sla_hours * 3600)::int)
          else c.delivery_sla
        end
      ) then 'Within SLA'
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
  (e.order_local + e.delivery_expected_time) as expected_delivery_time,
  case
    when e.delivered_ts is null then null
    when e.delivery_status = 'Within SLA' then 'On Time'
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
    when e.delivery_status = 'Within SLA' then ''
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
  count(distinct parcel_id) filter (
    where delivered_ts is not null and (is_on_time is false or is_on_time is null)
  ) as late,
  count(distinct parcel_id) filter (where waiting_address is true) as wa_count,
  count(distinct parcel_id) filter (where waiting_address is true and delivered_ts is not null) as wa_delivered_count,
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
  count(distinct parcel_id) filter (
    where delivered_ts is not null and (is_on_time is false or is_on_time is null)
  ) as late,
  count(distinct parcel_id) filter (where waiting_address is true) as wa_count,
  count(distinct parcel_id) filter (where waiting_address is true and delivered_ts is not null) as wa_delivered_count,
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
