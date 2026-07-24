-- 01 — Utilizadores e papéis
-- Idempotente. Papéis: admin (dono/gestor), vendedor, stock.

create table if not exists public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  papel text not null default 'vendedor' check (papel in ('admin','vendedor','stock')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.app_users enable row level security;

-- Funções auxiliares (security definer para não recursar no RLS)
create or replace function public.papel()
returns text
language sql stable security definer set search_path = public
as $$
  select papel from public.app_users where id = auth.uid() and ativo
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select papel from public.app_users where id = auth.uid() and ativo) = 'admin', false)
$$;

create or replace function public.is_ativo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select ativo from public.app_users where id = auth.uid()), false)
$$;

-- RLS: cada um lê o seu registo; admin lê e gere todos
drop policy if exists "app_users_select_own" on public.app_users;
create policy "app_users_select_own" on public.app_users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "app_users_admin_write" on public.app_users;
create policy "app_users_admin_write" on public.app_users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
