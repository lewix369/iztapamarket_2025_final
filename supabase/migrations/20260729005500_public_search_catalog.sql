-- Catálogo auxiliar sin columnas privadas. Permite buscar, contar y calcular
-- cercanía antes de consultar las pocas fichas visibles bajo el RLS normal.
set statement_timeout = '10min';

create table if not exists public.negocios_public_search_catalog
as
select
  id as negocio_id,
  plan_type,
  categoria,
  plan_rank,
  sort_name,
  public_display_name as display_name,
  lat,
  lng,
  to_tsvector('simple', coalesce(public_search_text, '')) as search_vector
from public.negocios
with no data;

alter table public.negocios_public_search_catalog
  add constraint negocios_public_search_catalog_pkey
  primary key (negocio_id);

alter table public.negocios_public_search_catalog
  add constraint negocios_public_search_catalog_negocio_fkey
  foreign key (negocio_id)
  references public.negocios(id)
  on delete cascade;

create index if not exists idx_public_search_catalog_vector
on public.negocios_public_search_catalog using gin (search_vector);

create index if not exists idx_public_search_catalog_nearby
on public.negocios_public_search_catalog (lat, lng)
where lat is not null and lng is not null;

insert into public.negocios_public_search_catalog (
  negocio_id,
  plan_type,
  categoria,
  plan_rank,
  sort_name,
  display_name,
  lat,
  lng,
  search_vector
)
select
  id,
  plan_type,
  categoria,
  plan_rank,
  sort_name,
  public_display_name,
  lat,
  lng,
  to_tsvector('simple', coalesce(public_search_text, ''))
from public.negocios
where is_approved = true
  and is_deleted = false
  and lower(trim(categoria)) <> 'gobierno y comunidad'
on conflict (negocio_id) do update
set
  plan_type = excluded.plan_type,
  categoria = excluded.categoria,
  plan_rank = excluded.plan_rank,
  sort_name = excluded.sort_name,
  display_name = excluded.display_name,
  lat = excluded.lat,
  lng = excluded.lng,
  search_vector = excluded.search_vector;

create or replace function public.refresh_negocio_public_search_catalog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.negocios_public_search_catalog
    where negocio_id = old.id;
    return old;
  end if;

  if new.is_approved = true
    and new.is_deleted = false
    and lower(trim(new.categoria)) <> 'gobierno y comunidad'
  then
    insert into public.negocios_public_search_catalog (
      negocio_id,
      plan_type,
      categoria,
      plan_rank,
      sort_name,
      display_name,
      lat,
      lng,
      search_vector
    )
    values (
      new.id,
      new.plan_type,
      new.categoria,
      new.plan_rank,
      new.sort_name,
      new.public_display_name,
      new.lat,
      new.lng,
      to_tsvector('simple', coalesce(new.public_search_text, ''))
    )
    on conflict (negocio_id) do update
    set
      plan_type = excluded.plan_type,
      categoria = excluded.categoria,
      plan_rank = excluded.plan_rank,
      sort_name = excluded.sort_name,
      display_name = excluded.display_name,
      lat = excluded.lat,
      lng = excluded.lng,
      search_vector = excluded.search_vector;
  else
    delete from public.negocios_public_search_catalog
    where negocio_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_refresh_public_search_catalog_write
on public.negocios;

create trigger trg_refresh_public_search_catalog_write
after insert or update of
  plan_type,
  categoria,
  plan_rank,
  sort_name,
  public_display_name,
  public_search_text,
  lat,
  lng,
  is_approved,
  is_deleted
on public.negocios
for each row
execute function public.refresh_negocio_public_search_catalog();

drop trigger if exists trg_refresh_public_search_catalog_delete
on public.negocios;

create trigger trg_refresh_public_search_catalog_delete
after delete on public.negocios
for each row
execute function public.refresh_negocio_public_search_catalog();

alter table public.negocios_public_search_catalog enable row level security;

drop policy if exists public_read_search_catalog
on public.negocios_public_search_catalog;

create policy public_read_search_catalog
on public.negocios_public_search_catalog
for select
to anon, authenticated
using (true);

revoke all on public.negocios_public_search_catalog from public;
grant select on public.negocios_public_search_catalog to anon, authenticated;

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
  ranked_ids as materialized (
    select
      catalog.negocio_id,
      catalog.plan_rank,
      catalog.sort_name,
      (
        case
          when public.iztapa_normalize_search(catalog.display_name) = p.query
            then 1000
          when public.iztapa_normalize_search(catalog.display_name)
            like (p.query || '%')
            then 850
          when public.iztapa_normalize_search(catalog.display_name)
            like ('%' || p.query || '%')
            then 700
          else 200
        end
        + round(
          ts_rank_cd(
            catalog.search_vector,
            public.iztapa_public_search_tsquery(p_query)
          ) * 1000
        )::integer
      )::integer as relevance_score
    from public.negocios_public_search_catalog as catalog
    cross join params as p
    where (p_plan is null or catalog.plan_type = lower(trim(p_plan)))
      and (p_category is null or catalog.categoria = p_category)
      and catalog.search_vector
        @@ public.iztapa_public_search_tsquery(p_query)
  ),
  page_ids as materialized (
    select
      ranked.*,
      row_number() over (
        order by
          relevance_score desc,
          plan_rank asc,
          sort_name asc,
          negocio_id asc
      ) as page_order
    from ranked_ids as ranked
    order by
      relevance_score desc,
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

grant execute on function public.search_public_businesses(
  text, text, text, integer, integer
) to anon, authenticated;

analyze public.negocios_public_search_catalog;

reset statement_timeout;
