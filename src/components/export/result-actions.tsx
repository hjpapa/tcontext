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
  downloadTextFile,
  profileMarkdownFilename,
} from "@/lib/export/download";
import { profileToPlainText } from "@/lib/export/profile-to-text";
import {
  profileToCoreMarkdown,
  type ContextAsOf,
} from "@/lib/export/profile-variants";
import { createProfileBackupFile } from "@/lib/storage/profiles/backup";
import type { SuggestedTag } from "@/lib/ai/schemas/profile";
import type { ProfileExportFormat } from "@/lib/storage/profiles/schema";
import type { TeacherContextProfile } from "@/types/profile";

type CopyTarget = "markdown" | "plainText" | "compact";
type CopyStatus = {
  target: CopyTarget;
  result: "copied" | "failed";
} | null;

const COPY_LABELS: Record<CopyTarget, string> = {
  markdown: "전체 컨텍스트",
  plainText: "일반 텍스트",
  compact: "핵심본",
};

export function ResultActions({
  profile,
  markdown,
  contextAsOf,
  suggestedTags = [],
  onExported,
}: {
  profile: TeacherContextProfile;
  markdown: string;
  contextAsOf: ContextAsOf;
  suggestedTags?: readonly SuggestedTag[];
  onExported?: (format: ProfileExportFormat) => void;
}) {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>(null);
  const resetTimerRef = useRef<number | null>(null);
  const notifyExported = (format: ProfileExportFormat) => {
    try {
      onExported?.(format);
    } catch {
      // Optional record keeping must not change a successful export.
    }
  };

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
      if (target !== "plainText")
        notifyExported(target === "compact" ? "core" : "full");
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          type="button"
          size="lg"
          className="h-auto min-h-14 min-w-0 justify-start px-5 py-3 text-left text-base whitespace-normal sm:col-span-2"
          onClick={() => {
            downloadMarkdown(
              markdown,
              profileMarkdownFilename(profile.metadata.schoolLevel),
            );
            notifyExported("full");
          }}
        >
          <Download aria-hidden="true" className="size-5" />
          수업 설계용 Markdown 다운로드
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
          {copied("markdown") ? "전체 컨텍스트 복사됨" : "전체 컨텍스트 복사"}
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
          onClick={() => {
            const result = profileToCoreMarkdown(profile, {
              asOf: contextAsOf,
            });
            if (result.ok) void copy(result.markdown, "compact");
            else
              setTemporaryCopyStatus({ target: "compact", result: "failed" });
          }}
        >
          {copied("compact") ? (
            <Check aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          {copied("compact") ? "핵심본 복사됨" : "핵심본 복사"}
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
      <Button
        type="button"
        variant="outline"
        className="min-h-12"
        onClick={() => {
          const result = createProfileBackupFile({
            kind: "confirmed",
            profile,
            suggestedTags,
            now: new Date().toISOString(),
          });
          if (!result.ok) {
            setBackupStatus(
              "백업을 만들지 못했습니다. 문서를 다시 검토해 주세요.",
            );
            return;
          }
          const downloaded = downloadTextFile(result.value, { bom: false });
          setBackupStatus(
            downloaded.ok
              ? "JSON 백업을 내려받았습니다."
              : "다운로드하지 못했습니다. 브라우저 권한을 확인하고 다시 시도해 주세요.",
          );
        }}
      >
        JSON 백업 다운로드
      </Button>
      <p className="text-muted-foreground text-sm leading-6">
        Markdown은 AI 활용용, JSON은 TContext에서 다시 열기 위한
        보관·복원용입니다.
      </p>
      {backupStatus ? <p role="status">{backupStatus}</p> : null}
      <p className="text-muted-foreground text-sm leading-6" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  );
}
