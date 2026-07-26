-- Devuelve solamente las categorías públicas distintas, evitando transferir
-- una fila por cada negocio al navegador.
create or replace function public.get_distinct_business_categories()
returns table (categoria text)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct lower(trim(n.categoria)) as categoria
  from public.negocios as n
  where n.is_approved = true
    and n.is_deleted = false
    and nullif(trim(n.categoria), '') is not null
  order by 1;
$$;

grant execute on function public.get_distinct_business_categories()
to anon, authenticated;

create index if not exists idx_negocios_public_category
on public.negocios (lower(trim(categoria)))
where is_approved = true and is_deleted = false;
