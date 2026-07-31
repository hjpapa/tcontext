import Link from "next/link";
import { EyeOff, HardDrive, Server, ShieldCheck } from "lucide-react";

import { BrowserRecordControls } from "@/components/privacy/browser-record-controls";
import { Button } from "@/components/ui/button";
import { getRetentionDays } from "@/lib/consent/policy";

export default function PrivacyPage() {
  const retentionDays = getRetentionDays();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <article className="space-y-12">
        <header className="max-w-4xl space-y-4">
          <p className="text-sm font-bold text-[#28684c]">개인정보 처리 안내</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            적게 받고, 짧게 머물게 하고, 저장은 선생님이 선택합니다.
          </h1>
          <p className="text-lg leading-8 text-[#536159]">
            TContext는 로그인 없이 교사 맥락 문서를 만드는 도구입니다. 학생이나
            교사를 평가·진단·유형화하지 않으며, 개인을 특정하는 정보를 필요로
            하지 않습니다.
          </p>
        </header>

        <section className="grid gap-8 border-y border-[#cfd8d0] py-10 md:grid-cols-3">
          <div>
            <EyeOff aria-hidden="true" className="size-7 text-[#28684c]" />
            <h2 className="mt-3 text-xl font-bold">로그인·추적 없음</h2>
            <p className="mt-2 leading-7 text-[#536159]">
              계정, 이름, 이메일, 분석 쿠키를 요구하지 않습니다.
            </p>
          </div>
          <div>
            <HardDrive aria-hidden="true" className="size-7 text-[#28684c]" />
            <h2 className="mt-3 text-xl font-bold">원문은 메모리에만</h2>
            <p className="mt-2 leading-7 text-[#536159]">
              인터뷰 답변의 전사본이나 별도 답변 필드는 Web Storage,
              데이터베이스, 로그에 저장하지 않습니다. 새로고침하거나 탭을 닫으면
              사라집니다.
            </p>
          </div>
          <div>
            <ShieldCheck aria-hidden="true" className="size-7 text-[#28684c]" />
            <h2 className="mt-3 text-xl font-bold">기여는 기본 꺼짐</h2>
            <p className="mt-2 leading-7 text-[#536159]">
              다운로드와 무관한 별도 동의를 해야만 검토 완료된 최종 문서가
              저장됩니다.
            </p>
          </div>
        </section>

        <section aria-labelledby="processing-title" className="space-y-5">
          <h2 id="processing-title" className="text-3xl font-bold">
            처리 흐름
          </h2>
          <ol className="space-y-5">
            <li className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#153f2e] font-bold text-white">
                1
              </span>
              <div>
                <h3 className="font-bold">답변 작성</h3>
                <p className="mt-1 leading-7 text-[#536159]">
                  탭 메모리에서만 유지됩니다. 다음 버튼을 누를 때 개인정보
                  규칙을 통과한 내용만 AI 처리 경로로 전달합니다.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#153f2e] font-bold text-white">
                2
              </span>
              <div>
                <h3 className="font-bold">AI 초안 생성</h3>
                <p className="mt-1 leading-7 text-[#536159]">
                  후속 질문과 프로필 초안 생성에 OpenAI API를 사용합니다. 가능한
                  요청에는 저장 비활성화 설정을 적용하며, 서버 로그에 답변이나
                  프로필 본문을 남기지 않습니다.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#153f2e] font-bold text-white">
                3
              </span>
              <div>
                <h3 className="font-bold">교사 검토와 내보내기</h3>
                <p className="mt-1 leading-7 text-[#536159]">
                  모든 문장을 수정·삭제·확인할 수 있습니다. Markdown 다운로드와
                  복사는 서버 저장 없이 브라우저에서 이루어집니다.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section
          aria-labelledby="optional-storage-title"
          className="border-l-4 border-[#8a6c33] bg-[#fff8e8] p-6"
        >
          <Server aria-hidden="true" className="size-7 text-[#76591f]" />
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
          <Button asChild variant="outline" className="mt-5 bg-white">
            <Link href="/delete">기여 데이터 삭제하기</Link>
          </Button>
        </section>

        <BrowserRecordControls />

        <section aria-labelledby="limits-title">
          <h2 id="limits-title" className="text-2xl font-bold">
            자동 검사의 한계
          </h2>
          <p className="mt-3 max-w-4xl leading-7 text-[#536159]">
            규칙 기반 검사와 AI 검사를 함께 사용하지만 모든 개인정보를 완벽히
            찾을 수는 없습니다. 이름, 학교명, 연락처, 개별 성적, 건강·상담
            정보가 없는지 전송과 다운로드 전에 직접 확인해 주세요. 위험한 표현이
            감지되면 전송을 멈추고 지원 중심의 대체 표현을 안내합니다.
          </p>
        </section>
      </article>
    </div>
  );
}
