import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";

import { EvidenceBadge } from "@/components/profile/evidence-badge";
import { Button } from "@/components/ui/button";
import { FICTIONAL_PROFILES } from "@/content/examples";
import type { SchoolLevel } from "@/types/profile";

const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  kindergarten: "유치원",
  elementary: "초등학교",
  middle: "중학교",
  high: "고등학교",
};

const ROLE_LABELS: Record<string, string> = {
  homeroom_teacher: "담임교사",
  subject_teacher: "교과교사",
};

export default function ExamplesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <article className="space-y-14">
        <header className="max-w-4xl space-y-4">
          <p className="text-sm font-bold text-[#28684c]">가상 예시</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            유형표가 아니라, 수업을 함께 설계하기 위한 맥락 문서입니다
          </h1>
          <p className="text-lg leading-8 text-[#536159]">
            아래 네 문서는 실제 인물이나 학교와 무관한 가상 예시입니다. 좋은
            결과는 교사를 판단하지 않고, 확인된 경험과 현실의 제약을 다음 수업
            설계에 쓰기 좋게 설명합니다.
          </p>
        </header>

        <section aria-labelledby="profiles-title" className="space-y-6">
          <div className="max-w-3xl space-y-2">
            <p className="text-sm font-bold text-[#28684c]">
              학교급별 가상 프로필
            </p>
            <h2 id="profiles-title" className="text-3xl font-bold">
              유치원부터 고등학교까지
            </h2>
            <p className="leading-7 text-[#536159]">
              각 예시는 같은 7개 모듈을 사용합니다. 문장을 펼쳐 보면 AI가 참고할
              수 있는 수업 맥락의 구체성을 확인할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {FICTIONAL_PROFILES.map((profile) => (
              <article
                key={profile.metadata.schoolLevel}
                className="border-t-4 border-[#3b7a57] bg-[#f7faf7] p-5 sm:p-7"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#28684c]">
                  <span>
                    {SCHOOL_LEVEL_LABELS[profile.metadata.schoolLevel]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {ROLE_LABELS[profile.metadata.role] ?? "교사 역할"}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-bold">
                  {profile.profileTitle}
                </h3>
                <p className="mt-3 leading-7 text-[#536159]">
                  {profile.shortSummary}
                </p>

                <details className="group mt-6 border-t border-[#cfd8d0] pt-4">
                  <summary className="min-h-11 cursor-pointer font-bold underline decoration-[#8ca795] underline-offset-4 focus-visible:ring-2 focus-visible:ring-[#28684c] focus-visible:outline-none">
                    7개 모듈과 근거 문장 보기
                  </summary>
                  <div className="mt-5 space-y-6">
                    {profile.modules.map((profileModule) => (
                      <section key={profileModule.id}>
                        <h4 className="font-bold">{profileModule.title}</h4>
                        <p className="mt-1 text-sm leading-6 text-[#536159]">
                          {profileModule.summary}
                        </p>
                        <ul className="mt-3 space-y-3">
                          {profileModule.claims.map((claim) => (
                            <li
                              key={claim.id}
                              className="border-l-2 border-[#b8c8bc] pl-3"
                            >
                              <EvidenceBadge basis={claim.basis} />
                              <p className="mt-2 leading-7">{claim.text}</p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="evidence-title" className="space-y-5">
          <div>
            <p className="text-sm font-bold text-[#28684c]">
              문장마다 근거 상태 표시
            </p>
            <h2 id="evidence-title" className="mt-2 text-3xl font-bold">
              교사의 말과 AI의 해석을 섞지 않습니다
            </h2>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            <li className="border-l-2 border-[#b8c8bc] bg-[#f7faf7] p-4">
              <EvidenceBadge basis="direct" />
              <p className="mt-3 leading-7">
                인터뷰에서 교사가 직접 말한 내용입니다.
              </p>
            </li>
            <li className="border-l-2 border-[#d7bd8b] bg-[#fffaf0] p-4">
              <EvidenceBadge basis="inferred" />
              <p className="mt-3 leading-7">
                답변을 바탕으로 AI가 추론했으며 교사가 수정할 수 있습니다.
              </p>
            </li>
            <li className="border-l-2 border-[#dda5a0] bg-[#fff5f3] p-4">
              <EvidenceBadge basis="needs_confirmation" />
              <p className="mt-3 leading-7">
                근거가 충분하지 않아 교사의 확인이 필요한 문장입니다.
              </p>
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="language-title"
          className="grid gap-8 lg:grid-cols-2"
        >
          <div className="border-l-4 border-[#a6443d] bg-[#fff0ee] p-5">
            <h2
              id="language-title"
              className="flex items-center gap-2 font-bold"
            >
              <X aria-hidden="true" className="size-5" />
              개인을 규정하는 표현
            </h2>
            <p className="mt-3 text-lg">“수학을 못하는 학생들이 몇 명 있다.”</p>
            <p className="mt-2 text-sm leading-6 text-[#653c38]">
              개인의 특성을 단정하고 학생의 고정된 능력으로 판단합니다.
            </p>
          </div>
          <div className="border-l-4 border-[#3b7a57] bg-[#edf5ef] p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Check aria-hidden="true" className="size-5" />
              지원 중심 표현
            </h2>
            <p className="mt-3 text-lg">
              “기초 개념을 확인할 수 있는 짧은 예시와 단계별 안내를 제공하면
              참여가 안정되는 학생들이 있다.”
            </p>
            <p className="mt-2 text-sm leading-6 text-[#365142]">
              학생이 아니라 교사가 제공할 수 있는 지원과 관찰 가능한 맥락을
              설명합니다.
            </p>
          </div>
        </section>

        <div>
          <Button
            asChild
            size="lg"
            className="min-h-12 bg-[#153f2e] px-6 text-base text-white"
          >
            <Link href="/interview">
              내 인터뷰 시작하기
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </article>
    </div>
  );
}
