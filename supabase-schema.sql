create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  seller_name text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  seller_name text not null,
  title text not null,
  description text not null,
  price numeric(10, 2) not null check (price >= 0),
  category text not null default 'Other',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.items enable row level security;

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

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "listing images are public readable" on storage.objects;
create policy "listing images are public readable"
on storage.objects
for select
using (bucket_id = 'listing-images');

drop policy if exists "sellers upload own listing images" on storage.objects;
create policy "sellers upload own listing images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "sellers update own listing images" on storage.objects;
create policy "sellers update own listing images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "sellers delete own listing images" on storage.objects;
create policy "sellers delete own listing images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
