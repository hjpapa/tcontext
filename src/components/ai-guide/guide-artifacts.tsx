"use client";
import { Fragment, useMemo, useState } from "react";
import {
  ExportVariantPicker,
  type ExportVariantSelection,
} from "@/components/export/export-variant-picker";
import { useContextAsOf } from "@/components/export/use-context-as-of";
import { useRecordExport } from "@/components/export/use-record-export";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { Button } from "@/components/ui/button";
import { COMMON_USAGE_INSTRUCTIONS } from "@/content/usage-instructions";
import type { GuideArtifactId } from "@/content/platform-guides/schema";
import {
  downloadMarkdown,
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
  createSkillPackageFile,
  createUsageInstructionsFile,
} from "@/lib/export/skill";
import {
  PROFILE_MODULE_IDS,
  type TeacherContextProfile,
} from "@/types/profile";

type SkillFeedback = {
  profile: TeacherContextProfile;
  asOf: ContextAsOf;
  result:
    { ok: true; embeddedCore: boolean } | { ok: false; issueCount: number };
};

export function GuideArtifacts({
  artifacts,
  exportTarget,
}: {
  artifacts: readonly GuideArtifactId[];
  exportTarget?: string;
}) {
  const { profile, markdown } = useInterviewSession();
  const asOf = useContextAsOf(profile);
  const recordExport = useRecordExport();
  const [selection, setSelection] = useState<ExportVariantSelection>({
    variant: "full",
    modules: [...PROFILE_MODULE_IDS],
    sections: [...OPTIONAL_SECTION_IDS],
  });
  const [message, setMessage] = useState<string | null>(null);
  const [skillFeedback, setSkillFeedback] = useState<SkillFeedback | null>(
    null,
  );
  const currentSkillFeedback =
    skillFeedback?.profile === profile &&
    skillFeedback?.asOf.date === asOf?.date &&
    skillFeedback?.asOf.source === asOf?.source
      ? skillFeedback?.result
      : null;
  const hasDocument = profile !== null && markdown.length > 0;
  const result = useMemo<VariantResult | null>(() => {
    if (!hasDocument || !profile || !asOf) return null;
    if (selection.variant === "full") return { ok: true, markdown };
    if (selection.variant === "core")
      return profileToCoreMarkdown(profile, { asOf });
    return profileToModuleMarkdown(profile, {
      asOf,
      modules: selection.modules,
      sections: selection.sections,
    });
  }, [hasDocument, profile, markdown, asOf, selection]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMON_USAGE_INSTRUCTIONS);
      setMessage("공통 활용 지침을 복사했습니다.");
    } catch {
      setMessage("복사하지 못했습니다. 아래 지침을 직접 선택해 복사해 주세요.");
    }
  };
  const download = (kind: GuideArtifactId) => {
    if (kind !== "usage-instructions" && (!hasDocument || !profile)) return;
    try {
      if (kind === "usage-instructions") {
        if (!downloadTextFile(createUsageInstructionsFile(), { bom: false }).ok)
          throw new Error("download_failed");
      } else if (kind === "profile-markdown" && profile) {
        if (!result?.ok) return;
        downloadMarkdown(
          result.markdown,
          selection.variant === "full"
            ? profileMarkdownFilename(profile.metadata.schoolLevel)
            : variantMarkdownFilename(
                profile.metadata.schoolLevel,
                selection.variant,
              ),
        );
        if (exportTarget) recordExport(exportTarget, selection.variant);
      } else if (profile && asOf) {
        setSkillFeedback(null);
        const result = createSkillPackageFile({
          profile,
          now: new Date().toISOString(),
          asOf,
        });
        if (!result.ok) {
          if (result.error === "incompatible") {
            setSkillFeedback({
              profile,
              asOf,
              result: { ok: false, issueCount: result.issues?.length ?? 0 },
            });
            setMessage(null);
            return;
          }
          setMessage(
            "검토를 마친 문서에서만 ZIP 패키지를 만들 수 있습니다. 문서를 다시 검토해 주세요.",
          );
          return;
        }
        if (!downloadTextFile(result.value, { bom: false }).ok)
          throw new Error("download_failed");
        setSkillFeedback({
          profile,
          asOf,
          result: { ok: true, embeddedCore: result.embeddedCore },
        });
        if (exportTarget) recordExport(exportTarget, "skill-package");
      } else return;
      setMessage(
        kind === "skill-package"
          ? "ZIP 패키지 다운로드를 시작했습니다."
          : kind === "usage-instructions"
            ? "지침 SKILL.md 다운로드를 시작했습니다."
            : "Markdown 다운로드를 시작했습니다.",
      );
    } catch {
      setMessage(
        "다운로드하지 못했습니다. 브라우저 설정을 확인하고 다시 시도해 주세요.",
      );
    }
  };
  return (
    <div className="space-y-3">
      {!hasDocument && artifacts.some((id) => id !== "usage-instructions") ? (
        <p className="text-muted-foreground text-sm">
          문서를 만들거나 내 프로파일에서 여세요.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {artifacts.map((id) => {
          switch (id) {
            case "profile-markdown":
              return (
                <div key={id} className="w-full min-w-0 space-y-3">
                  <ExportVariantPicker
                    value={selection}
                    onChange={(next) => {
                      setSelection(next);
                      setMessage(null);
                    }}
                    disabled={!hasDocument}
                  />
                  {result && !result.ok ? (
                    <p role="status" className="text-sm leading-6">
                      {result.error === "no_modules"
                        ? "모듈을 하나 이상 고르세요"
                        : "검토를 마친 문서에서만 만들 수 있습니다. 문서를 다시 검토해 주세요."}
                    </p>
                  ) : null}
                  <Button
                    variant="outline"
                    disabled={!hasDocument || !result?.ok}
                    onClick={() => download(id)}
                  >
                    교사 Markdown 다운로드
                  </Button>
                </div>
              );
            case "skill-package":
              return (
                <div key={id} className="w-full min-w-0 space-y-2">
                  <Button disabled={!hasDocument} onClick={() => download(id)}>
                    ZIP 패키지 다운로드
                  </Button>
                  <div
                    aria-live="polite"
                    className="space-y-2 text-sm leading-6 break-words"
                  >
                    {currentSkillFeedback?.ok ? (
                      <>
                        <p>공개 Agent Skills 형식 검사 통과</p>
                        {!currentSkillFeedback.embeddedCore ? (
                          <p>
                            문서가 길어 핵심 맥락을 skill 본문에 넣지
                            못했습니다. 대화 첨부 방식을 권장합니다.
                          </p>
                        ) : null}
                      </>
                    ) : currentSkillFeedback ? (
                      <>
                        <p>
                          skill 형식 검사를 통과하지 못했습니다. 대화 첨부
                          방식을 쓰세요.
                        </p>
                        <p>문제 {currentSkillFeedback.issueCount}개</p>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            case "usage-instructions":
              return (
                <Fragment key={id}>
                  <Button variant="outline" onClick={() => void copy()}>
                    공통 활용 지침 복사
                  </Button>
                  <Button variant="outline" onClick={() => download(id)}>
                    지침 SKILL.md 내려받기
                  </Button>
                </Fragment>
              );
            default:
              return <p key={id}>현재 제공하지 않는 산출물입니다.</p>;
          }
        })}
      </div>
      {artifacts.includes("usage-instructions") ? (
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer font-semibold">
            공통 활용 지침 보기
          </summary>
          <pre className="mt-3 font-sans text-sm leading-7 break-words whitespace-pre-wrap">
            {COMMON_USAGE_INSTRUCTIONS}
          </pre>
        </details>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
