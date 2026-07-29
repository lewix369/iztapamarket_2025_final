-- Endurecimiento adicional contra automatización y ejecución directa de
-- funciones internas. La restricción de una reseña por negocio ya evita
-- duplicados; este límite frena publicaciones masivas entre negocios.

create or replace function public.set_business_review_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Debes iniciar sesión para publicar una reseña.'
        using errcode = '42501';
    end if;

    if not public.is_iztapamarket_admin()
      and (
        select count(*)
        from public.business_reviews as recent
        where recent.user_id = auth.uid()
          and recent.created_at > now() - interval '1 minute'
      ) >= 5
    then
      raise exception 'Demasiadas reseñas en poco tiempo. Inténtalo más tarde.'
        using errcode = 'P0001';
    end if;

    new.user_id := auth.uid();
  else
    new.user_id := old.user_id;
    new.negocio_id := old.negocio_id;
  end if;

  new.author_name := coalesce(
    nullif(btrim(new.author_name), ''),
    nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
    nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''),
    'Usuario de IztapaMarket'
  );
  new.comment := nullif(btrim(new.comment), '');
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.status := 'published';
  elsif not public.is_iztapamarket_admin() then
    new.status := old.status;
  end if;

  return new;
end;
$$;

revoke all on function public.set_business_review_defaults() from public;
revoke all on function public.get_business_review_summaries(uuid[]) from public;
grant execute on function public.get_business_review_summaries(uuid[])
  to anon, authenticated;
