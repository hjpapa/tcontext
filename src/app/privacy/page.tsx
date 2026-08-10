import Link from "next/link";
import { EyeOff, HardDrive, Server, ShieldCheck } from "lucide-react";

import { BrowserRecordControls } from "@/components/privacy/browser-record-controls";
import { Button } from "@/components/ui/button";
import { getRetentionDays } from "@/lib/consent/policy";

export default function PrivacyPage() {
  const retentionDays = getRetentionDays();

  return (
    <div className="page-container py-8 sm:py-12 lg:py-16">
      <article className="mx-auto max-w-6xl space-y-8 sm:space-y-10">
        <header className="page-hero">
          <div
            aria-hidden="true"
            className="bg-secondary/70 pointer-events-none absolute -top-20 -right-16 size-56 rounded-full blur-3xl"
          />
          <p className="eyebrow">개인정보 처리 안내</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            적게 받고, 짧게 머물게 하고, 저장은 선생님이 선택합니다.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-4xl text-lg leading-8">
            TContext는 로그인 없이 교사 맥락 문서를 만드는 도구입니다. 학생이나
            교사를 평가·진단·유형화하지 않으며, 개인을 특정하는 정보를 필요로
            하지 않습니다.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="feature-card">
            <EyeOff aria-hidden="true" className="text-primary size-7" />
            <h2 className="mt-3 text-xl font-bold">로그인·추적 없음</h2>
            <p className="text-muted-foreground mt-2 leading-7">
              계정, 이름, 이메일, 분석 쿠키를 요구하지 않습니다.
            </p>
          </div>
          <div className="feature-card">
            <HardDrive aria-hidden="true" className="text-primary size-7" />
            <h2 className="mt-3 text-xl font-bold">원문은 메모리에만</h2>
            <p className="text-muted-foreground mt-2 leading-7">
              인터뷰 답변의 전사본이나 별도 답변 필드는 Web Storage,
              데이터베이스, 로그에 저장하지 않습니다. 새로고침하거나 탭을 닫으면
              사라집니다.
            </p>
          </div>
          <div className="feature-card">
            <ShieldCheck aria-hidden="true" className="text-primary size-7" />
            <h2 className="mt-3 text-xl font-bold">기여는 기본 꺼짐</h2>
            <p className="text-muted-foreground mt-2 leading-7">
              다운로드와 무관한 별도 동의를 해야만 검토 완료된 최종 문서가
              저장됩니다.
            </p>
          </div>
        </section>

        <section
          aria-labelledby="processing-title"
          className="feature-card space-y-6"
        >
          <h2 id="processing-title" className="text-3xl font-bold">
            처리 흐름
          </h2>
          <ol className="space-y-5">
            <li className="flex gap-4">
              <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-bold">
                1
              </span>
              <div>
                <h3 className="font-bold">답변 작성</h3>
                <p className="text-muted-foreground mt-1 leading-7">
                  탭 메모리에서만 유지됩니다. 다음 버튼을 누를 때 개인정보
                  규칙을 통과한 내용만 AI 처리 경로로 전달합니다.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-bold">
                2
              </span>
              <div>
                <h3 className="font-bold">AI 초안 생성</h3>
                <p className="text-muted-foreground mt-1 leading-7">
                  후속 질문과 프로필 초안 생성에 OpenAI API를 사용합니다. 가능한
                  요청에는 저장 비활성화 설정을 적용하며, 서버 로그에 답변이나
                  프로필 본문을 남기지 않습니다.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-bold">
                3
              </span>
              <div>
                <h3 className="font-bold">교사 검토와 내보내기</h3>
                <p className="text-muted-foreground mt-1 leading-7">
                  모든 문장을 수정·삭제·확인할 수 있습니다. Markdown 다운로드와
                  복사는 서버 저장 없이 브라우저에서 이루어집니다.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section
          aria-labelledby="optional-storage-title"
          className="bg-accent/25 border-accent rounded-2xl border p-6 sm:p-8"
        >
          <Server
            aria-hidden="true"
            className="text-accent-foreground size-7"
          />
          <h2 id="optional-storage-title" className="mt-3 text-2xl font-bold">
            선택적 데이터 기여
          </h2>
          <p className="mt-3 leading-7">
            결과 화면에서 명시적으로 동의한 경우에만 최종 프로필 JSON, Markdown,
            확인된 태그, 개인정보 검사 결과, 생성 버전, 동의 시각을 Supabase에
            저장합니다. 원문 답변의 전사본이나 별도 답변 필드, IP 주소, 사용자
            에이전트, 이름, 이메일, 쿠키는 저장하지 않습니다. 최종 프로필에는
            교사가 확인한 수업 맥락의 요약만 포함됩니다.
          </p>
          <p className="mt-3 leading-7">
            실제 보유 기간은 최대 {retentionDays}일입니다.{" "}
            {retentionDays === 1
              ? "기여 즉시 자동 삭제 대상으로 전환되고 다음 일일 정리 주기 안에 삭제됩니다."
              : `매일 실행되는 정리 시간을 포함하기 위해 기여 ${retentionDays - 1}일 뒤 자동 삭제 대상으로 전환됩니다.`}{" "}
            기여 직후 한 번 표시되는 제출 ID와 삭제 코드로 언제든 직접 삭제할 수
            있습니다.
          </p>
          <Button asChild variant="outline" className="bg-card mt-5">
            <Link href="/delete">기여 데이터 삭제하기</Link>
          </Button>
        </section>

        <BrowserRecordControls />

        <section aria-labelledby="limits-title" className="feature-card">
          <h2 id="limits-title" className="text-2xl font-bold">
            자동 검사의 한계
          </h2>
          <p className="text-muted-foreground mt-3 max-w-4xl leading-7">
            규칙 기반 검사와 AI 검사를 함께 사용하지만 모든 개인정보를 완벽히
            찾을 수는 없습니다. 이름, 학교명, 연락처, 개별 성적, 건강·상담
            정보가 없는지 전송과 다운로드 전에 직접 확인해 주세요. 위험한 표현이
            감지되면 전송을 멈추고 지원 중심의 대체 표현을 안내합니다.
          </p>
        </section>

        <section className="bg-primary text-primary-foreground rounded-[1.75rem] px-6 py-8 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-9">
          <div>
            <p className="text-primary-foreground/70 text-sm font-semibold">
              안전 원칙을 확인했다면
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              가상 문서를 먼저 보거나 바로 인터뷰를 시작하세요.
            </h2>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:mt-0 sm:shrink-0 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="min-h-12">
              <Link href="/examples">문서 예시 보기</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="min-h-12 bg-white text-[#153f2e] hover:bg-white/90"
            >
              <Link href="/interview">인터뷰 시작</Link>
            </Button>
          </div>
        </section>
      </article>
    </div>
  );
}
