-- 09 — Fotos do anúncio guardadas na lead (para a proposta PDF gerada pelo CRM)
-- Ver migração aplicada no Supabase; o ext_import_update foi atualizado na 10.
alter table public.leads add column if not exists fotos jsonb not null default '[]'::jsonb;
