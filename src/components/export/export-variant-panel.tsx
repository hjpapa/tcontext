"use client";

import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProfileExportFormat } from "@/lib/storage/profiles/schema";
import {
  downloadTextFile,
  profileMarkdownFilename,
} from "@/lib/export/download";
import {
  OPTIONAL_SECTION_IDS,
  profileToCoreMarkdown,
  profileToModuleMarkdown,
  variantMarkdownFilename,
  type ContextAsOf,
  type VariantResult,
} from "@/lib/export/profile-variants";
import {
  PROFILE_MODULE_IDS,
  type TeacherContextProfile,
} from "@/types/profile";
import {
  ExportVariantPicker,
  type ExportVariantSelection,
} from "./export-variant-picker";

export function ExportVariantPanel({
  profile,
  markdown,
  contextAsOf,
  onExported,
}: {
  profile: TeacherContextProfile;
  markdown: string;
  contextAsOf: ContextAsOf;
  onExported?: (format: ProfileExportFormat) => void;
}) {
  const titleId = useId();
  const [selection, setSelection] = useState<ExportVariantSelection>({
    variant: "full",
    modules: [...PROFILE_MODULE_IDS],
    sections: [...OPTIONAL_SECTION_IDS],
  });
  const [message, setMessage] = useState<string | null>(null);
  const notifyExported = () => {
    try {
      onExported?.(selection.variant);
    } catch {
      // Optional record keeping must not change a successful export.
    }
  };
  const result = useMemo<VariantResult>(() => {
    if (selection.variant === "full") return { ok: true, markdown };
    if (selection.variant === "core")
      return profileToCoreMarkdown(profile, { asOf: contextAsOf });
    return profileToModuleMarkdown(profile, {
      asOf: contextAsOf,
      modules: selection.modules,
      sections: selection.sections,
    });
  }, [profile, markdown, contextAsOf, selection]);

  const copy = async () => {
    if (!result.ok) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setMessage("내보낼 내용을 복사했습니다.");
      notifyExported();
    } catch {
      setMessage(
        "복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.",
      );
    }
  };
  const download = () => {
    if (!result.ok) return;
    const filename =
      selection.variant === "full"
        ? profileMarkdownFilename(profile.metadata.schoolLevel)
        : variantMarkdownFilename(
            profile.metadata.schoolLevel,
            selection.variant,
          );
    const downloaded = downloadTextFile(
      { path: filename, mediaType: "text/markdown", content: result.markdown },
      { bom: true },
    );
    setMessage(
      downloaded.ok
        ? "Markdown 다운로드를 시작했습니다."
        : "다운로드하지 못했습니다. 브라우저 설정을 확인하고 다시 시도해 주세요.",
    );
    if (downloaded.ok) notifyExported();
  };

  return (
    <section
      aria-labelledby={titleId}
      data-print-hidden="true"
      className="min-w-0 space-y-5 rounded-2xl border p-4 sm:p-6"
    >
      <h2 id={titleId} className="text-xl font-bold">
        필요한 만큼만 전달하기
      </h2>
      <ExportVariantPicker
        value={selection}
        onChange={(next) => {
          setSelection(next);
          setMessage(null);
        }}
      />
      {result.ok ? (
        <div className="min-w-0 space-y-2">
          <textarea
            aria-label="내보낼 내용 미리보기"
            readOnly
            value={result.markdown}
            className="h-72 w-full resize-none rounded-xl border bg-white p-3 font-mono text-sm leading-6 break-words whitespace-pre-wrap"
          />
          <p className="text-muted-foreground text-sm">
            {result.markdown.length.toLocaleString("ko-KR")}자
          </p>
          <p className="text-muted-foreground text-sm leading-6">
            다른 AI에는 이 내용이 그대로 전달됩니다
          </p>
        </div>
      ) : (
        <p role="status" className="text-sm leading-6">
          {result.error === "no_modules"
            ? "모듈을 하나 이상 고르세요"
            : "검토를 마친 문서에서만 만들 수 있습니다. 문서를 다시 검토해 주세요."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!result.ok}
          onClick={() => void copy()}
        >
          복사
        </Button>
        <Button type="button" disabled={!result.ok} onClick={download}>
          Markdown 다운로드
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-sm leading-6">
          {message}
        </p>
      ) : null}
    </section>
  );
}
