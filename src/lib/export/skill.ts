import {
  COMMON_USAGE_INSTRUCTIONS,
  SKILL_USAGE_PRINCIPLES,
  CHAT_USAGE_PRINCIPLES,
} from "@/content/usage-instructions";
import {
  isPendingPrivacyReview,
  teacherContextProfileSchema,
} from "@/types/profile";
import type { ExportFile } from "./files";
import { profileToMarkdown } from "./profile-to-markdown";
import { yamlQuoted } from "./sanitize";
import { createStoredZip } from "./zip";

export const SKILL_NAME = "teacher-context";
export const SKILL_DESCRIPTION =
  "교사가 검토한 교육관·수업 방식·학급 맥락·AI 협업 원칙입니다. 수업 설계, 활동지, 평가, 수업 검토 같은 교육 관련 요청에서 참고합니다.";
export type SkillFileResult =
  | { ok: true; value: ExportFile<Uint8Array> }
  | { ok: false; error: "invalid" | "pending_review" };

function instructionDocument(
  name: string,
  description: string,
  title: string,
  introduction: string,
  principles: readonly string[],
): string {
  return [
    "---",
    `name: ${name}`,
    `description: ${yamlQuoted(description)}`,
    "---",
    "",
    `# ${title}`,
    "",
    introduction,
    "",
    COMMON_USAGE_INSTRUCTIONS,
    "",
    "## 사용 원칙",
    "",
    ...principles.map((principle) => `- ${principle}`),
    "",
  ].join("\n");
}

export function createSkillPackageFile({
  profile,
  now,
}: {
  profile: unknown;
  now: string;
}): SkillFileResult {
  const parsed = teacherContextProfileSchema.safeParse(profile);
  const modifiedAt = new Date(now);
  if (!parsed.success || !Number.isFinite(modifiedAt.getTime()))
    return { ok: false, error: "invalid" };
  if (isPendingPrivacyReview(parsed.data.privacyReview))
    return { ok: false, error: "pending_review" };
  const encoder = new TextEncoder();
  return {
    ok: true,
    value: {
      path: "teacher-context.zip",
      mediaType: "application/zip",
      content: createStoredZip(
        [
          {
            path: `${SKILL_NAME}/SKILL.md`,
            content: encoder.encode(
              instructionDocument(
                SKILL_NAME,
                SKILL_DESCRIPTION,
                "교사 컨텍스트 사용 지침",
                "이 skill을 사용할 때는 답하기 전에 반드시 참고 파일 `references/teacher-profile.md` 전체를 먼저 읽으세요. 교사 컨텍스트는 이 파일에만 있습니다. 파일을 읽지 못했다면 그 사실을 사용자에게 알리고, 교사 프로파일 문서를 대화에 첨부해 달라고 요청하세요.",
                SKILL_USAGE_PRINCIPLES,
              ),
            ),
          },
          {
            path: `${SKILL_NAME}/references/teacher-profile.md`,
            content: encoder.encode(profileToMarkdown(parsed.data)),
          },
        ],
        modifiedAt,
      ),
    },
  };
}

export function createUsageInstructionsFile(): ExportFile {
  return {
    path: "SKILL.md",
    mediaType: "text/markdown",
    content: instructionDocument(
      "teacher-context-guide",
      "대화에 첨부한 교사 프로파일 컨텍스트 문서를 함께 사용하기 위한 활용 지침입니다. 교육 관련 요청에서 참고합니다.",
      "교사 컨텍스트 활용 지침",
      "이 대화에 첨부된 교사 프로파일 컨텍스트 문서(TContext에서 내려받은 Markdown)를 교사 컨텍스트로 사용하세요. 문서가 첨부되어 있지 않으면 먼저 첨부를 요청하세요.",
      CHAT_USAGE_PRINCIPLES,
    ),
  };
}
