-- Orden estable e indexado para el directorio publico de negocios.
-- Las expresiones coinciden con el orden usado por BusinessListPage.

alter table public.negocios
add column if not exists plan_rank smallint
generated always as (
  case
    when lower(trim(plan_type)) = 'premium' then 0
    when lower(trim(plan_type)) in ('pro', 'profesional', 'professional') then 1
    when lower(trim(plan_type)) in ('free', 'gratis') then 2
    else 3
  end
) stored;

alter table public.negocios
add column if not exists sort_name text
generated always as (
  coalesce(
    nullif(trim(nombre_norm), ''),
    lower(trim(coalesce(nombre, '')))
  )
) stored;

create index if not exists idx_negocios_public_listing
on public.negocios (plan_rank, sort_name, id)
where is_approved = true and is_deleted = false;
