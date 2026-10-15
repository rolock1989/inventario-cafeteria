-- RPC de lectura para Dashboard e Historial v1.2 Multi-area.
-- Ejecutar manualmente despues de multi-area-migration.sql.
-- No modifica datos, RLS ni migraciones anteriores.

do $$
declare
  missing_column text;
begin
  if to_regtype('public.inventory_status') is null
    or to_regprocedure('public.current_user_active()') is null
    or to_regprocedure('public.is_admin()') is null
    or to_regprocedure('public.current_user_area_id()') is null then
    raise exception 'Faltan tipos o funciones de multi-area. Ejecuta primero multi-area-migration.sql';
  end if;

  select string_agg(required.table_name || '.' || required.column_name, ', ')
  into missing_column
  from (values
    ('inventory_sessions', 'id'),
    ('inventory_sessions', 'status'),
    ('inventory_sessions', 'user_name'),
    ('inventory_sessions', 'area_id'),
    ('inventory_sessions', 'shift'),
    ('inventory_sessions', 'created_at'),
    ('inventory_sessions', 'submitted_at'),
    ('inventory_items', 'inventory_session_id'),
    ('inventory_items', 'product_id'),
    ('inventory_items', 'product_name'),
    ('inventory_items', 'category'),
    ('inventory_items', 'unit'),
    ('inventory_items', 'unit_price_at_time'),
    ('inventory_items', 'loss_amount'),
    ('inventory_items', 'physical_stock'),
    ('inventory_items', 'fudo_stock'),
    ('inventory_items', 'difference'),
    ('areas', 'id'),
    ('areas', 'name')
  ) as required(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = required.table_name
      and c.column_name = required.column_name
  );

  if missing_column is not null then
    raise exception 'Faltan columnas requeridas para las RPC: %', missing_column;
  end if;

  if exists (
    select 1
    from (values
      ('areas'),
      ('inventory_sessions'),
      ('inventory_items')
    ) as required(table_name)
    left join pg_catalog.pg_class c
      on c.relname = required.table_name
     and c.relnamespace = 'public'::regnamespace
    where c.oid is null or not c.relrowsecurity
  ) then
    raise exception 'RLS debe estar habilitado en areas, inventory_sessions e inventory_items';
  end if;
end $$;

-- Recrea todas las firmas para evitar ambiguedad de PostgREST y permisos EXECUTE heredados.
do $$
declare
  existing_function regprocedure;
begin
  for existing_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_dashboard_inventory_metrics', 'get_inventory_history_page')
  loop
    execute format('drop function %s', existing_function);
  end loop;
end $$;

create or replace function public.get_dashboard_inventory_metrics(
  p_start_date date default null,
  p_end_date date default null,
  p_area_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_is_admin boolean;
  v_user_area_id uuid;
  v_effective_area_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null or not public.current_user_active() then
    raise exception 'Usuario no autenticado o inactivo' using errcode = '42501';
  end if;

  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'La fecha de inicio no puede ser posterior a la fecha de termino' using errcode = '22007';
  end if;

  v_is_admin := public.is_admin();
  v_user_area_id := public.current_user_area_id();

  if v_is_admin then
    v_effective_area_id := p_area_id;
  else
    if v_user_area_id is null then
      raise exception 'El usuario no tiene un area activa asignada' using errcode = '42501';
    end if;
    if p_area_id is not null and p_area_id <> v_user_area_id then
      raise exception 'No autorizado para consultar otra area' using errcode = '42501';
    end if;
    v_effective_area_id := v_user_area_id;
  end if;

  with accessible_sessions as materialized (
    select
      s.id,
      s.area_id,
      s.user_name,
      s.shift,
      s.created_at,
      s.submitted_at,
      coalesce(s.submitted_at, s.created_at) as inventory_date,
      a.name as area_name
    from public.inventory_sessions s
    left join public.areas a on a.id = s.area_id
    where s.status = 'submitted'::public.inventory_status
      and (v_effective_area_id is null or s.area_id = v_effective_area_id)
  ),
  filtered_sessions as materialized (
    select *
    from accessible_sessions s
    where (p_start_date is null or s.inventory_date >= (p_start_date::timestamp at time zone 'America/Santiago'))
      and (p_end_date is null or s.inventory_date < ((p_end_date + 1)::timestamp at time zone 'America/Santiago'))
  ),
  filtered_items as materialized (
    select
      s.id as session_id,
      s.area_id,
      s.area_name,
      s.inventory_date,
      i.product_id,
      i.product_name,
      i.category,
      i.unit,
      i.difference,
      i.physical_stock,
      i.fudo_stock,
      case
        when i.loss_amount::text <> 'NaN' and coalesce(i.loss_amount, 0) > 0 then i.loss_amount
        when i.physical_stock < i.fudo_stock then (i.fudo_stock - i.physical_stock) * coalesce(i.unit_price_at_time, 0)
        else 0
      end as historical_loss
    from filtered_sessions s
    join public.inventory_items i on i.inventory_session_id = s.id
  ),
  summary as (
    select
      (select count(*) from filtered_sessions)::bigint as inventories,
      count(*)::bigint as total_products,
      count(*) filter (where difference <> 0)::bigint as products_with_differences,
      coalesce(sum(historical_loss), 0)::numeric as total_loss
    from filtered_items
  ),
  available_range as (
    select
      to_char((min(inventory_date) at time zone 'America/Santiago')::date, 'YYYY-MM-DD') as start_date,
      to_char((max(inventory_date) at time zone 'America/Santiago')::date, 'YYYY-MM-DD') as end_date
    from accessible_sessions
  ),
  latest_session as (
    select *
    from filtered_sessions
    order by inventory_date desc, id desc
    limit 1
  ),
  latest_payload as (
    select
      jsonb_build_object(
        'id', l.id,
        'submitted_at', l.inventory_date,
        'user_name', l.user_name,
        'shift', l.shift,
        'area_id', l.area_id,
        'area_name', l.area_name
      ) || case
        when v_is_admin then jsonb_build_object(
          'total_loss', coalesce((select sum(fi.historical_loss) from filtered_items fi where fi.session_id = l.id), 0)
        )
        else '{}'::jsonb
      end as value
    from latest_session l
  ),
  top_groups as (
    select
      fi.area_id,
      fi.area_name,
      coalesce(fi.product_id::text, 'legacy:' || md5(concat_ws('|', fi.area_id::text, lower(trim(fi.product_name)), lower(trim(fi.category))))) as product_key,
      (array_agg(fi.product_name order by fi.inventory_date desc, fi.session_id desc))[1] as product_name,
      (array_agg(fi.category order by fi.inventory_date desc, fi.session_id desc))[1] as category,
      (array_agg(fi.unit order by fi.inventory_date desc, fi.session_id desc))[1] as unit,
      sum(fi.fudo_stock - fi.physical_stock)::numeric as missing_quantity,
      sum(fi.historical_loss)::numeric as total_loss
    from filtered_items fi
    where v_is_admin
      and fi.physical_stock < fi.fudo_stock
    group by fi.area_id, fi.area_name,
      coalesce(fi.product_id::text, 'legacy:' || md5(concat_ws('|', fi.area_id::text, lower(trim(fi.product_name)), lower(trim(fi.category)))))
    having sum(fi.fudo_stock - fi.physical_stock) > 0
    order by missing_quantity desc, product_key
    limit 10
  ),
  top_payload as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', product_key,
          'product_name', product_name,
          'category', category,
          'unit', unit,
          'area_id', area_id,
          'area_name', area_name,
          'missing_quantity', missing_quantity,
          'total_loss', total_loss
        )
        order by missing_quantity desc, product_key
      ),
      '[]'::jsonb
    ) as value
    from top_groups
  )
  select
    jsonb_build_object(
      'inventories', summary.inventories,
      'total_products', summary.total_products,
      'products_with_differences', summary.products_with_differences,
      'available_start_date', available_range.start_date,
      'available_end_date', available_range.end_date,
      'latest_inventory', coalesce((select value from latest_payload), 'null'::jsonb),
      'top_missing', case when v_is_admin then top_payload.value else '[]'::jsonb end
    ) || case
      when v_is_admin then jsonb_build_object('total_loss', summary.total_loss)
      else '{}'::jsonb
    end
  into v_result
  from summary
  cross join available_range
  cross join top_payload;

  return v_result;
end;
$$;

create or replace function public.get_inventory_history_page(
  p_start_date date default null,
  p_end_date date default null,
  p_area_id uuid default null,
  p_user_name text default null,
  p_page integer default 0,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_is_admin boolean;
  v_user_area_id uuid;
  v_effective_area_id uuid;
  v_page integer := greatest(coalesce(p_page, 0), 0);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_offset bigint;
  v_result jsonb;
begin
  if auth.uid() is null or not public.current_user_active() then
    raise exception 'Usuario no autenticado o inactivo' using errcode = '42501';
  end if;

  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'La fecha de inicio no puede ser posterior a la fecha de termino' using errcode = '22007';
  end if;

  v_is_admin := public.is_admin();
  v_user_area_id := public.current_user_area_id();

  if v_is_admin then
    v_effective_area_id := p_area_id;
  else
    if v_user_area_id is null then
      raise exception 'El usuario no tiene un area activa asignada' using errcode = '42501';
    end if;
    if p_area_id is not null and p_area_id <> v_user_area_id then
      raise exception 'No autorizado para consultar otra area' using errcode = '42501';
    end if;
    v_effective_area_id := v_user_area_id;
  end if;

  v_offset := v_page::bigint * v_page_size;

  with base_sessions as materialized (
    select
      s.id,
      s.user_name,
      s.area_id,
      a.name as area_name,
      s.shift,
      s.submitted_at,
      coalesce(s.submitted_at, s.created_at) as inventory_date
    from public.inventory_sessions s
    left join public.areas a on a.id = s.area_id
    where s.status = 'submitted'::public.inventory_status
      and (v_effective_area_id is null or s.area_id = v_effective_area_id)
      and (p_start_date is null or coalesce(s.submitted_at, s.created_at) >= (p_start_date::timestamp at time zone 'America/Santiago'))
      and (p_end_date is null or coalesce(s.submitted_at, s.created_at) < ((p_end_date + 1)::timestamp at time zone 'America/Santiago'))
  ),
  filtered_sessions as materialized (
    select *
    from base_sessions
    where nullif(trim(p_user_name), '') is null or user_name = p_user_name
  ),
  page_sessions as materialized (
    select *
    from filtered_sessions
    order by inventory_date desc, id desc
    limit v_page_size
    offset v_offset
  ),
  item_summary as (
    select
      i.inventory_session_id,
      count(*)::bigint as total_products,
      count(*) filter (where i.difference <> 0)::bigint as products_with_differences,
      coalesce(sum(i.difference), 0)::numeric as total_difference,
      coalesce(sum(
        case
          when i.loss_amount::text <> 'NaN' and coalesce(i.loss_amount, 0) > 0 then i.loss_amount
          when i.physical_stock < i.fudo_stock then (i.fudo_stock - i.physical_stock) * coalesce(i.unit_price_at_time, 0)
          else 0
        end
      ), 0)::numeric as total_loss
    from public.inventory_items i
    join page_sessions s on s.id = i.inventory_session_id
    group by i.inventory_session_id
  ),
  records_payload as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'submitted_at', s.inventory_date,
          'user_name', s.user_name,
          'area_id', s.area_id,
          'area_name', s.area_name,
          'shift', s.shift,
          'total_products', coalesce(i.total_products, 0),
          'products_with_differences', coalesce(i.products_with_differences, 0),
          'total_difference', coalesce(i.total_difference, 0)
        ) || case
          when v_is_admin then jsonb_build_object('total_loss', coalesce(i.total_loss, 0))
          else '{}'::jsonb
        end
        order by s.inventory_date desc, s.id desc
      ),
      '[]'::jsonb
    ) as value
    from page_sessions s
    left join item_summary i on i.inventory_session_id = s.id
  ),
  users_payload as (
    select coalesce(jsonb_agg(user_name order by user_name), '[]'::jsonb) as value
    from (
      select distinct user_name
      from base_sessions
      where v_page = 0
        and nullif(trim(user_name), '') is not null
    ) users
  ),
  totals as (
    select count(*)::bigint as total from filtered_sessions
  )
  select jsonb_build_object(
    'records', records_payload.value,
    'total', totals.total,
    'has_more', v_offset + v_page_size < totals.total,
    'user_names', users_payload.value
  )
  into v_result
  from records_payload
  cross join users_payload
  cross join totals;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_inventory_metrics(date, date, uuid) from public;
revoke all on function public.get_dashboard_inventory_metrics(date, date, uuid) from anon;
revoke all on function public.get_dashboard_inventory_metrics(date, date, uuid) from authenticated;
revoke all on function public.get_dashboard_inventory_metrics(date, date, uuid) from service_role;
revoke all on function public.get_inventory_history_page(date, date, uuid, text, integer, integer) from public;
revoke all on function public.get_inventory_history_page(date, date, uuid, text, integer, integer) from anon;
revoke all on function public.get_inventory_history_page(date, date, uuid, text, integer, integer) from authenticated;
revoke all on function public.get_inventory_history_page(date, date, uuid, text, integer, integer) from service_role;

grant execute on function public.get_dashboard_inventory_metrics(date, date, uuid) to authenticated;
grant execute on function public.get_inventory_history_page(date, date, uuid, text, integer, integer) to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.get_dashboard_inventory_metrics(date,date,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_inventory_history_page(date,date,uuid,text,integer,integer)', 'EXECUTE') then
    raise exception 'Validacion RPC fallida: anon conserva permiso EXECUTE';
  end if;

  if not has_function_privilege('authenticated', 'public.get_dashboard_inventory_metrics(date,date,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_inventory_history_page(date,date,uuid,text,integer,integer)', 'EXECUTE') then
    raise exception 'Validacion RPC fallida: authenticated no tiene permiso EXECUTE';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_dashboard_inventory_metrics', 'get_inventory_history_page')
      and p.prosecdef
  ) then
    raise exception 'Validacion RPC fallida: las funciones deben ser SECURITY INVOKER';
  end if;
end $$;

comment on function public.get_dashboard_inventory_metrics(date, date, uuid)
is 'Metricas agregadas del dashboard con restricciones multi-area y campos monetarios exclusivos para administradores.';

comment on function public.get_inventory_history_page(date, date, uuid, text, integer, integer)
is 'Pagina agregada del historial sin transferir inventory_items completos; respeta RLS y restricciones multi-area.';
