-- Evita recalcular cada sinónimo después de usar el vector indexado y limita
-- la consulta geográfica a las columnas visibles de las tarjetas.
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
            expression.query
          ) * 1000
        )::integer
      )::integer as relevance_score
    from public.negocios as n
    cross join params as p
    cross join search_expression as expression
    where n.is_approved = true
      and n.is_deleted = false
      and lower(trim(n.categoria)) <> 'gobierno y comunidad'
      and (p_plan is null or n.plan_type = lower(trim(p_plan)))
      and (p_category is null or n.categoria = p_category)
      and to_tsvector('simple', coalesce(n.public_search_text, ''))
        @@ expression.query
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

create or replace function public.search_nearby_businesses(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 1000,
  p_query text default null,
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
    select
      public.iztapa_normalize_search(p_query) as query,
      least(greatest(coalesce(p_radius_m, 1000), 250), 10000)::double precision
        as radius_m,
      least(greatest(coalesce(p_radius_m, 1000), 250), 10000)::double precision
        / 110574.0 as lat_delta,
      least(greatest(coalesce(p_radius_m, 1000), 250), 10000)::double precision
        / (
          111320.0 *
          greatest(0.1, cos(radians(p_lat)))
        ) as lng_delta
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
  boxed as materialized (
    select
      n.id,
      n.nombre,
      n.public_display_name as display_name,
      n.public_search_text,
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
        6371000.0 * acos(
          least(
            1.0,
            greatest(
              -1.0,
              sin(radians(p_lat)) * sin(radians(n.lat)) +
              cos(radians(p_lat)) * cos(radians(n.lat)) *
              cos(radians(n.lng - p_lng))
            )
          )
        )
      ) as distance_m
    from public.negocios as n
    cross join params as p
    where n.is_approved = true
      and n.is_deleted = false
      and n.lat is not null
      and n.lng is not null
      and lower(trim(n.categoria)) <> 'gobierno y comunidad'
      and n.lat between p_lat - p.lat_delta and p_lat + p.lat_delta
      and n.lng between p_lng - p.lng_delta and p_lng + p.lng_delta
      and (p_plan is null or n.plan_type = lower(trim(p_plan)))
      and (p_category is null or n.categoria = p_category)
  ),
  ranked as materialized (
    select
      b.id,
      b.nombre,
      b.display_name,
      b.source_type,
      b.slug,
      b.descripcion,
      b.direccion,
      b.portada_url,
      b.imagen_url,
      b.logo_url,
      b.plan_type,
      b.is_approved,
      b.is_deleted,
      b.categoria,
      b.telefono,
      b.hours,
      b.lat,
      b.lng,
      b.plan_rank,
      b.sort_name,
      round((b.distance_m / 1000.0)::numeric, 3) as distance_km,
      case
        when p.query = '' then 0
        else round(
          ts_rank_cd(
            to_tsvector('simple', coalesce(b.public_search_text, '')),
            expression.query
          ) * 1000
        )::integer
      end as relevance_score
    from boxed as b
    cross join params as p
    cross join search_expression as expression
    where b.distance_m <= p.radius_m
      and (
        p.query = ''
        or to_tsvector('simple', coalesce(b.public_search_text, ''))
          @@ expression.query
      )
  ),
  page_rows as (
    select *
    from ranked
    order by
      relevance_score desc,
      distance_km asc,
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

grant execute on function public.search_nearby_businesses(
  double precision,
  double precision,
  integer,
  text,
  text,
  text,
  integer,
  integer
) to anon, authenticated;
