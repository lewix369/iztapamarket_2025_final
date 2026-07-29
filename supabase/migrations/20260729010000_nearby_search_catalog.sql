-- Calcula el radio en el catálogo reducido y consulta las fichas completas
-- únicamente después de paginar los identificadores cercanos.
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
  boxed_ids as materialized (
    select
      catalog.negocio_id,
      catalog.plan_rank,
      catalog.sort_name,
      (
        6371000.0 * acos(
          least(
            1.0,
            greatest(
              -1.0,
              sin(radians(p_lat)) * sin(radians(catalog.lat)) +
              cos(radians(p_lat)) * cos(radians(catalog.lat)) *
              cos(radians(catalog.lng - p_lng))
            )
          )
        )
      ) as distance_m,
      case
        when p.query = '' then 0
        else round(
          ts_rank_cd(
            catalog.search_vector,
            public.iztapa_public_search_tsquery(p_query)
          ) * 1000
        )::integer
      end as relevance_score
    from public.negocios_public_search_catalog as catalog
    cross join params as p
    where catalog.lat is not null
      and catalog.lng is not null
      and catalog.lat between p_lat - p.lat_delta and p_lat + p.lat_delta
      and catalog.lng between p_lng - p.lng_delta and p_lng + p.lng_delta
      and (p_plan is null or catalog.plan_type = lower(trim(p_plan)))
      and (p_category is null or catalog.categoria = p_category)
      and (
        p.query = ''
        or catalog.search_vector
          @@ public.iztapa_public_search_tsquery(p_query)
      )
  ),
  ranked_ids as materialized (
    select
      boxed.*,
      round((boxed.distance_m / 1000.0)::numeric, 3) as distance_km
    from boxed_ids as boxed
    cross join params as p
    where boxed.distance_m <= p.radius_m
  ),
  page_ids as materialized (
    select
      ranked.*,
      row_number() over (
        order by
          relevance_score desc,
          distance_km asc,
          plan_rank asc,
          sort_name asc,
          negocio_id asc
      ) as page_order
    from ranked_ids as ranked
    order by
      relevance_score desc,
      distance_km asc,
      plan_rank asc,
      sort_name asc,
      negocio_id asc
    offset greatest(p_offset, 0)
    limit least(greatest(p_limit, 1), 100)
  ),
  page_rows as (
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
      page.distance_km,
      page.relevance_score,
      page.page_order
    from page_ids as page
    join public.negocios as n on n.id = page.negocio_id
  )
  select jsonb_build_object(
    'data',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(p) - 'page_order'
          order by p.page_order
        )
        from page_rows as p
      ),
      '[]'::jsonb
    ),
    'count',
    (select count(*) from ranked_ids)
  );
$$;

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
