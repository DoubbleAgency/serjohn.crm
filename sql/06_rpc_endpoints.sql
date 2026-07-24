-- 06 — Segredos de API + RPCs para os endpoints server-side (intake e extensão)
-- As rotas Next.js usam a anon key; a autorização real é o segredo passado
-- como argumento e comparado com a tabela privada app_secrets.
-- Os valores de app_secrets são inseridos à parte (nunca ficam no git):
--   insert into public.app_secrets (name, value) values ('intake','...'),('import','...')
--   on conflict (name) do update set value = excluded.value;
-- Idempotente.

create table if not exists public.app_secrets (
  name text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

alter table public.leads add column if not exists valor_proposta numeric;

create or replace function public.check_secret(p_name text, p_secret text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_secrets
    where name = p_name and value = p_secret and length(p_secret) >= 20
  )
$$;
revoke execute on function public.check_secret(text, text) from anon, authenticated, public;

create or replace function public.intake_lead(p_secret text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email text := nullif(trim(p->>'email'), '');
  v_tel   text := nullif(regexp_replace(coalesce(p->>'telefone',''), '[^0-9+]', '', 'g'), '');
begin
  if not public.check_secret('intake', p_secret) then
    raise exception 'unauthorized';
  end if;

  select id into v_id from public.leads
  where created_at > now() - interval '24 hours'
    and (
      (v_email is not null and lower(email) = lower(v_email))
      or (v_tel is not null and regexp_replace(coalesce(telefone,''), '[^0-9+]', '', 'g') = v_tel)
    )
  order by created_at desc limit 1;

  if v_id is not null then
    update public.leads set
      notas = coalesce(notas,'') || E'\n\n' || 'Novo pedido (' || to_char(now(), 'YYYY-MM-DD HH24:MI') || '): '
            || coalesce(p->>'carro_interesse',''),
      updated_at = now()
    where id = v_id;
    return jsonb_build_object('id', v_id, 'deduped', true);
  end if;

  insert into public.leads
    (nome, telefone, email, origem, carro_interesse, orcamento_max, kms_max, notas)
  values
    (coalesce(p->>'nome',''), p->>'telefone', v_email, 'site',
     nullif(p->>'carro_interesse',''),
     nullif(p->>'orcamento_max','')::numeric,
     nullif(p->>'kms_max','')::int,
     nullif(p->>'notas',''))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'deduped', false);
end $$;

create or replace function public.ext_search_leads(p_secret text, p_query text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := lower(coalesce(trim(p_query), ''));
  res jsonb;
begin
  if not public.check_secret('import', p_secret) then
    raise exception 'unauthorized';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into res from (
    select id,
           '' as marca,
           nome as modelo,
           concat_ws(' · ', nullif(carro_interesse,''), nullif(telefone,''), nullif(email,'')) as extras,
           estado,
           created_at as "createdAt"
    from public.leads
    where estado not in ('Vendido','Perdido')
      and (q = '' or lower(concat_ws(' ', nome, carro_interesse, telefone, email, notas)) like '%' || q || '%')
    order by created_at desc
    limit 20
  ) t;
  return res;
end $$;

create or replace function public.ext_import_update(p_secret text, p_lead uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_carro text;
  l public.leads;
begin
  if not public.check_secret('import', p_secret) then
    raise exception 'unauthorized';
  end if;

  select * into l from public.leads where id = p_lead;
  if not found then
    raise exception 'lead não encontrada';
  end if;

  v_carro := trim(concat_ws(' ', p->>'marca', p->>'modelo', case when p->>'ano' is not null then '(' || (p->>'ano') || ')' end));

  update public.leads set
    carro_interesse = coalesce(nullif(v_carro,''), carro_interesse),
    valor_proposta  = coalesce(nullif(p->>'valorVenda','')::numeric, valor_proposta),
    mobile_de_url   = coalesce(nullif(p->>'mobileDeUrl',''), mobile_de_url),
    link_drive      = coalesce(nullif(p->>'linkDrive',''), link_drive),
    notas = coalesce(notas,'') || E'\n\n' ||
            'Importado mobile.de (' || to_char(now(), 'YYYY-MM-DD HH24:MI') || '):' || E'\n' ||
            concat_ws(E'\n',
              nullif('Km: ' || nullif(p->>'kms',''), 'Km: '),
              nullif('Combustível: ' || nullif(p->>'combustivel',''), 'Combustível: '),
              nullif('Preço anúncio: €' || nullif(p->>'valorVenda',''), 'Preço anúncio: €'),
              nullif(p->>'extras','')),
    estado = case when estado = 'Nova' or estado = 'Contactado' then 'Proposta' else estado end
  where id = p_lead;

  select * into l from public.leads where id = p_lead;
  return jsonb_build_object('id', l.id, 'nome', l.nome, 'estado', l.estado, 'carro', l.carro_interesse);
end $$;

grant execute on function public.intake_lead(text, jsonb) to anon;
grant execute on function public.ext_search_leads(text, text) to anon;
grant execute on function public.ext_import_update(text, uuid, jsonb) to anon;
