create table if not exists public.delivery_exceptions (
  id uuid primary key default gen_random_uuid(),
  warehouse_code text not null,
  parcel_id bigint null,
  exception_type text not null,
  severity text not null check (severity in ('critical','warning','info')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  description text not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_delivery_exceptions_warehouse_detected
  on public.delivery_exceptions (warehouse_code, detected_at desc);

create index if not exists idx_delivery_exceptions_status_severity
  on public.delivery_exceptions (status, severity);

create table if not exists public.exception_actions (
  id uuid primary key default gen_random_uuid(),
  exception_id uuid not null references public.delivery_exceptions(id) on delete cascade,
  action text not null,
  actor text not null default 'system',
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_exception_actions_exception_created
  on public.exception_actions (exception_id, created_at desc);

create or replace function public.refresh_delivery_exceptions(p_days int default 14)
returns int
language plpgsql
as $$
declare
  v_inserted int := 0;
begin
  delete from public.delivery_exceptions
  where status = 'open'
    and detected_at >= now() - make_interval(days => greatest(coalesce(p_days, 14), 1));

  insert into public.delivery_exceptions (
    warehouse_code,
    parcel_id,
    exception_type,
    severity,
    status,
    description,
    detected_at,
    metadata
  )
  select
    k.warehouse_code,
    k.parcel_id,
    'LATE_DELIVERY',
    case
      when extract(epoch from (k.delivered_ts - k.deadline_local)) / 3600 > 6 then 'critical'
      when extract(epoch from (k.delivered_ts - k.deadline_local)) / 3600 > 2 then 'warning'
      else 'info'
    end,
    'open',
    'Delivered after promised deadline',
    coalesce(k.delivered_ts, now()),
    jsonb_build_object(
      'minutes_late', round(extract(epoch from (k.delivered_ts - k.deadline_local)) / 60),
      'city', k.city,
      'area', k.area
    )
  from public.v_parcel_kpi k
  where k.delivered_ts is not null
    and k.deadline_local is not null
    and k.delivered_ts > k.deadline_local
    and k.created_date_local >= (current_date - greatest(coalesce(p_days, 14), 1));

  get diagnostics v_inserted = row_count;

  return v_inserted;
end;
$$;

create or replace view public.v_exceptions_summary_daily as
select
  date_trunc('day', detected_at)::date as day,
  warehouse_code,
  severity,
  count(*) as exception_count,
  count(*) filter (where status = 'open') as open_count,
  count(*) filter (where status = 'resolved') as resolved_count
from public.delivery_exceptions
group by date_trunc('day', detected_at)::date, warehouse_code, severity;

create or replace view public.v_exception_aging as
select
  id,
  warehouse_code,
  parcel_id,
  exception_type,
  severity,
  status,
  description,
  detected_at,
  resolved_at,
  round(extract(epoch from (coalesce(resolved_at, now()) - detected_at)) / 3600, 2) as aging_hours,
  metadata
from public.delivery_exceptions;
