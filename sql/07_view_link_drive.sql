-- 07 — Expor link_drive na view pública (pastas Drive já são públicas por natureza).
-- O site usa-o como fallback para extrair fotos de carros migrados sem fotos próprias.

drop view if exists public.v_stock_publico;
create view public.v_stock_publico
  with (security_invoker = true) as
  select id, notion_id, marca, modelo, versao, ano, km, combustivel, caixa, cor,
         preco, preco_promo, estado, destaque, descricao, fotos, link_drive, created_at
  from public.cars
  where estado in ('Disponível','Reservado','Vendido');

grant select (link_drive) on public.cars to anon;
grant select on public.v_stock_publico to anon, authenticated;
