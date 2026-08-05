import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

import { AdminSubmissionList } from "@/components/admin/submission-list";
import { Button } from "@/components/ui/button";
import { SCHOOL_LEVEL_LABELS } from "@/lib/admin/presentation";
import { listAdminSubmissions } from "@/lib/supabase/admin-submissions";
import {
  SCHOOL_LEVELS,
  schoolLevelSchema,
  type SchoolLevel,
} from "@/types/profile";

type AdminSearchParams = {
  page?: string | string[];
  schoolLevel?: string | string[];
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(page: number, schoolLevel?: SchoolLevel): string {
  const params = new URLSearchParams({ page: String(page) });
  if (schoolLevel) params.set("schoolLevel", schoolLevel);
  return `/admin?${params.toString()}`;
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const resolved = await searchParams;
  const requestedPage = Number(first(resolved.page) ?? "1");
  const parsedSchoolLevel = schoolLevelSchema.safeParse(
    first(resolved.schoolLevel),
  );
  const schoolLevel = parsedSchoolLevel.success
    ? parsedSchoolLevel.data
    : undefined;
  const result = await listAdminSubmissions({
    page: requestedPage,
    schoolLevel,
  });
  if (result.page > result.totalPages) {
    redirect(pageHref(result.totalPages, schoolLevel));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-4xl space-y-4">
        <p className="text-sm font-bold text-[#28684c]">읽기 전용 관리자</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          저장된 TContext 문서
        </h1>
        <p className="text-lg leading-8 text-[#536159]">
          사용자가 최종 확인하고 저장에 동의한 문서입니다. 원본 인터뷰 답변과
          삭제 코드 원문은 저장되지 않으며 이 화면에서도 조회하지 않습니다.
        </p>
      </header>

      <section aria-labelledby="admin-filter-title" className="mt-10">
        <h2 id="admin-filter-title" className="sr-only">
          문서 필터
        </h2>
        <form
          method="get"
          className="flex flex-col gap-3 rounded-xl border border-[#dce2dc] bg-[#f7faf7] p-4 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="school-level-filter" className="text-sm font-bold">
              학교급
            </label>
            <select
              id="school-level-filter"
              name="schoolLevel"
              defaultValue={schoolLevel ?? ""}
              className="min-h-11 w-full rounded-lg border border-[#b8c8bc] bg-white px-3 text-sm sm:max-w-xs"
            >
              <option value="">전체 학교급</option>
              {SCHOOL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {SCHOOL_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline" className="min-h-11 px-4">
            <Filter aria-hidden="true" />
            필터 적용
          </Button>
          {schoolLevel ? (
            <Button asChild variant="ghost" className="min-h-11">
              <Link href="/admin">필터 해제</Link>
            </Button>
          ) : null}
        </form>
      </section>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-sm text-[#536159]">
          총 <strong className="text-[#18251e]">{result.total}</strong>개
        </p>
        <p className="text-sm text-[#536159]">
          {result.page} / {result.totalPages} 페이지
        </p>
      </div>

      <div className="mt-3">
        <AdminSubmissionList submissions={result.items} />
      </div>

      {result.totalPages > 1 ? (
        <nav
          aria-label="저장 문서 페이지 이동"
          className="mt-8 flex items-center justify-between gap-4"
        >
          {result.page > 1 ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={pageHref(result.page - 1, schoolLevel)}>
                <ChevronLeft aria-hidden="true" />
                이전
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {result.page < result.totalPages ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={pageHref(result.page + 1, schoolLevel)}>
                다음
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
