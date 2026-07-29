-- Acelera las búsquedas con sinónimos usando un índice de texto completo.
-- El índice trigram se conserva para compatibilidad y búsquedas parciales.
set statement_timeout = '10min';

create index if not exists idx_negocios_public_search_vector
on public.negocios using gin (
  to_tsvector('simple', coalesce(public_search_text, ''))
)
where is_approved = true
  and is_deleted = false
  and lower(trim(categoria)) <> 'gobierno y comunidad';

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
set statement_timeout = '15s'
as $$
  with params as (
    select public.iztapa_normalize_search(p_query) as query
  ),
  aliases as materialized (
    select * from public.iztapa_public_search_aliases(p_query)
  ),
  search_expression as materialized (
    select to_tsquery(
      'simple',
      string_agg(
        '(' ||
        regexp_replace(term, '[[:space:]]+', ' & ', 'g') ||
        ')',
        ' | '
      )
    ) as query
    from aliases
  ),
  matched_ids as materialized (
    select n.id
    from public.negocios as n
    cross join search_expression as expression
    where n.is_approved = true
      and n.is_deleted = false
      and lower(trim(n.categoria)) <> 'gobierno y comunidad'
      and (p_plan is null or n.plan_type = lower(trim(p_plan)))
      and (p_category is null or n.categoria = p_category)
      and to_tsvector('simple', coalesce(n.public_search_text, ''))
        @@ expression.query
  ),
  candidates as materialized (
    select
      n.id,
      max(a.weight) as alias_weight,
      count(distinct a.term) as matched_terms
    from matched_ids as matched
    join public.negocios as n on n.id = matched.id
    join aliases as a
      on n.public_search_text like ('%' || a.term || '%')
    group by n.id
  ),
  ranked as materialized (
    select
      n.id,
      n.nombre,
      n.public_display_name as display_name,
      n.source_type,
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
      n.sort_name,
      (
        case
          when public.iztapa_normalize_search(n.public_display_name) = p.query
            then 1000
          when public.iztapa_normalize_search(n.public_display_name)
            like (p.query || '%')
            then 850
          when public.iztapa_normalize_search(n.public_display_name)
            like ('%' || p.query || '%')
            then 700
          when public.iztapa_normalize_search(n.seo_keywords)
            like ('%' || p.query || '%')
            then 550
          when public.iztapa_normalize_search(n.descripcion)
            like ('%' || p.query || '%')
            then 420
          else 200
        end
        + c.alias_weight
        + least(c.matched_terms, 5) * 15
      )::integer as relevance_score
    from candidates as c
    join public.negocios as n on n.id = c.id
    cross join params as p
  ),
  page_rows as (
    select *
    from ranked
    order by
      relevance_score desc,
      plan_rank asc,
      sort_name asc,
      id asc
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
    (select count(*) from ranked)
  );
$$;

grant execute on function public.search_public_businesses(
  text, text, text, integer, integer
) to anon, authenticated;

analyze public.negocios;

reset statement_timeout;
