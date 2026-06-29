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
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'trabajador',
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
  shift text not null default 'Sin turno',
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
create index if not exists inventory_sessions_user_idx on public.inventory_sessions(user_id);
create index if not exists inventory_sessions_submitted_at_idx on public.inventory_sessions(submitted_at);
create index if not exists inventory_items_session_idx on public.inventory_items(inventory_session_id);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "Demo anon can manage profiles" on public.profiles;
drop policy if exists "Demo anon can manage products" on public.products;
drop policy if exists "Demo anon can manage inventory sessions" on public.inventory_sessions;
drop policy if exists "Demo anon can manage inventory items" on public.inventory_items;
drop policy if exists "dev anon all profiles" on public.profiles;
drop policy if exists "dev anon all products" on public.products;
drop policy if exists "dev anon all inventory sessions" on public.inventory_sessions;
drop policy if exists "dev anon all inventory items" on public.inventory_items;

drop policy if exists "Profiles can read own profile" on public.profiles;
drop policy if exists "Admins can read every profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

create policy "Profiles can read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Admins can read every profile"
on public.profiles for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  )
);

create policy "Admins can update profiles"
on public.profiles for update
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

drop policy if exists "Authenticated users can read active products" on public.products;
drop policy if exists "Admins can manage products" on public.products;

create policy "Authenticated users can read active products"
on public.products for select
to authenticated
using (
  active = true
  or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  )
);

create policy "Admins can manage products"
on public.products for all
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

drop policy if exists "Users can create own inventories" on public.inventory_sessions;
drop policy if exists "Users can read own inventories" on public.inventory_sessions;
drop policy if exists "Admins can read all inventories" on public.inventory_sessions;

create policy "Users can create own inventories"
on public.inventory_sessions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can read own inventories"
on public.inventory_sessions for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can read all inventories"
on public.inventory_sessions for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  )
);

drop policy if exists "Users can manage items from own inventories" on public.inventory_items;
drop policy if exists "Users can read items from visible inventories" on public.inventory_items;

create policy "Users can read items from visible inventories"
on public.inventory_items for select
to authenticated
using (
  exists (
    select 1 from public.inventory_sessions
    where inventory_sessions.id = inventory_items.inventory_session_id
    and (
      inventory_sessions.user_id = auth.uid()
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin' and active = true
      )
    )
  )
);

create policy "Users can manage items from own inventories"
on public.inventory_items for insert
to authenticated
with check (
  exists (
    select 1 from public.inventory_sessions
    where inventory_sessions.id = inventory_items.inventory_session_id
    and inventory_sessions.user_id = auth.uid()
  )
);
