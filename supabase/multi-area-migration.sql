-- Migracion v1.2 Multi-area para Inventario Cafe.
-- Revisar y ejecutar manualmente en Supabase SQL Editor.
-- No elimina datos existentes ni modifica valores historicos de inventario.
-- No hace area_id NOT NULL todavia.

create extension if not exists pgcrypto;

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists areas_name_unique_idx
on public.areas (lower(trim(name)));

insert into public.areas (name, active)
select 'Cafetería', true
where not exists (
  select 1 from public.areas where lower(trim(name)) = lower(trim('Cafetería'))
);

insert into public.areas (name, active)
select 'Bodega', true
where not exists (
  select 1 from public.areas where lower(trim(name)) = lower(trim('Bodega'))
);

update public.areas
set active = true
where lower(trim(name)) in (lower(trim('Cafetería')), lower(trim('Bodega')));

alter table public.products add column if not exists area_id uuid references public.areas(id) on delete restrict;
alter table public.categories add column if not exists area_id uuid references public.areas(id) on delete restrict;
alter table public.profiles add column if not exists area_id uuid references public.areas(id) on delete restrict;
alter table public.inventory_sessions add column if not exists area_id uuid references public.areas(id) on delete restrict;

with cafeteria as (
  select id from public.areas where lower(trim(name)) = lower(trim('Cafetería')) limit 1
)
update public.products
set area_id = cafeteria.id
from cafeteria
where products.area_id is null;

with cafeteria as (
  select id from public.areas where lower(trim(name)) = lower(trim('Cafetería')) limit 1
)
update public.categories
set area_id = cafeteria.id
from cafeteria
where categories.area_id is null;

with cafeteria as (
  select id from public.areas where lower(trim(name)) = lower(trim('Cafetería')) limit 1
)
update public.profiles
set area_id = cafeteria.id
from cafeteria
where profiles.area_id is null;

with cafeteria as (
  select id from public.areas where lower(trim(name)) = lower(trim('Cafetería')) limit 1
)
update public.inventory_sessions
set area_id = cafeteria.id
from cafeteria
where inventory_sessions.area_id is null;

do $$
begin
  if exists (
    select 1
    from public.categories
    where area_id is not null
    group by area_id, lower(trim(name))
    having count(*) > 1
  ) then
    raise exception 'No se puede crear categories_area_name_unique_idx: existen categorias duplicadas por area y nombre normalizado. Ejecuta este diagnostico: select area_id, lower(trim(name)) as normalized_name, array_agg(id) as category_ids, array_agg(name) as category_names from public.categories group by area_id, lower(trim(name)) having count(*) > 1;';
  end if;

  if exists (
    select 1
    from public.products
    where area_id is not null
    group by area_id, lower(trim(name))
    having count(*) > 1
  ) then
    raise exception 'No se puede crear products_area_name_unique_idx: existen productos duplicados por area y nombre normalizado. Ejecuta este diagnostico: select area_id, lower(trim(name)) as normalized_name, array_agg(id) as product_ids, array_agg(name) as product_names from public.products group by area_id, lower(trim(name)) having count(*) > 1;';
  end if;
end $$;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attname = 'name'
    where nsp.nspname = 'public'
      and rel.relname = 'categories'
      and con.contype = 'u'
      and con.conkey = array[att.attnum]::smallint[]
  loop
    execute format('alter table public.categories drop constraint %I', constraint_record.conname);
  end loop;

  for constraint_record in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attname = 'name'
    where nsp.nspname = 'public'
      and rel.relname = 'products'
      and con.contype = 'u'
      and con.conkey = array[att.attnum]::smallint[]
  loop
    execute format('alter table public.products drop constraint %I', constraint_record.conname);
  end loop;
end $$;

do $$
declare
  index_record record;
begin
  for index_record in
    select idx.relname as index_name
    from pg_index ind
    join pg_class idx on idx.oid = ind.indexrelid
    join pg_class rel on rel.oid = ind.indrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attname = 'name'
    where nsp.nspname = 'public'
      and rel.relname = 'categories'
      and ind.indisunique
      and not ind.indisprimary
      and ind.indexprs is null
      and ind.indkey::text = att.attnum::text
  loop
    execute format('drop index if exists public.%I', index_record.index_name);
  end loop;

  for index_record in
    select idx.relname as index_name
    from pg_index ind
    join pg_class idx on idx.oid = ind.indexrelid
    join pg_class rel on rel.oid = ind.indrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att on att.attrelid = rel.oid and att.attname = 'name'
    where nsp.nspname = 'public'
      and rel.relname = 'products'
      and ind.indisunique
      and not ind.indisprimary
      and ind.indexprs is null
      and ind.indkey::text = att.attnum::text
  loop
    execute format('drop index if exists public.%I', index_record.index_name);
  end loop;

  for index_record in
    select idx.relname as index_name
    from pg_index ind
    join pg_class idx on idx.oid = ind.indexrelid
    join pg_class rel on rel.oid = ind.indrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'categories'
      and ind.indisunique
      and not ind.indisprimary
      and pg_get_indexdef(idx.oid) ilike '%name%'
      and pg_get_indexdef(idx.oid) not ilike '%area_id%'
  loop
    execute format('drop index if exists public.%I', index_record.index_name);
  end loop;

  for index_record in
    select idx.relname as index_name
    from pg_index ind
    join pg_class idx on idx.oid = ind.indexrelid
    join pg_class rel on rel.oid = ind.indrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'products'
      and ind.indisunique
      and not ind.indisprimary
      and pg_get_indexdef(idx.oid) ilike '%name%'
      and pg_get_indexdef(idx.oid) not ilike '%area_id%'
  loop
    execute format('drop index if exists public.%I', index_record.index_name);
  end loop;
end $$;

drop index if exists public.categories_area_name_unique_idx;
drop index if exists public.products_area_name_unique_idx;

create unique index categories_area_name_unique_idx
on public.categories (area_id, lower(trim(name)));

create unique index products_area_name_unique_idx
on public.products (area_id, lower(trim(name)));

create index if not exists areas_active_idx on public.areas(active);
create index if not exists products_area_id_idx on public.products(area_id);
create index if not exists categories_area_id_idx on public.categories(area_id);
create index if not exists profiles_area_id_idx on public.profiles(area_id);
create index if not exists inventory_sessions_area_id_idx on public.inventory_sessions(area_id);
create index if not exists inventory_sessions_area_submitted_idx on public.inventory_sessions(area_id, submitted_at);

create or replace function public.current_user_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select profiles.active
    from public.profiles
    where profiles.id = auth.uid()
  ), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select profiles.role = 'admin'::public.user_role and profiles.active = true
    from public.profiles
    where profiles.id = auth.uid()
  ), false);
$$;

create or replace function public.current_user_area_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select (
    select profiles.area_id
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.active = true
  );
$$;

revoke all on function public.current_user_active() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.current_user_area_id() from public;

grant execute on function public.current_user_active() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_area_id() to authenticated;

alter table public.areas enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.inventory_items enable row level security;

revoke all on table public.areas from anon;
revoke all on table public.profiles from anon;
revoke all on table public.categories from anon;
revoke all on table public.products from anon;
revoke all on table public.inventory_sessions from anon;
revoke all on table public.inventory_items from anon;

drop policy if exists "Demo anon can manage areas" on public.areas;
drop policy if exists "Demo anon can manage profiles" on public.profiles;
drop policy if exists "Demo anon can manage categories" on public.categories;
drop policy if exists "Demo anon can manage products" on public.products;
drop policy if exists "Demo anon can manage inventory sessions" on public.inventory_sessions;
drop policy if exists "Demo anon can manage inventory items" on public.inventory_items;

drop policy if exists "dev anon all areas" on public.areas;
drop policy if exists "dev anon all profiles" on public.profiles;
drop policy if exists "dev anon all categories" on public.categories;
drop policy if exists "dev anon all products" on public.products;
drop policy if exists "dev anon all inventory sessions" on public.inventory_sessions;
drop policy if exists "dev anon all inventory items" on public.inventory_items;

drop policy if exists "Authenticated users can read active areas" on public.areas;
drop policy if exists "Admins can manage areas" on public.areas;

create policy "Authenticated users can read active areas"
on public.areas for select
to authenticated
using (
  active = true
  and public.current_user_active()
);

create policy "Admins can manage areas"
on public.areas for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Profiles can read own profile" on public.profiles;
drop policy if exists "Admins can read every profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

create policy "Profiles can read own profile"
on public.profiles for select
to authenticated
using (
  auth.uid() = id
  or public.is_admin()
);

create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated users can read active categories" on public.categories;
drop policy if exists "Admins can manage categories" on public.categories;

create policy "Authenticated users can read active categories"
on public.categories for select
to authenticated
using (
  public.current_user_active()
  and (
    public.is_admin()
    or categories.area_id = public.current_user_area_id()
  )
  and (
    categories.active = true
    or public.is_admin()
  )
);

create policy "Admins can manage categories"
on public.categories for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated users can read active products" on public.products;
drop policy if exists "Admins can manage products" on public.products;

create policy "Authenticated users can read active products"
on public.products for select
to authenticated
using (
  public.current_user_active()
  and (
    public.is_admin()
    or products.area_id = public.current_user_area_id()
  )
  and (
    products.active = true
    or public.is_admin()
  )
);

create policy "Admins can manage products"
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can create own inventories" on public.inventory_sessions;
drop policy if exists "Users can read own inventories" on public.inventory_sessions;
drop policy if exists "Users can read visible inventories" on public.inventory_sessions;
drop policy if exists "Admins can read all inventories" on public.inventory_sessions;

create policy "Users can create own inventories"
on public.inventory_sessions for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.current_user_active()
  and (
    public.is_admin()
    or inventory_sessions.area_id = public.current_user_area_id()
  )
);

create policy "Users can read visible inventories"
on public.inventory_sessions for select
to authenticated
using (
  public.current_user_active()
  and (
    public.is_admin()
    or inventory_sessions.area_id = public.current_user_area_id()
  )
);

drop policy if exists "Users can manage items from own inventories" on public.inventory_items;
drop policy if exists "Users can read items from visible inventories" on public.inventory_items;

create policy "Users can read items from visible inventories"
on public.inventory_items for select
to authenticated
using (
  public.current_user_active()
  and exists (
    select 1
    from public.inventory_sessions
    where inventory_sessions.id = inventory_items.inventory_session_id
      and (
        public.is_admin()
        or inventory_sessions.area_id = public.current_user_area_id()
      )
  )
);

create policy "Users can manage items from own inventories"
on public.inventory_items for insert
to authenticated
with check (
  public.current_user_active()
  and exists (
    select 1
    from public.inventory_sessions
    where inventory_sessions.id = inventory_items.inventory_session_id
      and inventory_sessions.user_id = auth.uid()
      and (
        public.is_admin()
        or inventory_sessions.area_id = public.current_user_area_id()
      )
  )
);
