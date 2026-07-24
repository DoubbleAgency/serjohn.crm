-- 02 — Stock de carros + view pública para o site
-- Idempotente.

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  marca text not null default '',
  modelo text not null default '',
  versao text,
  ano int,
  km int,
  combustivel text,
  caixa text check (caixa is null or caixa in ('Manual','Automática')),
  cor text,
  preco numeric,
  preco_promo numeric,
  matricula text,
  estado text not null default 'Disponível' check (estado in ('Disponível','Reservado','Vendido')),
  destaque boolean not null default false,
  descricao text,
  fotos jsonb not null default '[]'::jsonb,
  link_drive text,
  mobile_de_url text,
  notion_id text unique,           -- id da página Notion de origem (mantém links ?carro= antigos)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists cars_updated_at on public.cars;
create trigger cars_updated_at before update on public.cars
  for each row execute function public.set_updated_at();

alter table public.cars enable row level security;

-- Equipa autenticada e ativa lê tudo
drop policy if exists "cars_select_team" on public.cars;
create policy "cars_select_team" on public.cars
  for select to authenticated
  using (public.is_ativo());

-- Só stock/admin escrevem
drop policy if exists "cars_write_stock_admin" on public.cars;
create policy "cars_write_stock_admin" on public.cars
  for all to authenticated
  using (public.papel() in ('admin','stock'))
  with check (public.papel() in ('admin','stock'));

-- View pública que o site consome (sem matrícula nem URLs internos).
-- security definer de propósito: o anon só vê estas colunas, nunca a tabela.
create or replace view public.v_stock_publico as
  select id, notion_id, marca, modelo, versao, ano, km, combustivel, caixa, cor,
         preco, preco_promo, estado, destaque, descricao, fotos, created_at
  from public.cars
  where estado in ('Disponível','Reservado','Vendido');

revoke all on public.cars from anon;
grant select on public.v_stock_publico to anon;
grant select on public.v_stock_publico to authenticated;
