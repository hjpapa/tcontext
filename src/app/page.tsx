import Link from "next/link";
import {
  ArrowRight,
  Check,
  Download,
  FileText,
  LockKeyhole,
  MessageCircleQuestion,
  PencilLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getRetentionDays } from "@/lib/consent/policy";

const modules = [
  "기본 프로파일과 현재 역할",
  "교육관과 학생관",
  "선호 수업 방식",
  "학급·수업 집단 맥락",
  "참여와 정서 지원",
  "평가·피드백·의사소통",
  "환경·제약·AI 활용",
];

const principles = [
  {
    icon: MessageCircleQuestion,
    title: "경험에서 시작하는 질문",
    description:
      "정답을 고르는 검사가 아니라, 실제 수업에서 내렸던 판단과 경험을 차분히 돌아봅니다.",
  },
  {
    icon: PencilLine,
    title: "교사가 끝까지 편집",
    description:
      "직접 진술과 AI의 해석을 구분하고, 모든 문장을 수정하거나 삭제한 뒤 확정합니다.",
  },
  {
    icon: LockKeyhole,
    title: "저장 없이도 완성",
    description:
      "로그인과 데이터 기여 없이 인터뷰부터 Markdown 다운로드까지 모두 이용할 수 있습니다.",
  },
];

export default function Home() {
  const retentionDays = getRetentionDays();

  return (
    <div className="overflow-x-hidden">
      <div>
        <section className="relative border-b">
          <div className="mx-auto grid max-w-7xl lg:grid-cols-[1.06fr_0.94fr]">
            <div className="flex flex-col justify-center px-5 py-20 sm:px-8 lg:min-h-[680px] lg:px-12 xl:px-16">
              <Badge
                className="mb-7 w-fit rounded-full px-3 py-1 font-medium"
                variant="secondary"
              >
                <ShieldCheck aria-hidden="true" />
                로그인 없이, 저장 없이
              </Badge>
              <h1 className="max-w-3xl text-[clamp(2.75rem,6vw,5.5rem)] leading-[1.03] font-semibold tracking-[-0.055em] text-balance">
                교사의 수업 맥락을,
                <span className="text-primary mt-2 block">
                  AI가 이해할 문서로.
                </span>
              </h1>
              <p className="text-muted-foreground mt-8 max-w-2xl text-lg leading-8 text-pretty sm:text-xl">
                11개의 핵심 질문을 따라 나의 교육관, 수업 방식, 판단 성향과 학급
                맥락을 13–20분 동안 정리합니다. 교사가 검토한 결과만 여러 생성형
                AI에서 활용할 수 있는 Markdown 문서로 완성됩니다.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-13 px-6 text-base">
                  <Link href="/interview">
                    인터뷰 시작하기
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-13 px-6 text-base"
                >
                  <Link href="/examples">가상 예시 보기</Link>
                </Button>
              </div>
              <div className="text-muted-foreground mt-12 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                {[
                  "회원가입 없음",
                  "원본 답변 미저장",
                  "11개 맞춤 질문",
                  "범용 Markdown",
                ].map((item) => (
                  <span className="flex items-center gap-2" key={item}>
                    <span className="bg-primary/10 text-primary flex size-5 items-center justify-center rounded-full">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-secondary/55 flex items-center border-t px-5 py-16 sm:px-8 lg:border-t-0 lg:border-l lg:px-12 xl:px-16">
              <div className="bg-card w-full rounded-[1.5rem] border p-5 shadow-[0_24px_70px_rgba(35,55,44,0.10)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">완성 문서 미리보기</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">
                      나의 교사 컨텍스트
                    </h2>
                  </div>
                  <span className="bg-secondary text-muted-foreground rounded-md border px-2.5 py-1 font-mono text-[11px]">
                    .md
                  </span>
                </div>
                <Separator className="my-5" />
                <div className="grid gap-5 sm:grid-cols-[0.8fr_1.2fr]">
                  <ol className="space-y-2" aria-label="문서 모듈">
                    {modules.map((module, index) => (
                      <li
                        className={
                          index === 3
                            ? "bg-primary text-primary-foreground rounded-lg px-3 py-2.5 text-sm font-medium"
                            : "text-muted-foreground px-3 py-1.5 text-xs leading-5"
                        }
                        key={module}
                      >
                        <span className="mr-2 font-mono text-[10px] opacity-70">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {module}
                      </li>
                    ))}
                  </ol>
                  <div className="bg-background rounded-xl border p-4">
                    <p className="text-primary text-xs font-semibold">
                      04 · 학급 맥락
                    </p>
                    <p className="mt-3 text-sm leading-6">
                      학생들이 생각을 안전하게 꺼낼 수 있도록, 전체 발표 전에 짝
                      대화와 짧은 기록 시간을 둡니다.
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="rounded-full bg-emerald-950 px-2 py-1 text-[10px] font-semibold text-white">
                        직접 진술
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        교사 확인 완료
                      </span>
                    </div>
                    <div className="border-primary/35 bg-primary/[0.04] mt-5 rounded-lg border border-dashed p-3">
                      <p className="flex items-center gap-2 text-xs font-semibold">
                        <Sparkles className="size-3.5" aria-hidden="true" />
                        AI 협업 지침
                      </p>
                      <p className="text-muted-foreground mt-2 text-xs leading-5">
                        학생의 생각이 먼저 드러나도록 질문과 기다림 시간을
                        포함한다.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-secondary mt-5 flex items-center justify-between rounded-xl px-4 py-3">
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <FileText className="size-4" aria-hidden="true" />
                    7개 모듈 · 교사 검토 완료
                  </span>
                  <span className="text-primary flex items-center gap-1.5 text-xs font-semibold">
                    <Download className="size-3.5" aria-hidden="true" />
                    Markdown
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="max-w-2xl">
            <p className="eyebrow">검사가 아닌 인터뷰</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
              유형을 붙이지 않고,
              <br />
              수업을 움직이는 맥락을 찾습니다.
            </h2>
          </div>
          <div className="bg-border mt-14 grid gap-px overflow-hidden rounded-2xl border md:grid-cols-3">
            {principles.map(({ icon: Icon, title, description }, index) => (
              <article className="bg-background p-7 sm:p-9" key={title}>
                <div className="flex items-center justify-between">
                  <span className="bg-secondary text-primary flex size-10 items-center justify-center rounded-xl">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-8 text-xl font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-3 text-sm leading-7">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-primary text-primary-foreground border-y">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:py-24">
            <div>
              <p className="text-primary-foreground/65 text-xs font-semibold tracking-[0.18em] uppercase">
                개인정보 보호 원칙
              </p>
              <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-[-0.035em] sm:text-4xl">
                학생을 규정하지 않고,
                <br />
                필요한 지원을 설명합니다.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "학생 이름·학교명·진단·성적 등 식별 정보는 입력 전에 안내하고 전송 전에 다시 검사합니다.",
                "“집중력이 낮은 학생” 대신 “짧은 단계 안내가 필요한 상황”처럼 수업 지원의 언어로 바꿉니다.",
                "브라우저 기록은 기본적으로 현재 탭에만 남고, 언제든 한 번에 지울 수 있습니다.",
                `완성 문서의 데이터 기여는 별도 동의가 있을 때만 최대 ${retentionDays}일 보관되며, 매일 자동 정리됩니다.`,
              ].map((item) => (
                <div
                  className="text-primary-foreground/80 flex gap-3 rounded-xl border border-white/15 p-4 text-sm leading-6"
                  key={item}
                >
                  <ShieldCheck
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="eyebrow">11개 질문 · 13–20분의 흐름</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">
                답하고,
                <br />
                검토하고,
                <br />
                가져갑니다.
              </h2>
            </div>
            <ol className="divide-y border-y">
              {[
                [
                  "01",
                  "나의 경험을 답하기",
                  "학교급과 역할에 맞춘 질문을 한 화면에 하나씩 만납니다.",
                ],
                [
                  "02",
                  "AI 초안을 직접 검토하기",
                  "진술의 근거와 해석을 확인하고 문장과 태그를 원하는 만큼 고칩니다.",
                ],
                [
                  "03",
                  "Markdown으로 가져가기",
                  "ChatGPT, Claude, Gemini 등 어디서나 쓸 수 있는 문서를 내려받습니다.",
                ],
              ].map(([number, title, description]) => (
                <li
                  className="grid gap-3 py-7 sm:grid-cols-[4rem_1fr] sm:gap-6"
                  key={number}
                >
                  <span className="text-primary font-mono text-sm">
                    {number}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-secondary/60 border-t">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-20 text-center sm:px-8 lg:py-28">
            <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-2xl">
              <FileText className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-7 text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
              더 나은 AI 답변은,
              <br />더 분명한 교사 맥락에서 시작됩니다.
            </h2>
            <p className="text-muted-foreground mt-6 max-w-xl leading-7 text-pretty">
              저장하거나 가입할 필요 없습니다. 지금 내 수업의 언어로 첫 질문에
              답해 보세요.
            </p>
            <Button asChild size="lg" className="mt-9 h-13 px-7 text-base">
              <Link href="/interview">
                인터뷰 시작하기
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
