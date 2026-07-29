-- Descubrimiento público v2:
-- - excluye dependencias gubernamentales del directorio de negocios;
-- - limpia códigos de sucursal DENUE solo para presentación;
-- - indexa nombre, servicios, SEO y descripción en un documento normalizado;
-- - ordena búsquedas por relevancia;
-- - calcula cercanía y radio en PostgreSQL, sin descargar todo el directorio.

-- El backfill y el índice GIN recorren el catálogo completo una sola vez.
-- El límite normal del proyecto es insuficiente para ~89 mil filas.
set statement_timeout = '10min';

create extension if not exists pg_trgm with schema extensions;

create or replace function public.iztapa_normalize_search(value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select trim(
    regexp_replace(
      translate(
        lower(coalesce(value, '')),
        'áéíóúüñ',
        'aeiouun'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

alter table public.negocios
  add column if not exists public_display_name text,
  add column if not exists public_search_text text;

create or replace function public.refresh_negocio_public_discovery()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.public_display_name :=
    case
      when new.source_type = 'denue'
        and trim(coalesce(new.nombre, '')) ~ '^0[0-9]{2,5}[[:space:]]+'
      then trim(
        regexp_replace(
          trim(coalesce(new.nombre, '')),
          '^0[0-9]{2,5}[[:space:]]+',
          ''
        )
      )
      else trim(coalesce(new.nombre, ''))
    end;

  new.public_search_text := public.iztapa_normalize_search(
    coalesce(new.public_display_name, '') || ' ' ||
    coalesce(new.nombre, '') || ' ' ||
    coalesce(new.descripcion, '') || ' ' ||
    coalesce(new.categoria, '') || ' ' ||
    coalesce(new.slug, '') || ' ' ||
    coalesce(new.seo_keywords, '') || ' ' ||
    coalesce(to_jsonb(new.services)::text, '') || ' ' ||
    coalesce(to_jsonb(new.servicios)::text, '')
  );

  return new;
end;
$$;

drop trigger if exists trg_refresh_negocio_public_discovery
  on public.negocios;

create trigger trg_refresh_negocio_public_discovery
before insert or update of
  nombre,
  descripcion,
  categoria,
  slug,
  seo_keywords,
  services,
  servicios,
  source_type
on public.negocios
for each row
execute function public.refresh_negocio_public_discovery();

with display_names as (
  select
    id,
    case
      when source_type = 'denue'
        and trim(coalesce(nombre, '')) ~ '^0[0-9]{2,5}[[:space:]]+'
      then trim(
        regexp_replace(
          trim(coalesce(nombre, '')),
          '^0[0-9]{2,5}[[:space:]]+',
          ''
        )
      )
      else trim(coalesce(nombre, ''))
    end as display_name
  from public.negocios
),
prepared as (
  select
    n.id,
    d.display_name,
    public.iztapa_normalize_search(
      coalesce(d.display_name, '') || ' ' ||
      coalesce(n.nombre, '') || ' ' ||
      coalesce(n.descripcion, '') || ' ' ||
      coalesce(n.categoria, '') || ' ' ||
      coalesce(n.slug, '') || ' ' ||
      coalesce(n.seo_keywords, '') || ' ' ||
      coalesce(to_jsonb(n.services)::text, '') || ' ' ||
      coalesce(to_jsonb(n.servicios)::text, '')
    ) as search_text
  from public.negocios as n
  join display_names as d on d.id = n.id
)
update public.negocios as n
set
  public_display_name = p.display_name,
  public_search_text = p.search_text
from prepared as p
where p.id = n.id;

create index if not exists idx_negocios_public_search_text_trgm
on public.negocios using gin (
  public_search_text extensions.gin_trgm_ops
)
where is_approved = true
  and is_deleted = false
  and lower(trim(categoria)) <> 'gobierno y comunidad';

create index if not exists idx_negocios_public_nearby
on public.negocios (lat, lng)
where is_approved = true
  and is_deleted = false
  and lat is not null
  and lng is not null
  and lower(trim(categoria)) <> 'gobierno y comunidad';

create or replace function public.iztapa_public_search_aliases(p_query text)
returns table (term text, weight integer)
language sql
immutable
parallel safe
set search_path = public
as $$
  with params as (
    select public.iztapa_normalize_search(p_query) as query
  ),
  candidates(term, weight) as (
    select query, 100
    from params
    where query <> ''

    union all

    select token, 80
    from params,
      lateral regexp_split_to_table(query, '[[:space:]]+') as token
    where length(token) >= 3

    union all
    select alias, 65
    from params,
      lateral unnest(array['taco', 'tacos', 'taqueria']) as alias
    where query ~ '(^| )(taco|tacos|taqueria)( |$)'

    union all
    select alias, 60
    from params,
      lateral unnest(array['torta', 'tortas', 'torteria', 'loncheria']) as alias
    where query ~ '(^| )(torta|tortas|torteria)( |$)'

    union all
    select alias, 70
    from params,
      lateral unnest(
        array['dentista', 'dental', 'odontologo', 'odontologia', 'ortodoncia']
      ) as alias
    where query ~ '(^| )(dentista|dental|odontologo|odontologia)( |$)'

    union all
    select alias, 70
    from params,
      lateral unnest(
        array['mecanico', 'mecanica', 'automotriz', 'taller mecanico']
      ) as alias
    where query ~ '(^| )(mecanico|mecanica|automotriz)( |$)'

    union all
    select alias, 70
    from params,
      lateral unnest(
        array['plomero', 'plomeria', 'fontanero', 'hidraulica']
      ) as alias
    where query ~ '(^| )(plomero|plomeria|fontanero)( |$)'

    union all
    select alias, 70
    from params,
      lateral unnest(
        array['abogado', 'legal', 'juridico', 'despacho juridico']
      ) as alias
    where query ~ '(^| )(abogado|legal|juridico)( |$)'

    union all
    select alias, 70
    from params,
      lateral unnest(
        array['psicologo', 'psicologia', 'terapia psicologica', 'salud mental']
      ) as alias
    where query ~ '(^| )(psicologo|psicologia|terapia)( |$)'

    union all
    select alias, 65
    from params,
      lateral unnest(
        array[
          'computadora',
          'computadoras',
          'computo',
          'informatica',
          'soporte tecnico',
          'reparacion de computadoras'
        ]
      ) as alias
    where query ~ '(^| )(computadora|computadoras|computo|informatica)( |$)'

    union all
    select alias, 65
    from params,
      lateral unnest(
        array['electricista', 'electricidad', 'instalacion electrica']
      ) as alias
    where query ~ '(^| )(electricista|electricidad)( |$)'

    union all
    select alias, 60
    from params,
      lateral unnest(
        array['estetica', 'belleza', 'peluqueria', 'barberia']
      ) as alias
    where query ~ '(^| )(estetica|belleza|peluqueria|barberia)( |$)'

    union all
    select alias, 55
    from params,
      lateral unnest(
        array['medico', 'doctor', 'doctora', 'consultorio', 'clinica']
      ) as alias
    where query ~ '(^| )(medico|doctor|doctora|clinica)( |$)'

    union all
    select alias, 70
    from params,
      lateral unnest(
        array[
          'hospital',
          'hospitales',
          'clinica',
          'sanatorio',
          'urgencias',
          'atencion medica'
        ]
      ) as alias
    where query ~ '(^| )(hospital|hospitales|sanatorio|urgencias)( |$)'

    union all
    select alias, 70
    from params,
      lateral unnest(
        array[
          'veterinario',
          'veterinaria',
          'mascota',
          'mascotas',
          'clinica veterinaria'
        ]
      ) as alias
    where query ~ '(^| )(veterinario|veterinaria|mascota|mascotas)( |$)'

    union all
    select alias, 70
    from params,
      lateral unnest(
        array['optica', 'optico', 'lentes', 'oftalmologo', 'examen de la vista']
      ) as alias
    where query ~ '(^| )(optica|optico|lentes|oftalmologo|oftalmologia)( |$)'

    union all
    select alias, 65
    from params,
      lateral unnest(
        array['laboratorio', 'analisis clinicos', 'estudios medicos']
      ) as alias
    where query ~ '(^| )(laboratorio|analisis clinicos|estudios medicos)( |$)'

    union all
    select alias, 65
    from params,
      lateral unnest(
        array[
          'fisioterapia',
          'fisioterapeuta',
          'rehabilitacion',
          'terapia fisica'
        ]
      ) as alias
    where query ~
      '(^| )(fisioterapia|fisioterapeuta|rehabilitacion|terapia fisica)( |$)'

    union all
    select alias, 65
    from params,
      lateral unnest(array['cerrajero', 'cerrajeria', 'llaves']) as alias
    where query ~ '(^| )(cerrajero|cerrajeria|llaves)( |$)'

    union all
    select alias, 60
    from params,
      lateral unnest(
        array['albanil', 'albanileria', 'construccion', 'remodelacion']
      ) as alias
    where query ~ '(^| )(albanil|albanileria|remodelacion)( |$)'

    union all
    select alias, 60
    from params,
      lateral unnest(
        array['carpintero', 'carpinteria', 'muebles', 'muebles de madera']
      ) as alias
    where query ~ '(^| )(carpintero|carpinteria|muebles)( |$)'

    union all
    select alias, 60
    from params,
      lateral unnest(
        array['papeleria', 'utiles escolares', 'copias', 'impresiones']
      ) as alias
    where query ~
      '(^| )(papeleria|utiles escolares|copias|impresiones)( |$)'

    union all
    select alias, 65
    from params,
      lateral unnest(array['farmacia', 'medicamento', 'medicamentos']) as alias
    where query ~ '(^| )(farmacia|medicamento|medicamentos)( |$)'

    union all
    select alias, 55
    from params,
      lateral unnest(
        array['pan', 'panaderia', 'pasteleria', 'reposteria']
      ) as alias
    where query ~ '(^| )(pan|panaderia|pasteleria)( |$)'
  )
  select term, max(weight)::integer
  from candidates
  where term <> ''
  group by term;
$$;

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
    and lower(trim(n.categoria)) <> 'gobierno y comunidad'
    and nullif(trim(n.categoria), '') is not null
  order by 1;
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
  aliases as materialized (
    select * from public.iztapa_public_search_aliases(p_query)
  ),
  candidates as materialized (
    select
      n.id,
      max(a.weight) as alias_weight,
      count(distinct a.term) as matched_terms
    from aliases as a
    join public.negocios as n
      on n.public_search_text like ('%' || a.term || '%')
    where n.is_approved = true
      and n.is_deleted = false
      and lower(trim(n.categoria)) <> 'gobierno y comunidad'
      and (p_plan is null or n.plan_type = lower(trim(p_plan)))
      and (p_category is null or n.categoria = p_category)
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
  boxed as materialized (
    select
      n.*,
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
      b.public_display_name as display_name,
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
      coalesce(
        (
          select max(a.weight) + least(count(distinct a.term), 5) * 15
          from aliases as a
          where b.public_search_text like ('%' || a.term || '%')
        ),
        0
      )::integer as relevance_score
    from boxed as b
    cross join params as p
    where b.distance_m <= p.radius_m
      and (
        p.query = ''
        or exists (
          select 1
          from aliases as a
          where b.public_search_text like ('%' || a.term || '%')
        )
      )
  ),
  page_rows as (
    select *
    from ranked
    order by
      case when nullif(trim(p_query), '') is null then 0 else relevance_score end
        desc,
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

grant execute on function public.get_distinct_business_categories()
to anon, authenticated;

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

analyze public.negocios;

reset statement_timeout;
