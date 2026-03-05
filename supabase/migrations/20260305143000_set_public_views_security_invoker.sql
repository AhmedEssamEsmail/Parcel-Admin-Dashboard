do $$
declare
  view_record record;
begin
  for view_record in
    select n.nspname as schema_name, c.relname as view_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'v'
      and n.nspname = 'public'
  loop
    execute format(
      'alter view %I.%I set (security_invoker = true)',
      view_record.schema_name,
      view_record.view_name
    );
  end loop;
end;
$$;
