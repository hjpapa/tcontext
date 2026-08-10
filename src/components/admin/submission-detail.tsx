import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Download,
  FileText,
  ShieldAlert,
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
import type {
  AdminSubmissionAccessReason,
  AdminSubmissionDetail as AdminSubmissionDetailData,
} from "@/lib/supabase/admin-submissions";

const SUMMARY_REASON_MESSAGES: Record<AdminSubmissionAccessReason, string> = {
  consent_missing:
    "최종 저장 동의 기록을 확인할 수 없어 제목과 요약만 표시합니다.",
  privacy_not_clear:
    "개인정보 검토가 완료 상태가 아니어서 제목과 요약만 표시합니다.",
  claims_unconfirmed:
    "교사가 아직 확인하지 않은 문장이 있어 제목과 요약만 표시합니다.",
  profile_incomplete:
    "이전 형식이거나 문서 구조가 불완전하여 제목과 요약만 표시합니다.",
  markdown_unavailable:
    "저장된 원문을 검증할 수 없어 제목과 요약만 표시합니다.",
};

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

export function AdminSubmissionDetail({
  submission,
}: {
  submission: AdminSubmissionDetailData;
}) {
  const hasFullAccess = submission.documentAccess === "full";

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
          {hasFullAccess ? (
            <ShieldCheck aria-hidden="true" className="size-5" />
          ) : (
            <ShieldAlert aria-hidden="true" className="size-5" />
          )}
          {hasFullAccess
            ? "최종 확인·개인정보 검토·저장 동의 완료"
            : "보호된 요약 열람"}
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
          <Badge variant={hasFullAccess ? "default" : "outline"}>
            {hasFullAccess ? "전문 열람 가능" : "요약만"}
          </Badge>
        </div>
      </header>

      {hasFullAccess ? (
        <div className="mt-8 flex flex-wrap gap-3" data-print-hidden="true">
          <Button
            asChild
            size="lg"
            className="min-h-11 bg-[#153f2e] text-white"
          >
            <a href={`/admin/submissions/${submission.id}/download`}>
              <Download aria-hidden="true" />
              Markdown 다운로드
            </a>
          </Button>
        </div>
      ) : (
        <aside
          aria-labelledby="summary-access-title"
          className="mt-8 rounded-xl border border-[#d9c7a8] bg-[#fff9ed] p-5"
        >
          <h2 id="summary-access-title" className="font-bold text-[#5f4318]">
            이 문서는 요약만 열람할 수 있습니다
          </h2>
          <p className="mt-2 leading-7 text-[#6d5632]">
            {SUMMARY_REASON_MESSAGES[submission.accessReason]} 원문과 Markdown
            다운로드는 제공하지 않습니다.
          </p>
        </aside>
      )}

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
          <MetadataItem label="보유 만료">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock aria-hidden="true" className="size-4" />
              <time dateTime={submission.retentionUntil}>
                {formatAdminDateTime(submission.retentionUntil)}
              </time>
            </span>
          </MetadataItem>
          <MetadataItem label="학교급">
            {SCHOOL_LEVEL_LABELS[submission.schoolLevel]}
          </MetadataItem>
          <MetadataItem label="역할">
            {teacherRoleLabel(submission.teacherRole)}
          </MetadataItem>
          <MetadataItem label="모델">
            <code className="text-xs">{submission.modelName}</code>
          </MetadataItem>
          <MetadataItem label="버전">
            스키마 {submission.schemaVersion} · 프롬프트{" "}
            {submission.promptVersion} · 앱 {submission.appVersion}
            {hasFullAccess ? ` · 동의 ${submission.consentVersion}` : ""}
          </MetadataItem>
          {hasFullAccess ? (
            <MetadataItem label="동의 시각">
              <time dateTime={submission.consentedAt}>
                {formatAdminDateTime(submission.consentedAt)}
              </time>
            </MetadataItem>
          ) : null}
        </dl>
      </section>

      {hasFullAccess ? (
        <>
          <div className="mt-14">
            <AdminProfileDocument profile={submission.profile} />
          </div>

          <section aria-labelledby="stored-markdown-title" className="mt-14">
            <details className="group rounded-xl border border-[#cfd8d0] bg-white">
              <summary className="flex min-h-14 cursor-pointer items-center gap-2 px-5 font-bold">
                <FileText
                  aria-hidden="true"
                  className="size-5 text-[#28684c]"
                />
                <span id="stored-markdown-title">
                  저장된 Markdown 원문 보기
                </span>
              </summary>
              <div className="border-t border-[#dce2dc] p-5">
                <pre className="max-h-[40rem] overflow-auto rounded-lg bg-[#f5f3ec] p-4 font-mono text-xs leading-6 break-words whitespace-pre-wrap">
                  {submission.profileMarkdown}
                </pre>
              </div>
            </details>
          </section>
        </>
      ) : null}
    </div>
  );
}
