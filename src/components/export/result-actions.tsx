"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  Check,
  Clipboard,
  Download,
  Printer,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  downloadMarkdown,
  profileMarkdownFilename,
} from "@/lib/export/download";
import {
  profileToCompactText,
  profileToPlainText,
} from "@/lib/export/profile-to-text";
import type { TeacherContextProfile } from "@/types/profile";

type CopyTarget = "markdown" | "plainText" | "compact";
type CopyStatus = {
  target: CopyTarget;
  result: "copied" | "failed";
} | null;

const COPY_LABELS: Record<CopyTarget, string> = {
  markdown: "Markdown",
  plainText: "일반 텍스트",
  compact: "AI용 압축본",
};

export function ResultActions({
  profile,
  markdown,
}: {
  profile: TeacherContextProfile;
  markdown: string;
}) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  const setTemporaryCopyStatus = (status: NonNullable<CopyStatus>) => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    setCopyStatus(status);
    resetTimerRef.current = window.setTimeout(() => {
      setCopyStatus(null);
      resetTimerRef.current = null;
    }, 2000);
  };

  const copy = async (value: string, target: CopyTarget) => {
    try {
      await navigator.clipboard.writeText(value);
      setTemporaryCopyStatus({ target, result: "copied" });
    } catch {
      setTemporaryCopyStatus({ target, result: "failed" });
    }
  };

  const copied = (target: CopyTarget) =>
    copyStatus?.target === target && copyStatus.result === "copied";
  const statusMessage =
    copyStatus?.result === "copied"
      ? `${COPY_LABELS[copyStatus.target]} 복사가 완료되었습니다.`
      : copyStatus?.result === "failed"
        ? `${COPY_LABELS[copyStatus.target]} 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요.`
        : "다운로드와 복사는 로그인이나 데이터베이스 저장 없이 이 브라우저에서 바로 작동합니다.";

  return (
    <div
      className="space-y-3"
      aria-label="문서 내보내기"
      data-print-hidden="true"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          size="lg"
          className="min-h-14 justify-start px-5 text-base sm:col-span-2"
          onClick={() =>
            downloadMarkdown(
              markdown,
              profileMarkdownFilename(profile.metadata.schoolLevel),
            )
          }
        >
          <Download aria-hidden="true" className="size-5" />
          Markdown 다운로드
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="bg-card min-h-14 justify-start px-5 text-base"
          onClick={() => void copy(markdown, "markdown")}
        >
          {copied("markdown") ? (
            <Check aria-hidden="true" />
          ) : (
            <Clipboard aria-hidden="true" />
          )}
          {copied("markdown") ? "Markdown 복사됨" : "Markdown 복사"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="bg-card min-h-14 justify-start px-5 text-base"
          onClick={() => void copy(profileToPlainText(profile), "plainText")}
        >
          {copied("plainText") ? (
            <Check aria-hidden="true" />
          ) : (
            <AlignLeft aria-hidden="true" />
          )}
          {copied("plainText") ? "일반 텍스트 복사됨" : "일반 텍스트 복사"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="bg-card min-h-14 justify-start px-5 text-base"
          onClick={() => void copy(profileToCompactText(profile), "compact")}
        >
          {copied("compact") ? (
            <Check aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          {copied("compact") ? "AI용 압축본 복사됨" : "AI용 압축본 복사"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="bg-card min-h-14 justify-start px-5 text-base"
          onClick={() => window.print()}
        >
          <Printer aria-hidden="true" />
          인쇄·PDF 저장
        </Button>
      </div>
      <p className="text-muted-foreground text-sm leading-6" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  );
}
