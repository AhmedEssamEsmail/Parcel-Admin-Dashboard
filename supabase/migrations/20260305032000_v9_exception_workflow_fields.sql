alter table if exists public.delivery_exceptions
  add column if not exists assignee text,
  add column if not exists category text,
  add column if not exists due_at timestamptz,
  add column if not exists resolution text,
  add column if not exists notes text;

create index if not exists idx_delivery_exceptions_assignee on public.delivery_exceptions (assignee);
create index if not exists idx_delivery_exceptions_category on public.delivery_exceptions (category);
create index if not exists idx_delivery_exceptions_due_at on public.delivery_exceptions (due_at);
