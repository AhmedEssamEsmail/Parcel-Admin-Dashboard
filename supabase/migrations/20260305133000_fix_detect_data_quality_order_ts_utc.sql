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
