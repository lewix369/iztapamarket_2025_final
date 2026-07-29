-- Mantiene rápidos los conteos, filtros y la primera página del administrador
-- sin cambiar datos ni políticas de acceso.
create index if not exists idx_negocios_admin_active_plan
  on public.negocios (plan_type)
  where is_deleted = false;

create index if not exists idx_negocios_admin_active_id
  on public.negocios (id desc)
  where is_deleted = false;

create index if not exists idx_negocios_public_active_category
  on public.negocios ((lower(trim(categoria))))
  where is_approved = true
    and is_deleted = false;
