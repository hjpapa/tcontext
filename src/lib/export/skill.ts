import {
  COMMON_USAGE_INSTRUCTIONS,
  SKILL_USAGE_PRINCIPLES,
} from "@/content/usage-instructions";
import {
  isPendingPrivacyReview,
  teacherContextProfileSchema,
} from "@/types/profile";
import type { ExportFile } from "./files";
import { profileToMarkdown } from "./profile-to-markdown";
import { yamlQuoted } from "./sanitize";

export const SKILL_NAME = "teacher-context";
export const SKILL_DESCRIPTION =
  "교사가 검토한 교육관·수업 방식·학급 맥락·AI 협업 원칙입니다. 수업 설계, 활동지, 평가, 수업 검토 같은 교육 관련 요청에서 참고합니다.";
export type SkillFileResult =
  | { ok: true; value: ExportFile }
  | { ok: false; error: "invalid" | "pending_review" };

export function createSkillFile({
  profile,
}: {
  profile: unknown;
  now: string;
}): SkillFileResult {
  const parsed = teacherContextProfileSchema.safeParse(profile);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (isPendingPrivacyReview(parsed.data.privacyReview))
    return { ok: false, error: "pending_review" };
  const body = profileToMarkdown(parsed.data)
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, "")
    .trimStart();
  return {
    ok: true,
    value: {
      path: "SKILL.md",
      mediaType: "text/markdown",
      content: [
        "---",
        `name: ${yamlQuoted(SKILL_NAME)}`,
        `description: ${yamlQuoted(SKILL_DESCRIPTION)}`,
        "---",
        "",
        "# 교사 컨텍스트 사용 지침",
        "",
        COMMON_USAGE_INSTRUCTIONS,
        "",
        "## 사용 원칙",
        "",
        ...SKILL_USAGE_PRINCIPLES.map((principle) => `- ${principle}`),
        "",
        "---",
        "",
        body,
      ].join("\n"),
    },
  };
}
