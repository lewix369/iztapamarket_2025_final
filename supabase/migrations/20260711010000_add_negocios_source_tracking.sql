-- Metadatos de procedencia y revisión para sincronizaciones DENUE.
-- Esta migración no modifica external_reference: ese campo ya se usa para pagos/planes.

alter table public.negocios
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_id text,
  add column if not exists review_status text not null default 'pending',
  add column if not exists source_synced_at timestamptz,
  add column if not exists image_classification_version integer not null default 0;

alter table public.negocios
  drop constraint if exists negocios_source_type_check,
  add constraint negocios_source_type_check
    check (source_type in ('manual', 'denue')),
  drop constraint if exists negocios_review_status_check,
  add constraint negocios_review_status_check
    check (review_status in ('pending', 'reviewed'));

create index if not exists negocios_source_type_idx
  on public.negocios (source_type);

create unique index if not exists negocios_denue_source_id_uidx
  on public.negocios (source_id)
  where source_type = 'denue' and source_id is not null;

-- Los pools se asignaron durante las cargas DENUE. Esta condición permite
-- identificar el conjunto importado sin afectar negocios con imágenes propias.
update public.negocios
set source_type = 'denue'
where imagen_url like '/business-pool/%'
  and source_type = 'manual';

comment on column public.negocios.source_type is
  'Procedencia del registro: manual o denue.';
comment on column public.negocios.source_id is
  'Identificador estable de la fuente; para DENUE debe almacenar Id/CLEE cuando se concilie.';
comment on column public.negocios.review_status is
  'Estado editorial: pending o reviewed. La reclamación se deriva de user_id/owner_user_id.';
comment on column public.negocios.source_synced_at is
  'Última fecha en que el registro fue conciliado con su fuente.';
comment on column public.negocios.image_classification_version is
  'Versión de las reglas determinísticas usadas para imagen_url.';
