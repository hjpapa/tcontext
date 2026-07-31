create extension if not exists pgcrypto with schema extensions;

create table if not exists public.teacher_context_submissions (
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
  constraint teacher_context_submissions_teacher_role_valid
    check (teacher_role in (
      'homeroom_teacher',
      'subject_teacher',
      'special_education_teacher',
      'counselor',
      'school_nurse',
      'librarian',
      'administrator',
      'other'
    )),
  constraint teacher_context_submissions_profile_json_object
    check (jsonb_typeof(profile_json) = 'object'),
  constraint teacher_context_submissions_profile_school_level_matches
    check (profile_json #>> '{metadata,schoolLevel}' is not distinct from school_level),
  constraint teacher_context_submissions_profile_role_matches
    check (profile_json #>> '{metadata,role}' is not distinct from teacher_role),
  constraint teacher_context_submissions_profile_schema_version_matches
    check (profile_json #>> '{metadata,schemaVersion}' is not distinct from schema_version),
  constraint teacher_context_submissions_profile_prompt_version_matches
    check (profile_json #>> '{metadata,promptVersion}' is not distinct from prompt_version),
  constraint teacher_context_submissions_profile_model_name_matches
    check (profile_json #>> '{metadata,modelName}' is not distinct from model_name),
  constraint teacher_context_submissions_profile_markdown_present
    check (length(trim(profile_markdown)) > 0),
  constraint teacher_context_submissions_confirmed_tags_object
    check (jsonb_typeof(confirmed_tags) = 'object'),
  constraint teacher_context_submissions_confirmed_tags_match_profile
    check (profile_json -> 'confirmedTags' is not distinct from confirmed_tags),
  constraint teacher_context_submissions_privacy_review_object
    check (jsonb_typeof(privacy_review) = 'object'),
  constraint teacher_context_submissions_privacy_review_clear
    check (privacy_review ->> 'status' = 'clear'),
  constraint teacher_context_submissions_privacy_review_items_empty
    check (privacy_review -> 'items' = '[]'::jsonb),
  constraint teacher_context_submissions_privacy_review_matches_profile
    check (profile_json -> 'privacyReview' is not distinct from privacy_review),
  constraint teacher_context_submissions_model_name_present
    check (length(trim(model_name)) between 1 and 128),
  constraint teacher_context_submissions_consent_version_present
    check (length(trim(consent_version)) between 1 and 32),
  constraint teacher_context_submissions_retention_after_consent
    check (retention_until >= consented_at),
  constraint teacher_context_submissions_retention_maximum
    check (retention_until <= consented_at + interval '365 days'),
  constraint teacher_context_submissions_deletion_token_hash_shape
    check (deletion_token_hash ~ '^[a-f0-9]{64}$'),
  constraint teacher_context_submissions_deletion_token_hash_unique
    unique (deletion_token_hash),
  constraint teacher_context_submissions_source_valid
    check (source in ('web'))
);

comment on table public.teacher_context_submissions is
  'Teacher-approved final profiles contributed with explicit consent. Interview transcripts and separate raw-answer fields are never stored.';
comment on column public.teacher_context_submissions.profile_json is
  'Canonical teacher-approved profile only; excludes interview transcripts and separate raw-answer fields.';
comment on column public.teacher_context_submissions.deletion_token_hash is
  'SHA-256/HMAC digest only. The one-time deletion code is never stored.';
comment on column public.teacher_context_submissions.retention_until is
  'Purge eligibility timestamp. It reserves one daily purge interval inside the configured maximum retention period.';

create index if not exists teacher_context_submissions_created_at_idx
  on public.teacher_context_submissions (created_at);
create index if not exists teacher_context_submissions_retention_until_idx
  on public.teacher_context_submissions (retention_until);
create index if not exists teacher_context_submissions_school_level_idx
  on public.teacher_context_submissions (school_level);
create index if not exists teacher_context_submissions_teacher_role_idx
  on public.teacher_context_submissions (teacher_role);
create index if not exists teacher_context_submissions_confirmed_tags_idx
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
