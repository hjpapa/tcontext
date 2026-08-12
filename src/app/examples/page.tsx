import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  PencilLine,
  School,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { EvidenceBadge } from "@/components/profile/evidence-badge";
import { Button } from "@/components/ui/button";
import {
  AI_EXECUTION_INSTRUCTIONS,
  LESSON_TASK_CONTEXT_ITEMS,
} from "@/content/profile-document";
import {
  FICTIONAL_PROFILE_BY_SCHOOL_LEVEL,
  FICTIONAL_PROFILES,
} from "@/content/examples";
import type { SchoolLevel } from "@/types/profile";

export const metadata: Metadata = {
  title: "완성 문서 예시",
  description:
    "공통 9개, 학교급 1개, 역할 1개의 인터뷰 답변이 검토 가능한 교사 컨텍스트 문서가 되는 과정을 살펴봅니다.",
};

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

const INTERVIEW_STRUCTURE = [
  {
    count: "9",
    label: "공통 질문",
    description: "교육관, 수업 흐름, 판단 성향, 평가와 AI 활용",
  },
  {
    count: "1",
    label: "학교급 질문",
    description: "발달 단계에 맞춘 참여와 정서 지원",
  },
  {
    count: "1",
    label: "역할 질문",
    description: "담임 또는 교과교사로서의 실제 판단",
  },
] as const;

const EVIDENCE_EXAMPLES = [
  {
    basis: "direct" as const,
    number: "01",
    title: "교사가 직접 말한 내용",
    description:
      "인터뷰 답변에 분명하게 나타난 경험과 판단입니다. 답변과 연결된 근거를 확인할 수 있습니다.",
    className: "border-emerald-950/15 bg-emerald-950/[0.035]",
  },
  {
    basis: "inferred" as const,
    number: "02",
    title: "AI가 종합한 해석",
    description:
      "여러 답변을 연결해 풍부하게 만든 초안입니다. 교사가 뜻에 맞게 고치거나 삭제할 수 있습니다.",
    className: "border-amber-700/20 bg-amber-50/60",
  },
  {
    basis: "needs_confirmation" as const,
    number: "03",
    title: "교사의 확인이 필요한 내용",
    description:
      "근거가 충분하지 않거나 뜻이 갈릴 수 있는 문장입니다. 확인 전에는 최종 문서가 되지 않습니다.",
    className: "border-rose-800/15 bg-rose-50/60",
  },
] as const;

const LESSON_TASK_CONTEXT_PREVIEW = [
  'task_type: "수업 설계 | 슬라이드 | 활동지 | 평가 | 수업 검토"',
  'grade: ""',
  'subject: ""',
  'unit_or_topic: ""',
  'achievement_standard: ""',
  "lesson_duration_minutes: 40",
  "number_of_lessons: 1",
  'learning_goal: ""',
  'essential_question: ""',
  'core_student_activity: ""',
  'student_use_of_ai: "없음 | 교사 시연 | 모둠 활용 | 학생 개별 활용"',
  'available_devices_and_tools: ""',
  'materials: ""',
  'classwide_learning_supports: ""',
  'classwide_participation_or_emotional_supports: ""',
  'desired_output: "수업안 | 슬라이드 구성안 | 활동지 | 평가 기준"',
  'must_include: ""',
  'constraints: ""',
] as const;

const DEFAULT_SCHOOL_LEVEL: SchoolLevel = "elementary";

type ExamplesPageProps = {
  searchParams: Promise<{ school?: string | string[] }>;
};

function isSchoolLevel(value: string | undefined): value is SchoolLevel {
  return FICTIONAL_PROFILES.some(
    (profile) => profile.metadata.schoolLevel === value,
  );
}

export default async function ExamplesPage({
  searchParams,
}: ExamplesPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedSchool = Array.isArray(resolvedSearchParams.school)
    ? resolvedSearchParams.school[0]
    : resolvedSearchParams.school;
  const selectedSchool = isSchoolLevel(requestedSchool)
    ? requestedSchool
    : DEFAULT_SCHOOL_LEVEL;
  const selectedProfile = FICTIONAL_PROFILE_BY_SCHOOL_LEVEL[selectedSchool];

  return (
    <div className="overflow-x-hidden">
      <section className="relative border-b">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center px-5 py-16 sm:px-8 sm:py-20 lg:min-h-[660px] lg:px-12 xl:px-16">
            <p className="eyebrow">완성 문서 미리보기</p>
            <h1 className="mt-5 max-w-3xl text-[clamp(2.75rem,6vw,5.25rem)] leading-[1.04] font-semibold tracking-[-0.055em] text-balance">
              열한 번의 답변이
              <span className="text-primary mt-2 block">
                수업을 위한 맥락이 됩니다
              </span>
            </h1>
            <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-8 sm:text-xl">
              TContext는 교사를 유형화하지 않습니다. 실제 경험을 바탕으로 AI가
              풍부한 초안을 만들고, 선생님이 모든 문장을 직접 검토해 완성합니다.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/interview">
                  내 인터뷰 시작하기
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base"
              >
                <Link href="#school-examples">학교급별 예시 보기</Link>
              </Button>
            </div>
          </div>

          <div className="bg-secondary/55 flex items-center border-t px-5 py-14 sm:px-8 lg:border-t-0 lg:border-l lg:px-12 xl:px-16">
            <div className="bg-card w-full rounded-[1.5rem] border p-5 shadow-[0_24px_70px_rgba(35,55,44,0.10)] sm:p-7">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="eyebrow">인터뷰 구조</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    한 질문에는 하나의 판단만
                  </h2>
                </div>
                <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <BookOpen className="size-5" aria-hidden="true" />
                </span>
              </div>

              <ol className="mt-7 space-y-3" aria-label="열한 개 질문의 구성">
                {INTERVIEW_STRUCTURE.map((item) => (
                  <li
                    className="bg-background grid grid-cols-[3.25rem_1fr] gap-4 rounded-xl border p-4"
                    key={item.label}
                  >
                    <span className="text-primary font-mono text-3xl leading-none font-semibold">
                      {item.count}
                    </span>
                    <div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-muted-foreground mt-1 text-xs leading-5 sm:text-sm">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="bg-primary text-primary-foreground mt-4 flex items-center gap-4 rounded-xl p-4">
                <FileText className="size-5 shrink-0" aria-hidden="true" />
                <p className="text-sm leading-6">
                  <strong className="font-semibold">총 11개 질문</strong>에서
                  검토 가능한 7개 모듈의 문서가 만들어집니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div className="max-w-lg">
            <p className="eyebrow">검토 가능한 AI 초안</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              사실과 해석을
              <br />
              한눈에 구분합니다
            </h2>
            <p className="text-muted-foreground mt-5 leading-7">
              AI가 문서를 풍부하게 만들 수는 있지만, 교사의 뜻을 대신 확정할
              수는 없습니다. 그래서 모든 문장에 근거 상태를 표시합니다.
            </p>
            <div className="mt-7 flex items-start gap-3 rounded-xl border p-4">
              <PencilLine
                className="text-primary mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm leading-6">
                <strong className="font-semibold">어떤 상태의 문장이든</strong>
                <br />
                선생님이 직접 수정하거나 삭제할 수 있습니다.
              </p>
            </div>
          </div>

          <ol className="grid gap-4 md:grid-cols-3">
            {EVIDENCE_EXAMPLES.map((item) => (
              <li
                className={`rounded-2xl border p-5 sm:p-6 ${item.className}`}
                key={item.basis}
              >
                <div className="flex items-center justify-between gap-3">
                  <EvidenceBadge basis={item.basis} />
                  <span className="text-muted-foreground font-mono text-xs">
                    {item.number}
                  </span>
                </div>
                <h3 className="mt-7 text-lg font-semibold">{item.title}</h3>
                <p className="text-muted-foreground mt-3 text-sm leading-6">
                  {item.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="school-examples"
        aria-labelledby="school-examples-title"
        className="bg-secondary/45 scroll-mt-20 border-y"
      >
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="eyebrow">학교급별 가상 프로필</p>
              <h2
                id="school-examples-title"
                className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl"
              >
                가까운 맥락부터
                <br />
                살펴보세요
              </h2>
            </div>
            <p className="text-muted-foreground max-w-2xl leading-7 lg:justify-self-end">
              아래 문서는 실제 인물이나 학교와 무관한 가상 예시입니다. 학교급을
              선택하면 해당 프로필의 요약과 7개 모듈을 집중해서 볼 수 있습니다.
            </p>
          </div>

          <nav className="mt-10" aria-label="학교급별 예시 선택">
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {FICTIONAL_PROFILES.map((profile) => {
                const schoolLevel = profile.metadata.schoolLevel;
                const isSelected = schoolLevel === selectedSchool;

                return (
                  <li key={schoolLevel}>
                    <Link
                      href={`/examples?school=${schoolLevel}#profile-example`}
                      aria-current={isSelected ? "page" : undefined}
                      className={`flex min-h-20 items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-white/12"
                            : "bg-secondary text-primary"
                        }`}
                      >
                        <School className="size-4" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block font-semibold">
                          {SCHOOL_LEVEL_LABELS[schoolLevel]}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs ${
                            isSelected
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {ROLE_LABELS[profile.metadata.role] ?? "교사 역할"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <article
            id="profile-example"
            aria-labelledby="profile-example-title"
            className="bg-background mt-6 scroll-mt-24 overflow-hidden rounded-2xl border shadow-[0_20px_55px_rgba(35,55,44,0.08)]"
          >
            <header className="border-b px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-secondary text-primary rounded-full px-3 py-1 text-xs font-semibold">
                  {SCHOOL_LEVEL_LABELS[selectedSchool]}
                </span>
                <span
                  className="text-muted-foreground text-xs"
                  aria-hidden="true"
                >
                  ·
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  {ROLE_LABELS[selectedProfile.metadata.role] ?? "교사 역할"}
                </span>
                <span className="text-muted-foreground ml-auto font-mono text-[11px]">
                  FICTIONAL PROFILE
                </span>
              </div>
              <h3
                id="profile-example-title"
                className="mt-5 max-w-4xl text-2xl font-semibold tracking-[-0.025em] sm:text-4xl"
              >
                {selectedProfile.profileTitle}
              </h3>
              <p className="text-muted-foreground mt-4 max-w-4xl text-base leading-7 sm:text-lg sm:leading-8">
                {selectedProfile.shortSummary}
              </p>
            </header>

            <div className="grid lg:grid-cols-[17rem_1fr]">
              <aside className="border-b p-5 sm:p-7 lg:border-r lg:border-b-0 lg:p-8">
                <div className="lg:sticky lg:top-24">
                  <p className="text-sm font-semibold">문서 지도</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    모듈 제목을 누르면 해당 내용으로 이동합니다.
                  </p>
                  <ol className="mt-5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                    {selectedProfile.modules.map((profileModule, index) => (
                      <li key={profileModule.id}>
                        <a
                          href={`#module-${selectedSchool}-${profileModule.id}`}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-11 items-start gap-3 rounded-lg px-2.5 py-2 text-xs leading-5"
                        >
                          <span className="text-primary mt-px font-mono text-[10px]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span>{profileModule.title}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                  <div className="bg-secondary/60 mt-6 rounded-xl p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <ShieldCheck
                        className="text-primary size-4"
                        aria-hidden="true"
                      />
                      가상 문서 안내
                    </p>
                    <p className="text-muted-foreground mt-2 text-xs leading-5">
                      실제 이름, 학교명, 학생 정보는 포함하지 않았습니다.
                    </p>
                  </div>
                </div>
              </aside>

              <div className="p-5 sm:p-8 lg:p-10">
                <div className="flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="eyebrow">7개 프로필 모듈</p>
                    <h4 className="mt-2 text-2xl font-semibold">
                      필요한 부분만 펼쳐 읽기
                    </h4>
                  </div>
                  <p className="text-muted-foreground text-xs leading-5">
                    요약은 항상 보이고, 근거 문장은 접어 둡니다.
                  </p>
                </div>

                <div className="divide-y">
                  {selectedProfile.modules.map((profileModule, index) => (
                    <details
                      id={`module-${selectedSchool}-${profileModule.id}`}
                      className="group scroll-mt-24 py-1"
                      key={profileModule.id}
                    >
                      <summary className="focus-visible:ring-ring flex min-h-24 cursor-pointer list-none items-start gap-4 rounded-lg px-1 py-6 marker:content-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:gap-6 [&::-webkit-details-marker]:hidden">
                        <span className="text-primary mt-1 shrink-0 font-mono text-xs">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold sm:text-lg">
                            {profileModule.title}
                          </span>
                          <span className="text-muted-foreground mt-2 block text-sm leading-6">
                            {profileModule.summary}
                          </span>
                        </span>
                        <span className="bg-secondary text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                          <ChevronDown
                            className="size-4 transition-transform group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </span>
                      </summary>
                      <div className="pb-7 pl-8 sm:pl-12">
                        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide">
                          근거 문장 {profileModule.claims.length}개
                        </p>
                        <ul className="space-y-3">
                          {profileModule.claims.map((claim) => (
                            <li
                              key={claim.id}
                              className="bg-card rounded-xl border p-4 sm:p-5"
                            >
                              <EvidenceBadge basis={claim.basis} />
                              <p className="mt-3 text-sm leading-7 sm:text-base">
                                {claim.text}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ))}
                </div>

                <details className="group bg-secondary/50 mt-6 rounded-xl border p-5 sm:p-6">
                  <summary className="focus-visible:ring-ring flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg font-semibold marker:content-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                    <Sparkles
                      className="text-primary size-5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1">
                      이 프로필의 수업 설계 요약 보기
                    </span>
                    <ChevronDown
                      className="size-4 shrink-0 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="mt-5 grid gap-5 border-t pt-5 md:grid-cols-2">
                    {[
                      {
                        title: "수업 설계 원칙",
                        items: selectedProfile.teachingDesignPrinciples,
                      },
                      {
                        title: "학급 지원 고려사항",
                        items: selectedProfile.classSupportConsiderations,
                      },
                      {
                        title: "현실적인 제약",
                        items: selectedProfile.realisticConstraints,
                      },
                      {
                        title: "AI 협업 지침",
                        items: selectedProfile.aiCollaborationInstructions,
                      },
                    ].map((group) => (
                      <section key={group.title}>
                        <h5 className="text-sm font-semibold">{group.title}</h5>
                        <ul className="text-muted-foreground mt-3 space-y-2 text-sm leading-6">
                          {group.items.map((item) => (
                            <li className="flex gap-2" key={item}>
                              <Check
                                className="text-primary mt-1 size-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </details>

                <section
                  aria-labelledby="lesson-design-output-title"
                  className="mt-10 border-t pt-8"
                >
                  <p className="eyebrow">수업 설계용 Markdown 구성</p>
                  <h4
                    id="lesson-design-output-title"
                    className="mt-2 text-2xl font-semibold tracking-tight"
                  >
                    7개 모듈 뒤에 이번 수업의 조건을 붙입니다
                  </h4>
                  <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-7 sm:text-base">
                    교사 프로필은 여러 수업에서 반복해 쓰고, 아래 작업
                    컨텍스트만 수업마다 새로 채웁니다. 이어지는 실행 지침은 AI가
                    프로필을 수업안으로 바꿀 때 지켜야 할 판단 기준입니다.
                  </p>

                  <p
                    className="text-muted-foreground mt-5 text-sm font-medium"
                    aria-label="완성 문서의 구성 순서"
                  >
                    7개 교사 프로필 모듈 → 수업 작업 컨텍스트(YAML) → AI 실행
                    지침
                  </p>

                  <div className="mt-5 space-y-3">
                    <details
                      id="lesson-task-context-preview"
                      className="group bg-background rounded-xl border p-5"
                    >
                      <summary className="focus-visible:ring-ring flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg font-semibold marker:content-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                        <FileText
                          className="text-primary size-5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="flex-1">
                          수업 작업 컨텍스트 YAML 미리보기
                        </span>
                        <ChevronDown
                          className="size-4 shrink-0 transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <div className="mt-4 border-t pt-4">
                        <p className="text-muted-foreground mb-3 text-sm leading-6">
                          학교급은 프로필에서 자동으로 채워지고, 나머지는 이번
                          수업에 맞게 입력합니다.
                        </p>
                        <p className="sr-only">
                          포함 항목: {LESSON_TASK_CONTEXT_ITEMS.join(", ")}
                        </p>
                        <pre className="bg-secondary/55 max-w-full overflow-x-auto rounded-xl p-4 text-xs leading-6 break-words whitespace-pre-wrap sm:text-sm">
                          <code>{`school_level: "${SCHOOL_LEVEL_LABELS[selectedSchool]}"\n${LESSON_TASK_CONTEXT_PREVIEW.join("\n")}`}</code>
                        </pre>
                      </div>
                    </details>

                    <details
                      id="ai-execution-guidance-preview"
                      className="group bg-background rounded-xl border p-5"
                    >
                      <summary className="focus-visible:ring-ring flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg font-semibold marker:content-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                        <Sparkles
                          className="text-primary size-5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="flex-1">AI 실행 지침 미리보기</span>
                        <ChevronDown
                          className="size-4 shrink-0 transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <ol className="text-muted-foreground mt-4 space-y-3 border-t pt-4 text-sm leading-6">
                        {AI_EXECUTION_INSTRUCTIONS.map((guidance, index) => (
                          <li className="flex gap-3" key={guidance}>
                            <span
                              className="text-primary shrink-0 font-mono text-xs font-semibold"
                              aria-hidden="true"
                            >
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{guidance}</span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </div>
                </section>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <p className="eyebrow">표현의 원칙</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              학생을 규정하지 않고,
              <br />
              지원할 조건을 씁니다
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-rose-800/15 bg-rose-50/65 p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-rose-900">
                개인을 규정하는 표현
              </h3>
              <p className="mt-5 text-lg leading-7">
                “수학을 못하는 학생들이 몇 명 있다.”
              </p>
              <p className="mt-4 text-sm leading-6 text-rose-950/65">
                고정된 능력처럼 단정해 학생을 판단합니다.
              </p>
            </article>
            <article className="rounded-2xl border border-emerald-950/15 bg-emerald-950/[0.035] p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-emerald-950">
                지원 중심 표현
              </h3>
              <p className="mt-5 text-lg leading-7">
                “짧은 예시와 단계별 안내를 제공하면 참여가 안정된다.”
              </p>
              <p className="mt-4 text-sm leading-6 text-emerald-950/65">
                교사가 제공할 수 있는 지원과 관찰 가능한 맥락을 설명합니다.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground border-t">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-20 text-center sm:px-8 lg:py-28">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10">
            <FileText className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-7 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
            이제 내 문서 만들기
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
            정답을 고르지 말고,
            <br />내 수업의 장면을 들려주세요
          </h2>
          <p className="mt-6 max-w-2xl leading-7 text-white/70">
            공통 9개, 학교급 1개, 역할 1개 질문에 답하면 AI가 검토 가능한 초안을
            만듭니다. 로그인이나 데이터 기여 없이 Markdown으로 가져갈 수
            있습니다.
          </p>
          <Button
            asChild
            size="lg"
            className="text-primary mt-9 h-12 bg-white px-7 text-base hover:bg-white/90"
          >
            <Link href="/interview">
              내 인터뷰 시작하기
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
