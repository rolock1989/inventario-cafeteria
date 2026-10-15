-- Verificacion manual de las RPC. Este archivo no es una migracion.
-- Sustituir los UUID marcados antes de ejecutar en un entorno de prueba.
-- Todas las consultas son de solo lectura; ROLLBACK restaura el contexto local.

begin;

-- Caso administrador activo.
select set_config('request.jwt.claim.sub', 'REEMPLAZAR_UUID_ADMIN', true);
set local role authenticated;

select public.get_dashboard_inventory_metrics(null, null, null) as dashboard_admin;
select public.get_inventory_history_page(null, null, null, null, 0, 20) as historial_admin;

-- La primera pagina debe coincidir con el orden estable de la consulta anterior.
with old_page as (
  select coalesce(jsonb_agg(id order by inventory_date desc, id desc), '[]'::jsonb) as ids
  from (
    select id, coalesce(submitted_at, created_at) as inventory_date
    from public.inventory_sessions
    where status = 'submitted'::public.inventory_status
    order by coalesce(submitted_at, created_at) desc, id desc
    limit 20
  ) sessions
),
rpc_page as (
  select public.get_inventory_history_page(null, null, null, null, 0, 20) as value
)
select
  old_page.ids as old_ids,
  (select coalesce(jsonb_agg(record -> 'id'), '[]'::jsonb) from jsonb_array_elements(rpc_page.value -> 'records') record) as rpc_ids
from old_page
cross join rpc_page;

-- Comparacion de totales antiguos con la RPC para el mismo usuario y sin filtros.
with old_totals as (
  select
    count(distinct s.id)::bigint as inventories,
    count(i.id)::bigint as total_products,
    count(i.id) filter (where i.difference <> 0)::bigint as products_with_differences,
    coalesce(sum(
      case
        when i.loss_amount::text <> 'NaN' and coalesce(i.loss_amount, 0) > 0 then i.loss_amount
        when i.physical_stock < i.fudo_stock then (i.fudo_stock - i.physical_stock) * coalesce(i.unit_price_at_time, 0)
        else 0
      end
    ), 0)::numeric as total_loss
  from public.inventory_sessions s
  left join public.inventory_items i on i.inventory_session_id = s.id
  where s.status = 'submitted'::public.inventory_status
),
rpc as (
  select public.get_dashboard_inventory_metrics(null, null, null) as value
)
select
  old_totals.*,
  (rpc.value ->> 'inventories')::bigint as rpc_inventories,
  (rpc.value ->> 'total_products')::bigint as rpc_total_products,
  (rpc.value ->> 'products_with_differences')::bigint as rpc_products_with_differences,
  (rpc.value ->> 'total_loss')::numeric as rpc_total_loss
from old_totals
cross join rpc;

-- Comparacion del Top 10 por cantidad faltante, agrupado por producto y area.
with old_top as (
  select
    s.area_id,
    coalesce(i.product_id::text, 'legacy:' || md5(concat_ws('|', s.area_id::text, lower(trim(i.product_name)), lower(trim(i.category))))) as product_key,
    sum(i.fudo_stock - i.physical_stock)::numeric as missing_quantity
  from public.inventory_sessions s
  join public.inventory_items i on i.inventory_session_id = s.id
  where s.status = 'submitted'::public.inventory_status
    and i.physical_stock < i.fudo_stock
  group by s.area_id,
    coalesce(i.product_id::text, 'legacy:' || md5(concat_ws('|', s.area_id::text, lower(trim(i.product_name)), lower(trim(i.category)))))
  order by missing_quantity desc, product_key
  limit 10
),
rpc as (
  select public.get_dashboard_inventory_metrics(null, null, null) as value
)
select
  (select jsonb_agg(jsonb_build_object('area_id', area_id, 'key', product_key, 'missing_quantity', missing_quantity) order by missing_quantity desc, product_key) from old_top) as old_top,
  rpc.value -> 'top_missing' as rpc_top
from rpc;

rollback;

-- Repetir en otra transaccion con un UUID de trabajador activo.
-- Confirmar que un area distinta produce error 42501 y que el JSON no contiene:
-- total_loss en la raiz, total_loss en latest_inventory ni elementos en top_missing.
