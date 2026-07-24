-- 05 — Correções dos advisors de segurança
-- Idempotente.

create or replace view public.v_stock_publico
  with (security_invoker = true) as
  select id, notion_id, marca, modelo, versao, ano, km, combustivel, caixa, cor,
         preco, preco_promo, estado, destaque, descricao, fotos, created_at
  from public.cars
  where estado in ('Disponível','Reservado','Vendido');

revoke all on public.cars from anon;
grant select (id, notion_id, marca, modelo, versao, ano, km, combustivel, caixa, cor,
              preco, preco_promo, estado, destaque, descricao, fotos, created_at)
  on public.cars to anon;

drop policy if exists "cars_select_anon_public" on public.cars;
create policy "cars_select_anon_public" on public.cars
  for select to anon
  using (estado in ('Disponível','Reservado','Vendido'));

grant select on public.v_stock_publico to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

revoke execute on function public.crm_on_estado() from anon, authenticated, public;
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.is_ativo() from anon, public;
revoke execute on function public.papel() from anon, public;
revoke execute on function public.registar_tentativa(uuid) from anon, public;

drop policy if exists "car_photos_public_read" on storage.objects;
drop policy if exists "car_photos_team_read" on storage.objects;
create policy "car_photos_team_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'car-photos');
