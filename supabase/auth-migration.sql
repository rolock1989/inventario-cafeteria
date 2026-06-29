-- Ejecutar si ya tenias la version anterior de Inventario Cafe.
-- Esta migracion prepara profiles para Supabase Auth real.
-- Importante: crea primero usuarios en Supabase Auth y luego enlaza profiles.id
-- con auth.users.id. Si tienes datos antiguos, respalda antes.

alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Si tu tabla anterior tenia auth_user_id, puedes usarlo para migrar ids:
-- update public.profiles set id = auth_user_id where auth_user_id is not null;
-- Luego ajusta manualmente constraints si tu proyecto ya tenia datos productivos.

alter table public.inventory_sessions add column if not exists user_name text;
alter table public.inventory_sessions add column if not exists user_email text;
alter table public.inventory_sessions add column if not exists shift text not null default 'Sin turno';

-- Despues de alinear profiles.id con auth.users.id, ejecuta supabase/schema.sql
-- para recrear las politicas RLS de Auth.
