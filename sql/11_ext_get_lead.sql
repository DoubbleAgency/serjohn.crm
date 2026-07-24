-- 11 — Ler uma lead com o segredo da extensão (para o PDF via ?key=)
create or replace function public.ext_get_lead(p_secret text, p_lead uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.leads;
begin
  if not public.check_secret('import', p_secret) then
    raise exception 'unauthorized';
  end if;
  select * into l from public.leads where id = p_lead;
  if not found then return null; end if;
  return to_jsonb(l);
end $$;
grant execute on function public.ext_get_lead(text, uuid) to anon;
