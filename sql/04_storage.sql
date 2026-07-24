-- 04 — Storage: bucket público de fotos de carros
-- Idempotente.

insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', true)
on conflict (id) do nothing;

-- Leitura pública (o bucket é público, mas a policy garante o GET via API)
drop policy if exists "car_photos_public_read" on storage.objects;
create policy "car_photos_public_read" on storage.objects
  for select to public
  using (bucket_id = 'car-photos');

-- Escrita: stock/admin
drop policy if exists "car_photos_write" on storage.objects;
create policy "car_photos_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'car-photos' and public.papel() in ('admin','stock'));

drop policy if exists "car_photos_update" on storage.objects;
create policy "car_photos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'car-photos' and public.papel() in ('admin','stock'));

drop policy if exists "car_photos_delete" on storage.objects;
create policy "car_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'car-photos' and public.papel() in ('admin','stock'));
