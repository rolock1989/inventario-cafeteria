-- Diagnostico de rendimiento para public.get_dashboard_inventory_metrics.
-- Este archivo NO es una migracion y no modifica datos, funciones, indices ni RLS.
-- Ejecutar manualmente en Supabase SQL Editor y compartir la salida completa.
--
-- Antes de ejecutar:
-- 1. Reemplazar REEMPLAZAR_UUID_USUARIO por el UUID del usuario medido en Chrome.
-- 2. Reemplazar los parametros de cada bloque:
--      null::date              por date '2026-01-01', si corresponde.
--      null::uuid              por 'UUID_AREA'::uuid, si corresponde.
-- 3. Probar primero con los mismos filtros que produjeron los 6,88 segundos.
-- 4. EXPLAIN ANALYZE ejecuta las consultas SELECT, pero no escribe informacion.

begin;

select set_config('request.jwt.claim.sub', 'REEMPLAZAR_UUID_USUARIO', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'REEMPLAZAR_UUID_USUARIO',
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;
set local statement_timeout = '120s';

-- Verificacion del contexto. Debe devolver active=true y los mismos rol/area
-- que usa la aplicacion. Si no coincide, detenerse y corregir el UUID.
select
  auth.uid() as authenticated_user_id,
  public.current_user_active() as active,
  public.is_admin() as is_admin,
  public.current_user_area_id() as user_area_id;

-- D1. Tiempo PostgreSQL de la RPC completa.
-- El nodo Result no muestra el plan interno de PL/pgSQL, pero Execution Time
-- permite comparar tiempo de base de datos con los 6,88 s medidos en Chrome.
explain (analyze, buffers, verbose, settings, timing, summary)
select public.get_dashboard_inventory_metrics(
  null::date, -- fecha inicial
  null::date, -- fecha final
  null::uuid  -- area; null significa todas para admin
);

-- D2. Sesiones accesibles y filtradas. Aisla filtros, fecha, area, RLS de
-- inventory_sessions y la union con areas, sin leer inventory_items.
explain (analyze, buffers, verbose, settings, timing, summary)
with params as materialized (
  select
    null::date as start_date,
    null::date as end_date,
    null::uuid as requested_area_id
),
security_context as materialized (
  select
    public.is_admin() as is_admin,
    public.current_user_area_id() as user_area_id
),
effective_context as materialized (
  select
    sc.is_admin,
    case when sc.is_admin then p.requested_area_id else sc.user_area_id end as area_id,
    p.start_date,
    p.end_date
  from params p
  cross join security_context sc
)
select
  count(*) as inventories,
  count(a.name) as inventories_with_visible_area,
  min(coalesce(s.submitted_at, s.created_at)) as first_inventory,
  max(coalesce(s.submitted_at, s.created_at)) as last_inventory
from public.inventory_sessions s
left join public.areas a on a.id = s.area_id
cross join effective_context c
where s.status = 'submitted'::public.inventory_status
  and (c.area_id is null or s.area_id = c.area_id)
  and (c.start_date is null or coalesce(s.submitted_at, s.created_at) >= (c.start_date::timestamp at time zone 'America/Santiago'))
  and (c.end_date is null or coalesce(s.submitted_at, s.created_at) < ((c.end_date + 1)::timestamp at time zone 'America/Santiago'));

-- D3. Estadisticas generales sin Top 10 ni array_agg. Mide el costo minimo
-- inevitable de leer los items y conservar los calculos historicos actuales.
explain (analyze, buffers, verbose, settings, timing, summary)
with params as materialized (
  select
    null::date as start_date,
    null::date as end_date,
    null::uuid as requested_area_id
),
security_context as materialized (
  select
    public.is_admin() as is_admin,
    public.current_user_area_id() as user_area_id
),
effective_context as materialized (
  select
    sc.is_admin,
    case when sc.is_admin then p.requested_area_id else sc.user_area_id end as area_id,
    p.start_date,
    p.end_date
  from params p
  cross join security_context sc
),
filtered_sessions as materialized (
  select
    s.id,
    coalesce(s.submitted_at, s.created_at) as inventory_date
  from public.inventory_sessions s
  cross join effective_context c
  where s.status = 'submitted'::public.inventory_status
    and (c.area_id is null or s.area_id = c.area_id)
    and (c.start_date is null or coalesce(s.submitted_at, s.created_at) >= (c.start_date::timestamp at time zone 'America/Santiago'))
    and (c.end_date is null or coalesce(s.submitted_at, s.created_at) < ((c.end_date + 1)::timestamp at time zone 'America/Santiago'))
)
select
  (select count(*) from filtered_sessions)::bigint as inventories,
  count(*)::bigint as total_products,
  count(*) filter (where i.difference <> 0)::bigint as products_with_differences,
  coalesce(sum(
    case
      when i.loss_amount::text <> 'NaN' and coalesce(i.loss_amount, 0) > 0 then i.loss_amount
      when i.physical_stock < i.fudo_stock then (i.fudo_stock - i.physical_stock) * coalesce(i.unit_price_at_time, 0)
      else 0
    end
  ), 0)::numeric as total_loss
from filtered_sessions s
join public.inventory_items i on i.inventory_session_id = s.id;

-- D4. Top 10 exacto actual. Aisla agrupacion, md5, ordenamientos internos
-- de array_agg y ordenamiento final. Para trabajadores debe mostrar un
-- One-Time Filter falso o cero filas, porque el Top 10 no se entrega.
explain (analyze, buffers, verbose, settings, timing, summary)
with params as materialized (
  select
    null::date as start_date,
    null::date as end_date,
    null::uuid as requested_area_id
),
security_context as materialized (
  select
    public.is_admin() as is_admin,
    public.current_user_area_id() as user_area_id
),
effective_context as materialized (
  select
    sc.is_admin,
    case when sc.is_admin then p.requested_area_id else sc.user_area_id end as area_id,
    p.start_date,
    p.end_date
  from params p
  cross join security_context sc
),
filtered_items as materialized (
  select
    s.id as session_id,
    s.area_id,
    a.name as area_name,
    coalesce(s.submitted_at, s.created_at) as inventory_date,
    i.product_id,
    i.product_name,
    i.category,
    i.unit,
    i.physical_stock,
    i.fudo_stock,
    case
      when i.loss_amount::text <> 'NaN' and coalesce(i.loss_amount, 0) > 0 then i.loss_amount
      when i.physical_stock < i.fudo_stock then (i.fudo_stock - i.physical_stock) * coalesce(i.unit_price_at_time, 0)
      else 0
    end as historical_loss
  from public.inventory_sessions s
  join public.inventory_items i on i.inventory_session_id = s.id
  left join public.areas a on a.id = s.area_id
  cross join effective_context c
  where c.is_admin
    and s.status = 'submitted'::public.inventory_status
    and (c.area_id is null or s.area_id = c.area_id)
    and (c.start_date is null or coalesce(s.submitted_at, s.created_at) >= (c.start_date::timestamp at time zone 'America/Santiago'))
    and (c.end_date is null or coalesce(s.submitted_at, s.created_at) < ((c.end_date + 1)::timestamp at time zone 'America/Santiago'))
)
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
where fi.physical_stock < fi.fudo_stock
group by
  fi.area_id,
  fi.area_name,
  coalesce(fi.product_id::text, 'legacy:' || md5(concat_ws('|', fi.area_id::text, lower(trim(fi.product_name)), lower(trim(fi.category)))))
having sum(fi.fudo_stock - fi.physical_stock) > 0
order by missing_quantity desc, product_key
limit 10;

-- D5. Control del Top 10 sin los tres array_agg ordenados. La diferencia
-- D4 - D5 estima el costo de escoger nombre/categoria/unidad dentro de cada
-- grupo. Conserva agrupacion, cantidad faltante y perdida para comparacion.
explain (analyze, buffers, verbose, settings, timing, summary)
with params as materialized (
  select
    null::date as start_date,
    null::date as end_date,
    null::uuid as requested_area_id
),
security_context as materialized (
  select
    public.is_admin() as is_admin,
    public.current_user_area_id() as user_area_id
),
effective_context as materialized (
  select
    sc.is_admin,
    case when sc.is_admin then p.requested_area_id else sc.user_area_id end as area_id,
    p.start_date,
    p.end_date
  from params p
  cross join security_context sc
)
select
  s.area_id,
  coalesce(i.product_id::text, 'legacy:' || md5(concat_ws('|', s.area_id::text, lower(trim(i.product_name)), lower(trim(i.category))))) as product_key,
  sum(i.fudo_stock - i.physical_stock)::numeric as missing_quantity,
  sum(
    case
      when i.loss_amount::text <> 'NaN' and coalesce(i.loss_amount, 0) > 0 then i.loss_amount
      when i.physical_stock < i.fudo_stock then (i.fudo_stock - i.physical_stock) * coalesce(i.unit_price_at_time, 0)
      else 0
    end
  )::numeric as total_loss
from public.inventory_sessions s
join public.inventory_items i on i.inventory_session_id = s.id
cross join effective_context c
where c.is_admin
  and s.status = 'submitted'::public.inventory_status
  and i.physical_stock < i.fudo_stock
  and (c.area_id is null or s.area_id = c.area_id)
  and (c.start_date is null or coalesce(s.submitted_at, s.created_at) >= (c.start_date::timestamp at time zone 'America/Santiago'))
  and (c.end_date is null or coalesce(s.submitted_at, s.created_at) < ((c.end_date + 1)::timestamp at time zone 'America/Santiago'))
group by
  s.area_id,
  coalesce(i.product_id::text, 'legacy:' || md5(concat_ws('|', s.area_id::text, lower(trim(i.product_name)), lower(trim(i.category)))))
having sum(i.fudo_stock - i.physical_stock) > 0
order by missing_quantity desc, product_key
limit 10;

rollback;

-- D6 opcional: comparacion controlada sin RLS.
-- Ejecutar en una consulta separada solamente despues de D1-D5. Esta prueba
-- no modifica ni desactiva politicas: usa el rol propietario del SQL Editor y
-- replica explicitamente los filtros de area/fecha. Reemplazar UUID_AREA_REAL
-- por el area efectiva del usuario; para un admin que consulta todas las areas,
-- eliminar la condicion s.area_id = ....
--
-- begin;
-- set local statement_timeout = '120s';
-- explain (analyze, buffers, verbose, settings, timing, summary)
-- select
--   count(*)::bigint as total_products,
--   count(*) filter (where i.difference <> 0)::bigint as products_with_differences,
--   coalesce(sum(
--     case
--       when i.loss_amount::text <> 'NaN' and coalesce(i.loss_amount, 0) > 0 then i.loss_amount
--       when i.physical_stock < i.fudo_stock then (i.fudo_stock - i.physical_stock) * coalesce(i.unit_price_at_time, 0)
--       else 0
--     end
--   ), 0)::numeric as total_loss
-- from public.inventory_sessions s
-- join public.inventory_items i on i.inventory_session_id = s.id
-- where s.status = 'submitted'::public.inventory_status
--   and s.area_id = 'UUID_AREA_REAL'::uuid
--   and (null::date is null or coalesce(s.submitted_at, s.created_at) >= (null::date::timestamp at time zone 'America/Santiago'))
--   and (null::date is null or coalesce(s.submitted_at, s.created_at) < ((null::date + 1)::timestamp at time zone 'America/Santiago'));
-- rollback;
