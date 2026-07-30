create or replace view tcontext_private.teacher_context_summary
with (security_invoker = true)
as
select
  school_level,
  teacher_role,
  count(*)::bigint as contributed_profiles,
  min(created_at) as first_contribution_at,
  max(created_at) as latest_contribution_at
from public.teacher_context_submissions
where retention_until >= now()
group by school_level, teacher_role
having count(*) >= 5;

comment on view tcontext_private.teacher_context_summary is
  'Privacy-thresholded aggregate only. Groups smaller than five are omitted.';

revoke all on table tcontext_private.teacher_context_summary from public;
revoke all on table tcontext_private.teacher_context_summary from anon;
revoke all on table tcontext_private.teacher_context_summary from authenticated;
grant select on table tcontext_private.teacher_context_summary to service_role;

