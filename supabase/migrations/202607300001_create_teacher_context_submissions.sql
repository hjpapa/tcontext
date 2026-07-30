create extension if not exists pgcrypto with schema extensions;

create table public.teacher_context_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  schema_version text not null,
  prompt_version text not null,
  app_version text not null,
  school_level text not null,
  teacher_role text not null,
  profile_json jsonb not null,
  profile_markdown text not null,
  confirmed_tags jsonb not null,
  privacy_review jsonb not null,
  model_name text not null,
  consent_version text not null,
  consented_at timestamptz not null,
  retention_until timestamptz not null,
  deletion_token_hash text not null,
  source text not null default 'web',

  constraint teacher_context_submissions_schema_version_present
    check (length(trim(schema_version)) between 1 and 32),
  constraint teacher_context_submissions_prompt_version_present
    check (length(trim(prompt_version)) between 1 and 32),
  constraint teacher_context_submissions_app_version_present
    check (length(trim(app_version)) between 1 and 64),
  constraint teacher_context_submissions_school_level_valid
    check (school_level in ('kindergarten', 'elementary', 'middle', 'high')),
  constraint teacher_context_submissions_teacher_role_present
    check (length(trim(teacher_role)) between 1 and 64),
  constraint teacher_context_submissions_profile_json_object
    check (jsonb_typeof(profile_json) = 'object'),
  constraint teacher_context_submissions_profile_markdown_present
    check (length(trim(profile_markdown)) > 0),
  constraint teacher_context_submissions_confirmed_tags_object
    check (jsonb_typeof(confirmed_tags) = 'object'),
  constraint teacher_context_submissions_privacy_review_object
    check (jsonb_typeof(privacy_review) = 'object'),
  constraint teacher_context_submissions_model_name_present
    check (length(trim(model_name)) between 1 and 128),
  constraint teacher_context_submissions_consent_version_present
    check (length(trim(consent_version)) between 1 and 32),
  constraint teacher_context_submissions_retention_after_consent
    check (retention_until > consented_at),
  constraint teacher_context_submissions_deletion_token_hash_shape
    check (deletion_token_hash ~ '^[a-f0-9]{64}$'),
  constraint teacher_context_submissions_deletion_token_hash_unique
    unique (deletion_token_hash),
  constraint teacher_context_submissions_source_valid
    check (source in ('web'))
);

comment on table public.teacher_context_submissions is
  'Teacher-approved final profiles contributed with explicit consent. Raw interview answers are never stored.';
comment on column public.teacher_context_submissions.profile_json is
  'Canonical teacher-approved profile only; excludes raw interview answers.';
comment on column public.teacher_context_submissions.deletion_token_hash is
  'SHA-256/HMAC digest only. The one-time deletion code is never stored.';
comment on column public.teacher_context_submissions.retention_until is
  'Absolute deletion deadline calculated from consented_at.';

create index teacher_context_submissions_created_at_idx
  on public.teacher_context_submissions (created_at);
create index teacher_context_submissions_retention_until_idx
  on public.teacher_context_submissions (retention_until);
create index teacher_context_submissions_school_level_role_idx
  on public.teacher_context_submissions (school_level, teacher_role);
create index teacher_context_submissions_confirmed_tags_idx
  on public.teacher_context_submissions using gin (confirmed_tags jsonb_path_ops);

alter table public.teacher_context_submissions enable row level security;
alter table public.teacher_context_submissions force row level security;

revoke all on table public.teacher_context_submissions from public;
revoke all on table public.teacher_context_submissions from anon;
revoke all on table public.teacher_context_submissions from authenticated;
grant select, insert, update, delete on table public.teacher_context_submissions to service_role;

create schema if not exists tcontext_private;
revoke all on schema tcontext_private from public;
revoke all on schema tcontext_private from anon;
revoke all on schema tcontext_private from authenticated;
grant usage on schema tcontext_private to service_role;

create or replace function tcontext_private.purge_expired_submissions()
returns bigint
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.teacher_context_submissions
    where retention_until < now()
    returning 1
  )
  select count(*)::bigint from deleted;
$$;

revoke all on function tcontext_private.purge_expired_submissions() from public;
revoke all on function tcontext_private.purge_expired_submissions() from anon;
revoke all on function tcontext_private.purge_expired_submissions() from authenticated;
grant execute on function tcontext_private.purge_expired_submissions() to service_role;

