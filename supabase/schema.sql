create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('admin', 'trabajador');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.inventory_status as enum ('draft', 'submitted');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'trabajador',
  shift text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  status public.inventory_status not null default 'draft',
  user_id uuid references public.profiles(id) on delete set null,
  user_name text not null,
  user_email text,
  shift text not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  inventory_session_id uuid not null references public.inventory_sessions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  category text not null,
  unit text not null,
  physical_stock numeric not null default 0,
  fudo_stock numeric not null default 0,
  difference numeric generated always as (physical_stock - fudo_stock) stored,
  comment text
);

create index if not exists products_active_idx on public.products(active);
create index if not exists profiles_active_idx on public.profiles(active);
create index if not exists inventory_sessions_submitted_at_idx on public.inventory_sessions(submitted_at);
create index if not exists inventory_items_session_idx on public.inventory_items(inventory_session_id);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "Profiles can read own profile" on public.profiles;
drop policy if exists "Admins can read every profile" on public.profiles;
drop policy if exists "Authenticated users can read active products" on public.products;
drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Users can create own inventories" on public.inventory_sessions;
drop policy if exists "Users can read own inventories" on public.inventory_sessions;
drop policy if exists "Admins can read all inventories" on public.inventory_sessions;
drop policy if exists "Users can manage items from own inventories" on public.inventory_items;

-- Demo policies for the current version without Supabase Auth.
-- They allow the browser anon key to persist data. Replace these with
-- authenticated admin/trabajador policies before production use.
drop policy if exists "Demo anon can manage profiles" on public.profiles;
create policy "Demo anon can manage profiles"
on public.profiles for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Demo anon can manage products" on public.products;
create policy "Demo anon can manage products"
on public.products for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Demo anon can manage inventory sessions" on public.inventory_sessions;
create policy "Demo anon can manage inventory sessions"
on public.inventory_sessions for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Demo anon can manage inventory items" on public.inventory_items;
create policy "Demo anon can manage inventory items"
on public.inventory_items for all
to anon, authenticated
using (true)
with check (true);

insert into public.profiles (name, email, role, shift, active)
values
  ('Camila Reyes', 'admin@inventariocafe.cl', 'admin', 'Administracion', true),
  ('Mateo Silva', 'trabajador@inventariocafe.cl', 'trabajador', 'Turno manana', true)
on conflict (email) do nothing;

insert into public.products (name, category, unit, active)
values
  ('Cafe espresso blend', 'Cafe', 'kg', true),
  ('Leche entera', 'Lacteos', 'litros', true),
  ('Bebida de avena', 'Bebidas vegetales', 'litros', true),
  ('Azucar rubia', 'Insumos', 'kg', true),
  ('Croissant mantequilla', 'Pasteleria', 'unidades', true),
  ('Vasos compostables 12 oz', 'Packaging', 'unidades', true)
on conflict do nothing;
