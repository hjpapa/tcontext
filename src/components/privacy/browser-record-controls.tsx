"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { Button } from "@/components/ui/button";

export function BrowserRecordControls() {
  const { clearBrowserRecords } = useInterviewSession();
  const [cleared, setCleared] = useState(false);

  return (
    <div className="border-l-4 border-[#28684c] bg-[#edf5ef] p-5">
      <h2 className="text-xl font-bold">이 탭의 작업 기록</h2>
      <p className="mt-2 max-w-3xl leading-7 text-[#536159]">
        원문 답변과 프로필은 현재 탭의 메모리에만 있습니다. 아래 버튼은 현재
        메모리와 이전 버전이 남겼을 수 있는 TContext 브라우저 설정을 함께
        지웁니다. 이미 선택적으로 기여한 데이터는 삭제 화면에서 별도로 삭제해야
        합니다.
      </p>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-4 min-h-12 bg-white"
        onClick={() => {
          clearBrowserRecords();
          setCleared(true);
        }}
      >
        {cleared ? <Check aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
        {cleared ? "이 탭의 기록을 지웠습니다" : "이 탭의 모든 기록 삭제"}
      </Button>
    </div>
  );
}
