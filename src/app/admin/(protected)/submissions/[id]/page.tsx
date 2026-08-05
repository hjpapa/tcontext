import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Download,
  FileText,
  ShieldCheck,
} from "lucide-react";

import { AdminProfileDocument } from "@/components/admin/profile-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatAdminDateTime,
  SCHOOL_LEVEL_LABELS,
  teacherRoleLabel,
} from "@/lib/admin/presentation";
import { getAdminSubmission } from "@/lib/supabase/admin-submissions";

function MetadataItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-bold tracking-wide text-[#637168] uppercase">
        {label}
      </dt>
      <dd className="mt-1 break-all">{children}</dd>
    </div>
  );
}

export default async function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await getAdminSubmission(id);
  if (!submission) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-bold text-[#28684c] underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        저장 문서 목록
      </Link>

      <header className="mt-6 max-w-4xl space-y-4">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-[#28684c]">
          <ShieldCheck aria-hidden="true" className="size-5" />
          교사 검토·개인정보 검사 완료
        </p>
        <h1 className="text-3xl font-bold tracking-tight break-words sm:text-5xl">
          {submission.profileTitle}
        </h1>
        {submission.shortSummary.trim() ? (
          <p className="text-lg leading-8 text-[#536159]">
            {submission.shortSummary}
          </p>
        ) : (
          <p className="text-sm text-[#68756d] italic">
            요약이 입력되지 않았습니다.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {SCHOOL_LEVEL_LABELS[submission.schoolLevel]}
          </Badge>
          <Badge variant="outline">
            {teacherRoleLabel(submission.teacherRole)}
          </Badge>
        </div>
      </header>

      <div className="mt-8 flex flex-wrap gap-3" data-print-hidden="true">
        <Button asChild size="lg" className="min-h-11 bg-[#153f2e] text-white">
          <a href={`/admin/submissions/${submission.id}/download`}>
            <Download aria-hidden="true" />
            Markdown 다운로드
          </a>
        </Button>
      </div>

      <section aria-labelledby="submission-metadata-title" className="mt-10">
        <h2 id="submission-metadata-title" className="text-xl font-bold">
          저장 메타데이터
        </h2>
        <dl className="mt-4 grid gap-5 rounded-xl border border-[#dce2dc] bg-[#f7faf7] p-5 sm:grid-cols-2 lg:grid-cols-3">
          <MetadataItem label="제출 ID">
            <code className="text-xs">{submission.id}</code>
          </MetadataItem>
          <MetadataItem label="저장 시각">
            <time dateTime={submission.createdAt}>
              {formatAdminDateTime(submission.createdAt)}
            </time>
          </MetadataItem>
          <MetadataItem label="동의 시각">
            <time dateTime={submission.consentedAt}>
              {formatAdminDateTime(submission.consentedAt)}
            </time>
          </MetadataItem>
          <MetadataItem label="보유 만료">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock aria-hidden="true" className="size-4" />
              <time dateTime={submission.retentionUntil}>
                {formatAdminDateTime(submission.retentionUntil)}
              </time>
            </span>
          </MetadataItem>
          <MetadataItem label="모델">
            <code className="text-xs">{submission.modelName}</code>
          </MetadataItem>
          <MetadataItem label="버전">
            스키마 {submission.schemaVersion} · 프롬프트{" "}
            {submission.promptVersion} · 앱 {submission.appVersion} · 동의{" "}
            {submission.consentVersion}
          </MetadataItem>
        </dl>
      </section>

      <div className="mt-14">
        <AdminProfileDocument profile={submission.profile} />
      </div>

      <section aria-labelledby="stored-markdown-title" className="mt-14">
        <details className="group rounded-xl border border-[#cfd8d0] bg-white">
          <summary className="flex min-h-14 cursor-pointer items-center gap-2 px-5 font-bold">
            <FileText aria-hidden="true" className="size-5 text-[#28684c]" />
            <span id="stored-markdown-title">저장된 Markdown 원문 보기</span>
          </summary>
          <div className="border-t border-[#dce2dc] p-5">
            <pre className="max-h-[40rem] overflow-auto rounded-lg bg-[#f5f3ec] p-4 font-mono text-xs leading-6 break-words whitespace-pre-wrap">
              {submission.profileMarkdown}
            </pre>
          </div>
        </details>
      </section>
    </div>
  );
}
