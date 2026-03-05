do $$
declare
  table_record record;
begin
  for table_record in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and n.nspname = 'public'
  loop
    execute format(
      'alter table %I.%I enable row level security',
      table_record.schema_name,
      table_record.table_name
    );

    execute format(
      'revoke all on table %I.%I from anon, authenticated, public',
      table_record.schema_name,
      table_record.table_name
    );
  end loop;
end;
$$;
