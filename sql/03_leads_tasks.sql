-- 03 — Leads de carros + tarefas + automações
-- Idempotente.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  telefone text,
  email text,
  origem text not null default 'site' check (origem in ('site','telefone','stand','whatsapp','olx','meta-ads','outro')),
  estado text not null default 'Nova' check (estado in ('Nova','Contactado','Test-drive','Proposta','Negociação','Vendido','Perdido')),
  vendedor_id uuid references public.app_users (id) on delete set null,
  follow_up date,
  notas text,
  tentativas int not null default 0,
  -- específico de carro
  carro_interesse text,            -- texto livre (ex.: "BMW 320d 2019")
  car_id uuid references public.cars (id) on delete set null,
  orcamento_max numeric,
  kms_max int,
  retoma boolean not null default false,
  retoma_descricao text,
  matricula_retoma text,
  financiamento boolean not null default false,
  -- fluxo de importação (extensão mobile.de + PDF Make)
  link_drive text,
  mobile_de_url text,
  notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- Vendedor vê as suas leads + leads sem dono; admin vê tudo
drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads
  for select to authenticated
  using (public.is_ativo() and (vendedor_id = auth.uid() or vendedor_id is null or public.is_admin()));

drop policy if exists "leads_insert" on public.leads;
create policy "leads_insert" on public.leads
  for insert to authenticated
  with check (public.is_ativo());

drop policy if exists "leads_update" on public.leads;
create policy "leads_update" on public.leads
  for update to authenticated
  using (public.is_ativo() and (vendedor_id = auth.uid() or vendedor_id is null or public.is_admin()));

drop policy if exists "leads_delete_admin" on public.leads;
create policy "leads_delete_admin" on public.leads
  for delete to authenticated
  using (public.is_admin());

-- Tarefas
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  assignee_id uuid references public.app_users (id) on delete set null,
  lead_id uuid references public.leads (id) on delete cascade,
  car_id uuid references public.cars (id) on delete set null,
  estado text not null default 'Aberta' check (estado in ('Aberta','Feita')),
  prazo date,
  prioridade text not null default 'Normal' check (prioridade in ('Baixa','Normal','Alta')),
  departamento text check (departamento is null or departamento in ('Vendas','Documentação','Preparação')),
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks
  for select to authenticated
  using (public.is_ativo());

drop policy if exists "tasks_write" on public.tasks;
create policy "tasks_write" on public.tasks
  for all to authenticated
  using (public.is_ativo())
  with check (public.is_ativo());

-- Automações de estado (no Postgres, não no código)
create or replace function public.crm_on_estado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.follow_up := coalesce(new.follow_up, current_date);
    new.tentativas := coalesce(new.tentativas, 0);
    return new;
  end if;

  if new.estado is distinct from old.estado then
    if new.estado = 'Contactado' then
      new.follow_up := current_date + 3;
    elsif new.estado = 'Test-drive' then
      insert into public.tasks (titulo, descricao, assignee_id, lead_id, prazo, prioridade, departamento)
      values ('Agendar/preparar test-drive — ' || coalesce(nullif(new.nome,''),'lead'),
              coalesce('Carro: ' || nullif(new.carro_interesse,''), null),
              new.vendedor_id, new.id, current_date + 2, 'Alta', 'Vendas');
    elsif new.estado = 'Proposta' then
      new.follow_up := current_date + 2;
    elsif new.estado = 'Vendido' then
      if new.car_id is not null then
        update public.cars set estado = 'Vendido' where id = new.car_id;
      end if;
      insert into public.tasks (titulo, assignee_id, lead_id, car_id, prazo, prioridade, departamento) values
        ('Contrato de venda — '   || coalesce(nullif(new.nome,''),'lead'), new.vendedor_id, new.id, new.car_id, current_date + 3, 'Alta',   'Vendas'),
        ('Documentação/legalização — ' || coalesce(nullif(new.nome,''),'lead'), new.vendedor_id, new.id, new.car_id, current_date + 7, 'Alta',   'Documentação'),
        ('Preparar entrega — '    || coalesce(nullif(new.nome,''),'lead'), new.vendedor_id, new.id, new.car_id, current_date + 10, 'Normal', 'Preparação');
      if new.financiamento then
        insert into public.tasks (titulo, assignee_id, lead_id, prazo, prioridade, departamento)
        values ('Tratar financiamento — ' || coalesce(nullif(new.nome,''),'lead'), new.vendedor_id, new.id, current_date + 3, 'Alta', 'Documentação');
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists crm_on_estado on public.leads;
create trigger crm_on_estado before insert or update on public.leads
  for each row execute function public.crm_on_estado();

-- Registar tentativa de contacto sem resposta: follow-up +2 dias, tentativas +1, tarefa de ligar
create or replace function public.registar_tentativa(p_lead uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l public.leads;
begin
  select * into l from public.leads where id = p_lead;
  if not found then return; end if;
  update public.leads set tentativas = tentativas + 1, follow_up = current_date + 2 where id = p_lead;
  insert into public.tasks (titulo, assignee_id, lead_id, prazo, prioridade, departamento)
  values ('Ligar a ' || coalesce(nullif(l.nome,''),'lead') || ' (tentativa ' || (l.tentativas + 2) || ')',
          l.vendedor_id, l.id, current_date + 2, 'Normal', 'Vendas');
end $$;
