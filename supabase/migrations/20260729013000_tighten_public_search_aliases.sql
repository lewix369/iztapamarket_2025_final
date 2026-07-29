-- Conserva equivalencias de oficio, pero evita términos tan amplios que
-- mezclaban materiales, muebles o tiendas con el servicio solicitado.
alter function public.iztapa_public_search_aliases(text)
rename to iztapa_public_search_aliases_broad_v2;

create or replace function public.iztapa_public_search_aliases(p_query text)
returns table (term text, weight integer)
language sql
immutable
parallel safe
set search_path = public
as $$
  with params as (
    select public.iztapa_normalize_search(p_query) as query
  )
  select aliases.term, aliases.weight
  from public.iztapa_public_search_aliases_broad_v2(p_query) as aliases
  cross join params as p
  where not (
    (
      p.query ~ '(^| )(albanil|albanileria)( |$)'
      and aliases.term in ('construccion', 'remodelacion')
    )
    or (
      p.query ~ '(^| )(carpintero|carpinteria)( |$)'
      and aliases.term in ('muebles', 'muebles de madera')
    )
    or (
      p.query ~ '(^| )(veterinario|veterinaria)( |$)'
      and aliases.term in ('mascota', 'mascotas')
    )
    or (
      p.query ~ '(^| )(hospital|hospitales|sanatorio|urgencias)( |$)'
      and aliases.term in ('clinica', 'atencion medica')
    )
    or (
      p.query ~ '(^| )(papeleria|utiles escolares)( |$)'
      and aliases.term in ('copias', 'impresiones')
    )
    or (
      p.query ~ '(^| )(cerrajero|cerrajeria)( |$)'
      and aliases.term = 'llaves'
    )
  );
$$;

grant execute on function public.iztapa_public_search_aliases(text)
to anon, authenticated;
