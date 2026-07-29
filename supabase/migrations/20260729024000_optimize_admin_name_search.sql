-- El administrador también consulta registros no aprobados; por eso el índice
-- público parcial no puede acelerar su búsqueda global por nombre.
create index if not exists idx_negocios_admin_active_nombre_trgm
  on public.negocios using gin (nombre extensions.gin_trgm_ops)
  where is_deleted = false;

analyze public.negocios;
