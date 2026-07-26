-- Búsqueda parcial rápida para el directorio completo. Las consultas públicas
-- usan ILIKE sobre estos cuatro campos y combinan los resultados con OR.
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_negocios_public_nombre_trgm
on public.negocios using gin (nombre extensions.gin_trgm_ops)
where is_approved = true and is_deleted = false;

create index if not exists idx_negocios_public_descripcion_trgm
on public.negocios using gin (descripcion extensions.gin_trgm_ops)
where is_approved = true and is_deleted = false;

create index if not exists idx_negocios_public_categoria_trgm
on public.negocios using gin (categoria extensions.gin_trgm_ops)
where is_approved = true and is_deleted = false;

create index if not exists idx_negocios_public_slug_trgm
on public.negocios using gin (slug extensions.gin_trgm_ops)
where is_approved = true and is_deleted = false;

analyze public.negocios;
