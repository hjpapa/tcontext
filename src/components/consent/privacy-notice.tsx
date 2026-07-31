"use client";

import { ShieldAlert } from "lucide-react";

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
              <li>학생·교직원 이름, 학교명, 반·학급명</li>
              <li>연락처, 주소, 생년월일, 사진</li>
              <li>개별 성적, 생활기록부, 상담 기록</li>
              <li>진단명·건강 정보 등 민감한 정보</li>
            </ul>
            <p className="mt-4 font-medium">
              “한 학생은…” 대신 “일부 학생에게는 단계별 안내가 필요합니다”처럼
              지원 중심으로 표현해 주세요.
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
