"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { ContributionPanel } from "@/components/consent/contribution-panel";
import { ResultActions } from "@/components/export/result-actions";
import { EvidenceBadge } from "@/components/profile/evidence-badge";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { Button } from "@/components/ui/button";
import {
  AI_EXECUTION_INSTRUCTIONS,
  LESSON_TASK_CONTEXT_ITEMS,
  RESULT_USAGE_STEPS,
} from "@/content/profile-document";

export function ResultView({
  consentVersion,
  retentionDays,
}: {
  consentVersion: string;
  retentionDays: number;
}) {
  const router = useRouter();
  const { profile, markdown, clearBrowserRecords } = useInterviewSession();

  if (!profile || !markdown) {
    return (
      <section className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-3xl font-bold">완성된 문서가 없습니다.</h1>
        <p className="mt-4 text-lg leading-8 text-[#536159]">
          개인정보 보호를 위해 문서는 이 탭의 메모리에만 둡니다. 새로고침했다면
          인터뷰를 다시 진행해 주세요.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 min-h-12 bg-[#153f2e] text-white"
        >
          <Link href="/interview">인터뷰 시작하기</Link>
        </Button>
      </section>
    );
  }

  const privacyReviewClear = profile.privacyReview.status === "clear";

  return (
    <section aria-labelledby="result-title" className="space-y-12">
      <header className="max-w-4xl space-y-4">
        <p
          className={`inline-flex items-center gap-2 text-sm font-bold ${
            privacyReviewClear ? "text-[#28684c]" : "text-[#8a4d1d]"
          }`}
        >
          {privacyReviewClear ? (
            <ShieldCheck aria-hidden="true" className="size-5" />
          ) : (
            <ShieldAlert aria-hidden="true" className="size-5" />
          )}
          {privacyReviewClear
            ? "교사 검토·개인정보 검사 완료"
            : "개인정보 경고를 확인하고 만든 문서"}
        </p>
        <h1
          id="result-title"
          className="text-3xl font-bold tracking-tight sm:text-5xl"
        >
          {profile.profileTitle}
        </h1>
        <p className="text-lg leading-8 text-[#536159]">
          {profile.shortSummary}
        </p>
      </header>

      {!privacyReviewClear ? (
        <div
          role="status"
          className="border-l-4 border-[#b66a2c] bg-[#fff8ec] p-5 text-[#653f20]"
        >
          <p className="font-bold">자동 검사 경고가 남아 있는 문서입니다.</p>
          <p className="mt-1 text-sm leading-6">
            공유하거나 다른 AI에 입력하기 전에 식별 가능한 정보가 없는지 직접
            확인해 주세요. 이 문서는 선택적 데이터 기여를 할 수 없습니다.
          </p>
        </div>
      ) : null}

      <section
        aria-labelledby="lesson-design-usage-title"
        className="border-primary/25 bg-primary/5 rounded-3xl border p-6 sm:p-8"
        data-print-section="true"
      >
        <div className="flex items-start gap-3">
          <BookOpenCheck
            aria-hidden="true"
            className="text-primary mt-1 size-6 shrink-0"
          />
          <div>
            <h2 id="lesson-design-usage-title" className="text-2xl font-bold">
              이 문서를 수업 설계에 사용하는 법
            </h2>
            <p className="text-muted-foreground mt-2 max-w-3xl leading-7">
              전체 Markdown에는 아래 교사 프로필과 함께 수업별 작업 양식, AI
              실행 프롬프트, 생성 결과 점검표가 포함됩니다.
            </p>
          </div>
        </div>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {RESULT_USAGE_STEPS.map((step, index) => (
            <li key={step.title} className="bg-card rounded-2xl border p-5">
              <p className="text-primary text-sm font-bold">{index + 1}단계</p>
              <h3 className="mt-1 font-bold">{step.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
        <details
          className="bg-card mt-5 rounded-2xl border p-5"
          data-print-expanded="true"
        >
          <summary className="min-h-11 cursor-pointer font-bold">
            수업 작업 양식과 AI 실행 원칙 미리 보기
          </summary>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <section aria-labelledby="task-context-preview-title">
              <h3 id="task-context-preview-title" className="font-bold">
                수업마다 추가할 정보
              </h3>
              <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                {LESSON_TASK_CONTEXT_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="ai-instruction-preview-title">
              <h3 id="ai-instruction-preview-title" className="font-bold">
                AI가 따라야 할 실행 원칙
              </h3>
              <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                {AI_EXECUTION_INSTRUCTIONS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </details>
      </section>

      <ResultActions profile={profile} markdown={markdown} />

      <article
        className="space-y-10 border-y border-[#cfd8d0] py-10 print:border-0"
        aria-label="완성된 교사 프로필"
      >
        {profile.modules.map((module, index) => (
          <section
            key={module.id}
            aria-labelledby={`result-${module.id}`}
            data-print-section="true"
          >
            <p className="text-sm font-bold text-[#28684c]">
              {index + 1} / {profile.modules.length}
            </p>
            <h2 id={`result-${module.id}`} className="mt-1 text-2xl font-bold">
              {module.title}
            </h2>
            <p className="mt-3 max-w-4xl leading-7 text-[#536159]">
              {module.summary}
            </p>
            <ul className="mt-4 space-y-3">
              {module.claims.map((claim) => (
                <li
                  key={claim.id}
                  data-print-claim="true"
                  className="flex flex-col gap-2 border-l-2 border-[#b8c8bc] pl-4 sm:flex-row sm:items-start"
                >
                  <EvidenceBadge basis={claim.basis} />
                  <span className="leading-7">{claim.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="grid gap-8 lg:grid-cols-2">
          <section data-print-section="true">
            <h2 className="text-xl font-bold">수업 설계 원칙</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
              {profile.teachingDesignPrinciples.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section data-print-section="true">
            <h2 className="text-xl font-bold">학급 지원 고려사항</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
              {profile.classSupportConsiderations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section data-print-section="true">
            <h2 className="text-xl font-bold">현실적인 제약</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
              {profile.realisticConstraints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section data-print-section="true">
            <h2 className="text-xl font-bold">AI 협업 지침</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
              {profile.aiCollaborationInstructions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      <div data-print-hidden="true">
        <ContributionPanel
          profile={profile}
          markdown={markdown}
          consentVersion={consentVersion}
          retentionDays={retentionDays}
        />
      </div>

      <section className="border-t border-[#cfd8d0] pt-8 print:hidden">
        <h2 className="text-xl font-bold">이 탭의 기록 지우기</h2>
        <p className="mt-2 max-w-2xl leading-7 text-[#536159]">
          다운로드를 확인한 뒤 지워 주세요. 지우면 인터뷰, 초안, 문서와 아직
          복사하지 않은 삭제 코드를 복구할 수 없습니다.
        </p>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          className="mt-4 min-h-12"
          onClick={() => {
            if (
              window.confirm(
                "이 탭의 인터뷰와 완성 문서를 모두 지울까요? 다운로드한 파일과 이미 기여한 데이터는 삭제되지 않습니다.",
              )
            ) {
              clearBrowserRecords();
              router.push("/");
            }
          }}
        >
          <RotateCcw aria-hidden="true" />이 탭의 모든 기록 삭제
        </Button>
      </section>
    </section>
  );
}
