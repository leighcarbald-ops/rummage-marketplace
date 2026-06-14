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
