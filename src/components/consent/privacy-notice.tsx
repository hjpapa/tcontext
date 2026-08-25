"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function PrivacyNotice({
  accepted,
  onAcceptedChange,
  onContinue,
}: {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <section aria-labelledby="privacy-notice-title" className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-bold text-[#28684c]">시작 전 1분 확인</p>
        <h1
          id="privacy-notice-title"
          className="max-w-3xl text-3xl leading-tight font-bold tracking-tight sm:text-5xl"
        >
          사람을 특정하지 않고, 수업에 필요한 지원만 적어 주세요.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-[#536159]">
          답변은 이 브라우저 탭의 메모리에만 머뭅니다. 새로고침하거나 탭을
          닫으면 인터뷰 내용과 초안이 사라집니다.
        </p>
      </div>

      <div className="border-l-4 border-[#b66a2c] bg-[#fff8ec] p-5 sm:p-6">
        <div className="flex gap-3">
          <ShieldAlert
            aria-hidden="true"
            className="mt-1 size-6 shrink-0 text-[#8c4f1f]"
          />
          <div>
            <h2 className="text-lg font-bold">입력하지 말아야 할 정보</h2>
            <ul className="mt-3 grid gap-2 text-base leading-7 sm:grid-cols-2">
              <li>학생·교직원 이름과 학생번호</li>
              <li>전화번호·이메일·생년월일·식별번호</li>
              <li>상세 주소와 실제 학교·반의 고유한 이름</li>
              <li>개인에게 연결된 성적·진단·건강·상담 기록</li>
            </ul>
            <p className="mt-4 font-medium">
              한 사람을 설명하기보다 “일부 학생에게 단계별 안내가
              필요합니다”처럼 집단의 상황과 필요한 지원을 적어 주세요.
            </p>
          </div>
        </div>
      </div>

      <div className="border-l-4 border-[#28684c] bg-[#edf7f1] p-5 sm:p-6">
        <div className="flex gap-3">
          <ShieldCheck
            aria-hidden="true"
            className="mt-1 size-6 shrink-0 text-[#28684c]"
          />
          <div>
            <h2 className="text-lg font-bold">
              수업에 필요한 맥락은 적어도 됩니다
            </h2>
            <p className="mt-3 text-base leading-7">
              학교급·학년·교과, 대략적인 학급 규모, 수업 시간과 공간, 기기 환경,
              익명 집단의 참여 경향과 필요한 지원은 컨텍스트에 도움이 됩니다.
              정확한 학교명·반 번호·반 이름은 일반적인 표현으로 바꿔 주세요.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="privacy-confirm"
          checked={accepted}
          onCheckedChange={(value) => onAcceptedChange(value === true)}
          className="mt-1 size-5"
        />
        <Label
          htmlFor="privacy-confirm"
          className="max-w-2xl cursor-pointer text-base leading-7"
        >
          개인정보를 입력하지 않으며, 자동 검사가 모든 위험을 찾아내지는
          못하므로 제출 전에 직접 다시 확인하겠습니다.
        </Label>
      </div>

      <Button
        type="button"
        size="lg"
        disabled={!accepted}
        onClick={onContinue}
        className="min-h-12 bg-[#153f2e] px-6 text-base text-white hover:bg-[#235b43]"
      >
        확인하고 학교급 선택하기
      </Button>
    </section>
  );
}
