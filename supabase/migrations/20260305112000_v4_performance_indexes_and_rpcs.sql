create index if not exists idx_delivery_details_warehouse_order_date
  on public.delivery_details (warehouse_id, order_date desc);

create index if not exists idx_parcel_logs_warehouse_status_ts
  on public.parcel_logs (warehouse_id, status_ts desc);

create index if not exists idx_parcel_logs_warehouse_parcel_status
  on public.parcel_logs (warehouse_id, parcel_id, parcel_status);

create index if not exists idx_freshdesk_tickets_warehouse_parcel
  on public.freshdesk_tickets (warehouse_id, parcel_id);

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
    s.on_time,
    s.late,
    s.wa_count,
    s.wa_delivered_count,
    s.avg_delivery_minutes,
    s.otd_pct
  from (
    select warehouse_code, week_start, null::date as month_start, week_label, null::text as month_label, total_placed, total_delivered, on_time, late, wa_count, wa_delivered_count, avg_delivery_minutes, otd_pct
    from public.v_wow_summary
    where lower(coalesce(p_period_type, 'week')) <> 'month'
    union all
    select warehouse_code, null::date as week_start, month_start, null::text as week_label, month_label, total_placed, total_delivered, on_time, late, wa_count, wa_delivered_count, avg_delivery_minutes, otd_pct
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
