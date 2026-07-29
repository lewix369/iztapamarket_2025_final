-- Reseñas de negocios:
-- - una reseña por usuario y negocio;
-- - solo usuarios autenticados y ajenos al negocio pueden escribir;
-- - lectura pública únicamente de reseñas publicadas;
-- - moderación reservada al administrador autorizado.

create extension if not exists pgcrypto;

create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default 'Usuario de IztapaMarket',
  rating smallint not null check (rating between 1 and 5),
  comment text,
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_reviews_user_business_key unique (negocio_id, user_id),
  constraint business_reviews_author_name_length
    check (char_length(btrim(author_name)) between 1 and 80),
  constraint business_reviews_comment_length
    check (comment is null or char_length(btrim(comment)) between 1 and 1000)
);

create index if not exists business_reviews_public_business_idx
  on public.business_reviews (negocio_id, created_at desc)
  where status = 'published';

create index if not exists business_reviews_admin_idx
  on public.business_reviews (status, created_at desc);

create or replace function public.is_iztapamarket_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) =
    'luis.carrillo.laguna@gmail.com';
$$;

create or replace function public.can_review_business(p_negocio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.negocios as n
      where n.id = p_negocio_id
        and n.is_approved is true
        and coalesce(n.is_deleted, false) is false
        and coalesce(n.user_id::text, '') <> auth.uid()::text
        and coalesce(n.owner_user_id::text, '') <> auth.uid()::text
        and (
          coalesce(nullif(lower(n.owner_email), ''), '__sin_propietario__')
          <> lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    );
$$;

create or replace function public.set_business_review_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
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

drop trigger if exists set_business_review_defaults_trigger
  on public.business_reviews;
create trigger set_business_review_defaults_trigger
before insert or update on public.business_reviews
for each row execute function public.set_business_review_defaults();

alter table public.business_reviews enable row level security;

drop policy if exists business_reviews_public_read
  on public.business_reviews;
create policy business_reviews_public_read
on public.business_reviews
for select
to anon, authenticated
using (
  status = 'published'
  or user_id = auth.uid()
  or public.is_iztapamarket_admin()
);

drop policy if exists business_reviews_authenticated_insert
  on public.business_reviews;
create policy business_reviews_authenticated_insert
on public.business_reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'published'
  and public.can_review_business(negocio_id)
);

drop policy if exists business_reviews_owner_update
  on public.business_reviews;
create policy business_reviews_owner_update
on public.business_reviews
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_iztapamarket_admin()
)
with check (
  (
    user_id = auth.uid()
    and status in ('published', 'hidden')
    and public.can_review_business(negocio_id)
  )
  or public.is_iztapamarket_admin()
);

drop policy if exists business_reviews_owner_delete
  on public.business_reviews;
create policy business_reviews_owner_delete
on public.business_reviews
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_iztapamarket_admin()
);

create or replace function public.get_business_review_summaries(
  p_business_ids uuid[]
)
returns table (
  negocio_id uuid,
  rating numeric,
  reviews_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.negocio_id,
    round(avg(r.rating)::numeric, 1) as rating,
    count(*)::bigint as reviews_count
  from public.business_reviews as r
  where r.status = 'published'
    and r.negocio_id = any(coalesce(p_business_ids, array[]::uuid[]))
  group by r.negocio_id;
$$;

revoke all on public.business_reviews from public;
grant select on public.business_reviews to anon, authenticated;
grant insert, update, delete on public.business_reviews to authenticated;

revoke all on function public.is_iztapamarket_admin() from public;
revoke all on function public.can_review_business(uuid) from public;
grant execute on function public.is_iztapamarket_admin() to authenticated;
grant execute on function public.can_review_business(uuid) to authenticated;
grant execute on function public.get_business_review_summaries(uuid[])
  to anon, authenticated;

comment on table public.business_reviews is
  'Reseñas de usuarios autenticados para los negocios de IztapaMarket.';
