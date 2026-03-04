create table if not exists public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  warehouse_code text not null,
  dataset_type text not null,
  file_name text null,
  parsed_count int not null default 0,
  valid_count int not null default 0,
  inserted_count int not null default 0,
  ignored_count int not null default 0,
  warning_count int not null default 0,
  error_count int not null default 0,
  status text not null default 'success' check (status in ('success', 'partial', 'failed')),
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists idx_ingest_runs_warehouse_started
  on public.ingest_runs (warehouse_code, started_at desc);

create index if not exists idx_ingest_runs_dataset_started
  on public.ingest_runs (dataset_type, started_at desc);

create or replace view public.v_ingest_health_daily as
select
  date_trunc('day', started_at)::date as day,
  warehouse_code,
  dataset_type,
  count(*) as total_runs,
  sum(inserted_count) as inserted_count,
  sum(ignored_count) as ignored_count,
  sum(warning_count) as warning_count,
  sum(error_count) as error_count,
  round(avg(
    extract(epoch from (coalesce(completed_at, started_at) - started_at))
  )::numeric, 2) as avg_duration_seconds
from public.ingest_runs
group by date_trunc('day', started_at)::date, warehouse_code, dataset_type;
