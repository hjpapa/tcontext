import Link from "next/link";
import { ArrowRight, CalendarClock, Database } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  formatAdminDateTime,
  SCHOOL_LEVEL_LABELS,
  teacherRoleLabel,
} from "@/lib/admin/presentation";
import type { AdminSubmissionSummary } from "@/lib/supabase/admin-submissions";

export function AdminSubmissionList({
  submissions,
}: {
  submissions: AdminSubmissionSummary[];
}) {
  if (submissions.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[#b8c8bc] bg-[#f7faf7] px-6 py-14 text-center">
        <Database
          aria-hidden="true"
          className="mx-auto size-9 text-[#5f7467]"
        />
        <h2 className="mt-4 text-xl font-bold">저장된 문서가 없습니다.</h2>
        <p className="mx-auto mt-2 max-w-xl leading-7 text-[#536159]">
          사용자가 최종 문서를 확인하고 선택적 데이터 기여에 명시적으로 동의하면
          이 목록에 표시됩니다.
        </p>
      </section>
    );
  }

  return (
    <ul className="divide-y divide-[#dce2dc] border-y border-[#cfd8d0]">
      {submissions.map((submission) => (
        <li key={submission.id} className="py-6">
          <article className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {SCHOOL_LEVEL_LABELS[submission.schoolLevel]}
                </Badge>
                <Badge variant="outline">
                  {teacherRoleLabel(submission.teacherRole)}
                </Badge>
                <Badge
                  variant={
                    submission.documentAccess === "full" ? "default" : "outline"
                  }
                >
                  {submission.documentAccess === "full"
                    ? "전문 열람 가능"
                    : "요약만"}
                </Badge>
              </div>
              <h2 className="mt-3 text-xl font-bold break-words sm:text-2xl">
                {submission.profileTitle}
              </h2>
              {submission.shortSummary.trim() ? (
                <p className="mt-2 max-w-3xl leading-7 text-[#536159]">
                  {submission.shortSummary}
                </p>
              ) : (
                <p className="mt-2 text-sm text-[#68756d] italic">
                  요약이 입력되지 않았습니다.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#536159]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock aria-hidden="true" className="size-4" />
                  저장 {formatAdminDateTime(submission.createdAt)}
                </span>
                <span>
                  보유 만료 {formatAdminDateTime(submission.retentionUntil)}
                </span>
                <span className="font-mono text-xs">
                  {submission.modelName}
                </span>
              </div>
            </div>
            <Link
              href={`/admin/submissions/${submission.id}`}
              aria-label={`문서 열기: ${submission.profileTitle}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#9fb3a5] px-4 text-sm font-bold text-[#18452f] transition hover:bg-[#edf5ef]"
            >
              {submission.documentAccess === "full" ? "전문 보기" : "요약 보기"}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </article>
        </li>
      ))}
    </ul>
  );
}
