do $$
declare
  view_record record;
begin
  for view_record in
    select n.nspname as schema_name, c.relname as view_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'v'
      and n.nspname not in ('pg_catalog', 'information_schema')
      and n.nspname not like 'pg_toast%'
      and n.nspname not like 'pg_temp_%'
  loop
    begin
      execute format(
        'alter view %I.%I set (security_invoker = true)',
        view_record.schema_name,
        view_record.view_name
      );
    exception
      when insufficient_privilege then
        null;
      when object_not_in_prerequisite_state then
        null;
    end;
  end loop;
end;
$$;

do $$
declare
  fn_record record;
begin
  for fn_record in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prolang in (
        select oid from pg_language where lanname in ('plpgsql', 'sql')
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, extensions',
      fn_record.schema_name,
      fn_record.function_name,
      fn_record.identity_args
    );
  end loop;
end;
$$;
