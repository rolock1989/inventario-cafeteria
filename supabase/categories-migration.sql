-- Migracion de categorias para Inventario Cafe.
-- Ejecutar en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists category_id uuid references public.categories(id) on delete restrict;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'category'
  ) then
    alter table public.products alter column category drop not null;

    insert into public.categories (name, active)
    select distinct trim(category), true
    from public.products
    where category is not null
      and trim(category) <> ''
    on conflict (name) do nothing;

    update public.products
    set category_id = categories.id
    from public.categories
    where products.category_id is null
      and products.category is not null
      and trim(products.category) = categories.name;
  end if;
end $$;

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists categories_active_idx on public.categories(active);

alter table public.categories enable row level security;

drop policy if exists "Authenticated users can read active categories" on public.categories;
drop policy if exists "Admins can manage categories" on public.categories;

create policy "Authenticated users can read active categories"
on public.categories for select
to authenticated
using (
  active = true
  or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  )
);

create policy "Admins can manage categories"
on public.categories for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  )
);

-- Politicas temporales de desarrollo, solo si necesitas probar con anon sin Auth.
-- No ejecutar en produccion.
-- grant select, insert, update, delete on table public.categories to anon, authenticated;
-- drop policy if exists "dev anon all categories" on public.categories;
-- create policy "dev anon all categories"
-- on public.categories for all
-- to anon, authenticated
-- using (true)
-- with check (true);
