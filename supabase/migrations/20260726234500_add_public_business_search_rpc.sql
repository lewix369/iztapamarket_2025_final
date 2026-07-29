-- Búsqueda pública estable para el directorio completo. Primero materializa
-- únicamente los identificadores coincidentes usando los índices trigram y
-- después obtiene las columnas visibles de la página solicitada.
create or replace function public.search_public_businesses(
  p_query text,
  p_plan text default null,
  p_category text default null,
  p_offset integer default 0,
  p_limit integer default 24
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
set statement_timeout = '12s'
as $$
  with matches as materialized (
    select n.id
    from public.negocios as n
    where n.is_approved = true
      and n.is_deleted = false
      and (p_plan is null or n.plan_type = lower(trim(p_plan)))
      and (p_category is null or n.categoria = p_category)
      and (
        n.nombre ilike ('%' || p_query || '%')
        or n.descripcion ilike ('%' || p_query || '%')
        or n.categoria ilike ('%' || p_query || '%')
        or n.slug ilike ('%' || p_query || '%')
      )
  ),
  page_rows as (
    select
      n.id,
      n.nombre,
      n.slug,
      n.descripcion,
      n.direccion,
      n.portada_url,
      n.imagen_url,
      n.logo_url,
      n.plan_type,
      n.is_approved,
      n.is_deleted,
      n.categoria,
      n.telefono,
      n.hours,
      n.lat,
      n.lng,
      n.plan_rank,
      n.sort_name
    from matches as m
    join public.negocios as n on n.id = m.id
    order by n.plan_rank, n.sort_name, n.id
    offset greatest(p_offset, 0)
    limit least(greatest(p_limit, 1), 100)
  )
  select jsonb_build_object(
    'data',
    coalesce(
      (select jsonb_agg(to_jsonb(p)) from page_rows as p),
      '[]'::jsonb
    ),
    'count',
    (select count(*) from matches)
  );
$$;

grant execute on function public.search_public_businesses(
  text, text, text, integer, integer
) to anon, authenticated;
