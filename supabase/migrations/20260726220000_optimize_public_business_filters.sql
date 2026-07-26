-- La carga DENUE completa elevó el directorio a casi 90 mil filas.
-- Este índice cubre filtro, orden y paginación de las tarjetas públicas.
create index if not exists idx_negocios_public_category_listing
on public.negocios (categoria, plan_rank, sort_name, id)
where is_approved = true and is_deleted = false;

-- Refresca las estadísticas tras la carga masiva para que Postgres elija los
-- índices parciales del directorio y del catálogo de categorías.
analyze public.negocios;
