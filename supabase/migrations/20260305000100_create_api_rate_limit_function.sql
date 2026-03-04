create table if not exists public.api_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  request_count int not null,
  updated_at timestamptz not null default now()
);

comment on table public.api_rate_limits is
  'Rolling-window API rate limit counters keyed by client IP and route.';

create or replace function public.check_rate_limit(
  p_key text,
  p_window_seconds int,
  p_max_requests int
)
returns table (
  allowed boolean,
  remaining int,
  reset_epoch bigint
)
language plpgsql
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_request_count int;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'p_key is required';
  end if;

  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be > 0';
  end if;

  if p_max_requests is null or p_max_requests <= 0 then
    raise exception 'p_max_requests must be > 0';
  end if;

  insert into public.api_rate_limits as arl (key, window_start, request_count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update
    set
      window_start = case
        when arl.window_start <= (v_now - make_interval(secs => p_window_seconds))
          then v_now
        else arl.window_start
      end,
      request_count = case
        when arl.window_start <= (v_now - make_interval(secs => p_window_seconds))
          then 1
        else arl.request_count + 1
      end,
      updated_at = v_now
  returning window_start, request_count
  into v_window_start, v_request_count;

  allowed := v_request_count <= p_max_requests;
  remaining := greatest(p_max_requests - v_request_count, 0);
  reset_epoch := extract(epoch from (v_window_start + make_interval(secs => p_window_seconds)))::bigint;

  return next;
end;
$$;
