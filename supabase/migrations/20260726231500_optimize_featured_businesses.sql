-- Evita recorrer todo el directorio para localizar los pocos negocios
-- destacados que aparecen en la portada.
create index if not exists idx_negocios_public_featured_listing
on public.negocios (plan_rank, sort_name, id)
where is_approved = true
  and is_deleted = false
  and is_featured = true;

analyze public.negocios;
