create type public.user_role as enum ('admin', 'trabajador');
create type public.inventory_status as enum ('draft', 'submitted');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'trabajador',
  shift text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventories (
  id uuid primary key default gen_random_uuid(),
  status public.inventory_status not null default 'draft',
  user_id uuid not null references public.profiles(id),
  shift text not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  product_id uuid not null references public.products(id),
  physical_stock numeric not null default 0,
  fudo_stock numeric not null default 0,
  difference numeric generated always as (physical_stock - fudo_stock) stored,
  comment text
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventories enable row level security;
alter table public.inventory_items enable row level security;

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
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Authenticated users can read active products"
on public.products for select
to authenticated
using (active = true);

create policy "Admins can manage products"
on public.products for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Users can create own inventories"
on public.inventories for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can read own inventories"
on public.inventories for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can read all inventories"
on public.inventories for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

create policy "Users can manage items from own inventories"
on public.inventory_items for all
to authenticated
using (
  exists (
    select 1 from public.inventories
    where inventories.id = inventory_items.inventory_id
    and inventories.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.inventories
    where inventories.id = inventory_items.inventory_id
    and inventories.user_id = auth.uid()
  )
);
