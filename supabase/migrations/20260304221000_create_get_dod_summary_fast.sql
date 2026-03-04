create or replace function public.get_dod_summary_fast(
  p_warehouse_code text,
  p_from date,
  p_to date
)
returns table (
  day date,
  total_orders bigint,
  on_time bigint,
  late bigint,
  on_time_pct numeric
)
language sql
stable
as $$
  select
    k.created_date_local as day,
    count(*) as total_orders,
    count(*) filter (where k.is_on_time is true) as on_time,
    count(*) filter (where k.is_on_time is false) as late,
    case
      when count(*) = 0 then null
      else (count(*) filter (where k.is_on_time is true))::numeric / count(*)::numeric
    end as on_time_pct
  from public.v_parcel_kpi k
  where k.warehouse_code = upper(trim(p_warehouse_code))
    and k.created_date_local between p_from and p_to
    and k.delivered_ts is not null
  group by k.created_date_local
  order by k.created_date_local;
$$;
