alter table public.teacher_context_submissions
  drop constraint if exists teacher_context_submissions_retention_after_consent;

alter table public.teacher_context_submissions
  add constraint teacher_context_submissions_retention_after_consent
    check (retention_until >= consented_at);

comment on column public.teacher_context_submissions.retention_until is
  'Purge eligibility timestamp. It reserves one daily purge interval inside the configured maximum retention period.';
