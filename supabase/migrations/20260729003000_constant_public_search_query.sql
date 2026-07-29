-- Expone la expansión de sinónimos como una expresión inmutable para que
-- PostgreSQL pueda planear un Bitmap Index Scan sobre el vector público.
create or replace function public.iztapa_public_search_tsquery(p_query text)
returns tsquery
language sql
immutable
parallel safe
set search_path = public
as $$
  select to_tsquery(
    'simple',
    string_agg(
      '(' ||
      regexp_replace(term, '[[:space:]]+', ' & ', 'g') ||
      ')',
      ' | '
    )
  )
  from public.iztapa_public_search_aliases(p_query);
$$;

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
          else 200
        end
        + round(
          ts_rank_cd(
            to_tsvector('simple', coalesce(n.public_search_text, '')),
            public.iztapa_public_search_tsquery(p_query)
          ) * 1000
        )::integer
      )::integer as relevance_score
    from public.negocios as n
    cross join params as p
    where n.is_approved = true
      and n.is_deleted = false
      and lower(trim(n.categoria)) <> 'gobierno y comunidad'
      and (p_plan is null or n.plan_type = lower(trim(p_plan)))
      and (p_category is null or n.categoria = p_category)
      and to_tsvector('simple', coalesce(n.public_search_text, ''))
        @@ public.iztapa_public_search_tsquery(p_query)
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

grant execute on function public.iztapa_public_search_tsquery(text)
to anon, authenticated;

grant execute on function public.search_public_businesses(
  text, text, text, integer, integer
) to anon, authenticated;
