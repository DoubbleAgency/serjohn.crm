-- 08 — RPC para gravar fotos extraídas do Drive (backfill um-a-um, protegido por segredo)
create or replace function public.backfill_fotos(p_secret text, p jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  n int := 0;
begin
  if not public.check_secret('import', p_secret) then
    raise exception 'unauthorized';
  end if;
  for item in select * from jsonb_array_elements(p) loop
    update public.cars
      set fotos = coalesce(item->'fotos', '[]'::jsonb)
      where id = (item->>'id')::uuid
        and jsonb_array_length(coalesce(item->'fotos','[]'::jsonb)) > 0;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
grant execute on function public.backfill_fotos(text, jsonb) to anon;
