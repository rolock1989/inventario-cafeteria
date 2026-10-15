-- Optimizacion de rendimiento para Inventario Cafe v1.2 Multi-area.
-- Revisar y ejecutar manualmente en Supabase SQL Editor.
-- No elimina ni modifica datos existentes.
-- CREATE INDEX CONCURRENTLY reduce bloqueos de escritura en produccion.
-- Ejecutar fuera de una transaccion explicita (sin BEGIN/COMMIT).

-- Historial general: status + fecha, ordenado desde el envio mas reciente.
create index concurrently if not exists inventory_sessions_submitted_status_date_idx
on public.inventory_sessions (status, submitted_at desc)
where status = 'submitted';

-- Historial filtrado por area y fecha.
create index concurrently if not exists inventory_sessions_submitted_area_date_idx
on public.inventory_sessions (area_id, submitted_at desc)
where status = 'submitted';

-- Historial filtrado por responsable y fecha.
create index concurrently if not exists inventory_sessions_submitted_user_name_date_idx
on public.inventory_sessions (user_name, submitted_at desc)
where status = 'submitted';

-- Recuperacion del ultimo borrador de un usuario dentro de un area.
create index concurrently if not exists inventory_sessions_draft_user_area_created_idx
on public.inventory_sessions (user_id, area_id, created_at desc)
where status = 'draft';

-- Carga de items por sesion. Puede existir desde schema.sql; se mantiene idempotente.
create index concurrently if not exists inventory_items_session_idx
on public.inventory_items (inventory_session_id);

-- Catalogos filtrados por area y estado, ordenados por nombre.
create index concurrently if not exists products_area_active_name_idx
on public.products (area_id, active, name);

create index concurrently if not exists categories_area_active_name_idx
on public.categories (area_id, active, name);

-- Perfiles usados por asignacion de area y estado.
create index concurrently if not exists profiles_area_active_idx
on public.profiles (area_id, active);

-- Las funciones SECURITY DEFINER actuales consultan profiles por su clave primaria id.
-- Esa clave ya esta indexada; no se requiere un indice adicional para is_admin(),
-- current_user_active() ni current_user_area_id().
