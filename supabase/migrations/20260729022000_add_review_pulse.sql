-- Pulso local: intención de volver, etiquetas rápidas y votos de utilidad.

alter table public.business_reviews
  add column if not exists would_return boolean,
  add column if not exists tags text[] not null default array[]::text[];

alter table public.business_reviews
  drop constraint if exists business_reviews_tags_allowed;
alter table public.business_reviews
  add constraint business_reviews_tags_allowed
  check (
    cardinality(tags) <= 3
    and tags <@ array[
      'buen_servicio',
      'precio_justo',
      'rapido',
      'limpio',
      'recomendado'
    ]::text[]
  );

create table if not exists public.review_helpful_votes (
  review_id uuid not null
    references public.business_reviews(id) on delete cascade,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index if not exists review_helpful_votes_review_idx
  on public.review_helpful_votes (review_id);

alter table public.review_helpful_votes enable row level security;

drop policy if exists review_helpful_votes_own_read
  on public.review_helpful_votes;
create policy review_helpful_votes_own_read
on public.review_helpful_votes
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_iztapamarket_admin()
);

drop policy if exists review_helpful_votes_insert
  on public.review_helpful_votes;
create policy review_helpful_votes_insert
on public.review_helpful_votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.business_reviews as review
    where review.id = review_helpful_votes.review_id
      and review.status = 'published'
      and review.user_id <> auth.uid()
  )
);

drop policy if exists review_helpful_votes_delete
  on public.review_helpful_votes;
create policy review_helpful_votes_delete
on public.review_helpful_votes
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_iztapamarket_admin()
);

revoke all on public.review_helpful_votes from public;
grant select, insert, delete on public.review_helpful_votes to authenticated;

drop function if exists public.get_business_review_summaries(uuid[]);
create function public.get_business_review_summaries(
  p_business_ids uuid[]
)
returns table (
  negocio_id uuid,
  rating numeric,
  reviews_count bigint,
  would_return_percentage numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    review.negocio_id,
    round(avg(review.rating)::numeric, 1) as rating,
    count(*)::bigint as reviews_count,
    round(
      (
        count(*) filter (where review.would_return is true)::numeric
        * 100
        / nullif(
            count(*) filter (where review.would_return is not null),
            0
          )
      ),
      0
    ) as would_return_percentage
  from public.business_reviews as review
  where review.status = 'published'
    and review.negocio_id = any(
      coalesce(p_business_ids, array[]::uuid[])
    )
  group by review.negocio_id;
$$;

create or replace function public.get_review_helpful_summaries(
  p_review_ids uuid[]
)
returns table (
  review_id uuid,
  helpful_count bigint,
  viewer_has_voted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    review.id as review_id,
    count(vote.user_id)::bigint as helpful_count,
    coalesce(
      bool_or(vote.user_id = auth.uid()),
      false
    ) as viewer_has_voted
  from public.business_reviews as review
  left join public.review_helpful_votes as vote
    on vote.review_id = review.id
  where review.status = 'published'
    and review.id = any(coalesce(p_review_ids, array[]::uuid[]))
  group by review.id;
$$;

revoke all on function public.get_business_review_summaries(uuid[]) from public;
grant execute on function public.get_business_review_summaries(uuid[])
  to anon, authenticated;

revoke all on function public.get_review_helpful_summaries(uuid[]) from public;
grant execute on function public.get_review_helpful_summaries(uuid[])
  to anon, authenticated;
