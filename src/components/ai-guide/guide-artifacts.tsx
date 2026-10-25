"use client";
import { useState } from "react";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { Button } from "@/components/ui/button";
import { COMMON_USAGE_INSTRUCTIONS } from "@/content/usage-instructions";
import type { GuideArtifactId } from "@/content/platform-guides/schema";
import {
  downloadMarkdown,
  downloadTextFile,
  profileMarkdownFilename,
} from "@/lib/export/download";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import { createSkillFile } from "@/lib/export/skill";

export function GuideArtifacts({
  artifacts,
}: {
  artifacts: readonly GuideArtifactId[];
}) {
  const { profile, markdown } = useInterviewSession();
  const [message, setMessage] = useState<string | null>(null);
  const hasDocument = profile !== null && markdown.length > 0;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMON_USAGE_INSTRUCTIONS);
      setMessage("공통 활용 지침을 복사했습니다.");
    } catch {
      setMessage("복사하지 못했습니다. 아래 지침을 직접 선택해 복사해 주세요.");
    }
  };
  const download = (kind: "profile-markdown" | "skill-file") => {
    if (!hasDocument || !profile) return;
    try {
      if (kind === "profile-markdown")
        downloadMarkdown(
          profileToMarkdown(profile),
          profileMarkdownFilename(profile.metadata.schoolLevel),
        );
      else {
        const result = createSkillFile({
          profile,
          now: new Date().toISOString(),
        });
        if (!result.ok) {
          setMessage(
            "검토를 마친 문서에서만 SKILL.md를 만들 수 있습니다. 문서를 다시 검토해 주세요.",
          );
          return;
        }
        if (!downloadTextFile(result.value, { bom: false }).ok)
          throw new Error("download_failed");
      }
      setMessage(
        kind === "skill-file"
          ? "SKILL.md 다운로드를 시작했습니다."
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
                <Button
                  key={id}
                  variant="outline"
                  disabled={!hasDocument}
                  onClick={() => download(id)}
                >
                  교사 Markdown 다운로드
                </Button>
              );
            case "skill-file":
              return (
                <Button
                  key={id}
                  disabled={!hasDocument}
                  onClick={() => download(id)}
                >
                  SKILL.md 다운로드
                </Button>
              );
            case "usage-instructions":
              return (
                <Button key={id} variant="outline" onClick={() => void copy()}>
                  공통 활용 지침 복사
                </Button>
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
