-- Temporal solo para desarrollo local.
-- Permite que la anon key del frontend haga select/insert/update/delete.
-- No usar en produccion.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.products to anon, authenticated;
grant select, insert, update, delete on table public.profiles to anon, authenticated;
grant select, insert, update, delete on table public.inventory_sessions to anon, authenticated;
grant select, insert, update, delete on table public.inventory_items to anon, authenticated;

alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "dev anon all products" on public.products;
create policy "dev anon all products"
on public.products
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev anon all profiles" on public.profiles;
create policy "dev anon all profiles"
on public.profiles
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev anon all inventory sessions" on public.inventory_sessions;
create policy "dev anon all inventory sessions"
on public.inventory_sessions
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev anon all inventory items" on public.inventory_items;
create policy "dev anon all inventory items"
on public.inventory_items
for all
to anon, authenticated
using (true)
with check (true);
