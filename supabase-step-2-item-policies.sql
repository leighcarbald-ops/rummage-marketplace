drop policy if exists "profiles are public readable" on public.profiles;
create policy "profiles are public readable"
on public.profiles
for select
using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "items are public readable" on public.items;
create policy "items are public readable"
on public.items
for select
using (true);

drop policy if exists "sellers insert own items" on public.items;
create policy "sellers insert own items"
on public.items
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "sellers update own items" on public.items;
create policy "sellers update own items"
on public.items
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "sellers delete own items" on public.items;
create policy "sellers delete own items"
on public.items
for delete
to authenticated
using (auth.uid() = owner_id);
