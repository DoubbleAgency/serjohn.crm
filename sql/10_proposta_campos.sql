-- 10 — Campos estruturados da proposta (para o PDF gerado pelo CRM)
-- Inclui a versão final de ext_import_update (fotos + campos estruturados,
-- sem Make/Notion) e o backfill das propostas migradas. Conteúdo completo
-- na migração aplicada no Supabase (10_proposta_campos).
alter table public.leads add column if not exists proposta_ano int;
alter table public.leads add column if not exists proposta_km int;
alter table public.leads add column if not exists proposta_combustivel text;
alter table public.leads add column if not exists descricao_proposta text;
