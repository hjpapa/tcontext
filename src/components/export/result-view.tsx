"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, ShieldCheck } from "lucide-react";

import { ContributionPanel } from "@/components/consent/contribution-panel";
import { ResultActions } from "@/components/export/result-actions";
import { EvidenceBadge } from "@/components/profile/evidence-badge";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { Button } from "@/components/ui/button";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";

export function ResultView({
  consentVersion,
  retentionDays,
}: {
  consentVersion: string;
  retentionDays: number;
}) {
  const router = useRouter();
  const { profile, markdown, clearBrowserRecords } = useInterviewSession();
  const finalMarkdown = useMemo(() => {
    if (!profile) return "";
    return markdown || profileToMarkdown(profile);
  }, [markdown, profile]);

  if (!profile) {
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

  return (
    <section aria-labelledby="result-title" className="space-y-12">
      <header className="max-w-4xl space-y-4">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-[#28684c]">
          <ShieldCheck aria-hidden="true" className="size-5" />
          교사 검토·개인정보 검사 완료
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

      <ResultActions profile={profile} markdown={finalMarkdown} />

      <article
        className="space-y-10 border-y border-[#cfd8d0] py-10 print:border-0"
        aria-label="완성된 교사 프로필"
      >
        {profile.modules.map((module, index) => (
          <section key={module.id} aria-labelledby={`result-${module.id}`}>
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
          <section>
            <h2 className="text-xl font-bold">수업 설계 원칙</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
              {profile.teachingDesignPrinciples.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold">학급 지원 고려사항</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
              {profile.classSupportConsiderations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold">현실적인 제약</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
              {profile.realisticConstraints.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold">AI 협업 지침</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
              {profile.aiCollaborationInstructions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      <ContributionPanel
        profile={profile}
        markdown={finalMarkdown}
        consentVersion={consentVersion}
        retentionDays={retentionDays}
      />

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
