# Serjohn CRM

Plataforma interna da Serjohn (importação automóvel): **leads + stock + tarefas**,
com logins por papel (admin / vendedor / stock).

- **Stack:** Next.js 14.2 (App Router, JavaScript puro) + Supabase (Postgres, Auth, Storage) + Vercel.
- **Site público:** [serjohn.pt](https://serjohn.pt) lê o stock diretamente da view pública `v_stock_publico` (Supabase) e envia leads para `POST /api/leads/intake`.
- **Extensão Chrome** (mobile.de): usa `GET /api/leads` e `POST /api/import-from-mobile` — mesmo contrato do endpoint antigo do site, agora aqui.
- **PDF de proposta:** o Make é chamado via `MAKE_WEBHOOK_URL` no fim de cada importação mobile.de.

## Variáveis de ambiente

Ver `.env.example`. As mesmas variáveis têm de existir na Vercel.

## SQL

Migrações numeradas e idempotentes em `sql/` (aplicadas via conector Supabase).
Os segredos (`app_secrets`) são inseridos à parte e nunca ficam no git.

## Automações (Postgres, trigger `crm_on_estado`)

- Lead nova → follow-up hoje.
- Contactado → follow-up +3 dias.
- Test-drive → tarefa de preparação.
- Vendido → carro ligado passa a Vendido + tarefas de contrato/documentação/entrega (+financiamento).
- `registar_tentativa(lead)` → tentativas +1, follow-up +2 dias, tarefa "Ligar a X".
