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
import { SKILL_FORMAT } from "@/content/skill-format";
import { profileToMarkdown } from "./profile-to-markdown";
import {
  contextAsOf,
  profileToCoreMarkdown,
  type ContextAsOf,
} from "./profile-variants";
import { checkSkillPackage, type SkillCheckIssue } from "./skill-check";
import { yamlQuoted } from "./sanitize";
import { createStoredZip } from "./zip";

export const SKILL_NAME = "teacher-context";
export const SKILL_DESCRIPTION =
  "교사가 검토한 교육관·수업 방식·학급 맥락·AI 협업 원칙입니다. 수업 설계, 활동지, 평가, 수업 검토 같은 교육 관련 요청에서 참고합니다.";
export type SkillFileResult =
  | { ok: true; value: ExportFile<Uint8Array>; embeddedCore: boolean }
  | {
      ok: false;
      error: "invalid" | "pending_review" | "incompatible";
      issues?: SkillCheckIssue[];
    };

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
  asOf,
}: {
  profile: unknown;
  now: string;
  asOf?: ContextAsOf;
}): SkillFileResult {
  const parsed = teacherContextProfileSchema.safeParse(profile);
  const modifiedAt = new Date(now);
  if (!parsed.success || !Number.isFinite(modifiedAt.getTime()))
    return { ok: false, error: "invalid" };
  if (isPendingPrivacyReview(parsed.data.privacyReview))
    return { ok: false, error: "pending_review" };
  const core = profileToCoreMarkdown(parsed.data, {
    asOf: asOf ?? contextAsOf(parsed.data),
  });
  if (!core.ok)
    return {
      ok: false,
      error: core.error === "pending_review" ? "pending_review" : "invalid",
    };
  const coreBody = core.markdown.slice(core.markdown.indexOf("\n---\n") + 5);
  const withCore =
    instructionDocument(
      SKILL_NAME,
      SKILL_DESCRIPTION,
      "교사 컨텍스트 사용 지침",
      "이 skill에는 교사가 검토한 핵심 맥락이 들어 있습니다. 이 파일의 사용 원칙 다음에 나오는 교사 프로파일이 교사 핵심 맥락이며, 교육 관련 요청에는 먼저 이 내용을 적용하세요. 교사가 직접 말한 근거 문장, 모듈별 세부 내용, 수업 작업 양식이 필요하면 참고 파일 `references/teacher-profile.md`를 읽으세요. 그 파일을 읽지 못했다면 사용자에게 알리고, 핵심 맥락만으로 답했다고 밝히세요.",
      SKILL_USAGE_PRINCIPLES,
    ) + coreBody;
  const body = withCore.slice(withCore.indexOf("\n---\n") + 5);
  const embeddedCore =
    body.length <= SKILL_FORMAT.bodyMaxCharacters &&
    body.split("\n").length <= SKILL_FORMAT.bodyMaxLines;
  const instructions = embeddedCore
    ? withCore
    : instructionDocument(
        SKILL_NAME,
        SKILL_DESCRIPTION,
        "교사 컨텍스트 사용 지침",
        "이 skill을 사용할 때는 답하기 전에 반드시 참고 파일 `references/teacher-profile.md` 전체를 먼저 읽으세요. 교사 컨텍스트는 이 파일에만 있습니다. 파일을 읽지 못했다면 그 사실을 사용자에게 알리고, 교사 프로파일 문서를 대화에 첨부해 달라고 요청하세요.",
        SKILL_USAGE_PRINCIPLES,
      );
  const entries = [
    { path: `${SKILL_NAME}/SKILL.md`, content: instructions },
    {
      path: `${SKILL_NAME}/references/teacher-profile.md`,
      content: profileToMarkdown(parsed.data),
    },
  ];
  const issues = checkSkillPackage(entries);
  if (issues.length > 0) return { ok: false, error: "incompatible", issues };
  const encoder = new TextEncoder();
  return {
    ok: true,
    embeddedCore,
    value: {
      path: "teacher-context.zip",
      mediaType: "application/zip",
      content: createStoredZip(
        entries.map((entry) => ({
          path: entry.path,
          content: encoder.encode(entry.content),
        })),
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
