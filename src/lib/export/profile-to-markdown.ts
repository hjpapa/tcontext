import {
  CONTROLLED_TAGS,
  PROFILE_MODULE_IDS,
  hasUnresolvedClaims,
  teacherContextProfileSchema,
  type ControlledTagCategory,
  type ProfileClaim,
  type TeacherContextProfile,
} from "@/types/profile";

import { sanitizeMarkdownText, yamlQuoted } from "./sanitize";

const DOCUMENT_TITLE = "AI 활용을 위한 교사 프로파일 컨텍스트";

const TAG_LABELS: Record<ControlledTagCategory, string> = {
  preferredTeachingMethods: "선호 수업 방식",
  participationPriorities: "참여 우선순위",
  emotionalSupportPriorities: "정서 지원 우선순위",
  assessmentPriorities: "평가 우선순위",
  environmentConstraints: "환경 제약",
  aiBoundaries: "AI 활용 경계",
};

const CLAIM_LABELS: Record<ProfileClaim["basis"], string> = {
  direct: "직접 답변에 근거함",
  inferred: "AI가 답변을 종합해 해석함",
  needs_confirmation: "추가 확인 필요",
};

function markdownList(values: readonly string[], emptyText: string): string {
  if (values.length === 0) return `- ${emptyText}`;
  return values
    .map((value) => {
      const safe = sanitizeMarkdownText(value).replaceAll("\n", "\n  ");
      return `- ${safe}`;
    })
    .join("\n");
}

function claimLine(claim: ProfileClaim): string {
  const confirmation =
    claim.basis === "needs_confirmation" || !claim.confirmedByUser
      ? " · 검토 전"
      : "";
  const label = `${CLAIM_LABELS[claim.basis]}${confirmation}`;
  return `- **${label}:** ${sanitizeMarkdownText(claim.text).replaceAll("\n", "\n  ")}`;
}

function frontMatter(profile: TeacherContextProfile): string {
  return [
    "---",
    `title: ${yamlQuoted(DOCUMENT_TITLE)}`,
    `service: ${yamlQuoted("TContext")}`,
    `school_level: ${yamlQuoted(profile.metadata.schoolLevel)}`,
    `role: ${yamlQuoted(profile.metadata.role)}`,
    `schema_version: ${yamlQuoted(profile.metadata.schemaVersion)}`,
    `created_at: ${yamlQuoted(profile.metadata.generatedAt)}`,
    `privacy_review: ${yamlQuoted(profile.privacyReview.status)}`,
    `needs_claim_review: ${hasUnresolvedClaims(profile) ? "true" : "false"}`,
    "---",
  ].join("\n");
}

export function profileToMarkdown(input: TeacherContextProfile): string {
  const profile = teacherContextProfileSchema.parse(input);
  const moduleById = new Map(
    profile.modules.map((module) => [module.id, module]),
  );
  const sections: string[] = [
    frontMatter(profile),
    "",
    `# ${DOCUMENT_TITLE}`,
    "",
    "## 문서 사용 안내",
    "",
    "이 문서는 나의 교육관, 수업 방식, 학급 맥락과 AI 협업 원칙을 설명하기 위한 기본 컨텍스트이다.",
    "교과, 단원, 성취기준과 같은 정보는 작업할 때 별도로 추가한다.",
  ];

  if (profile.privacyReview.status === "needs_review") {
    sections.push(
      "",
      "> **개인정보 경고:** 자동 검사에서 확인이 필요한 표현이 남아 있습니다. 이 문서는 사용자가 경고를 확인하고 서버에 저장하지 않은 상태로 만든 결과입니다. 공유하거나 다른 AI에 입력하기 전에 식별 가능한 정보가 없는지 직접 다시 확인해 주세요.",
    );
  }

  if (hasUnresolvedClaims(profile)) {
    sections.push(
      "",
      "> **검토 필요:** 아직 확인되지 않은 문장이 있습니다. AI에 사용하기 전에 표시된 문장을 수정·삭제하거나 확인해 주세요.",
    );
  }

  sections.push(
    "",
    "## 프로파일 요약",
    "",
    sanitizeMarkdownText(profile.shortSummary),
  );

  PROFILE_MODULE_IDS.forEach((id, index) => {
    const profileModule = moduleById.get(id);
    if (!profileModule) return;
    sections.push(
      "",
      `## ${index + 1}. ${sanitizeMarkdownText(profileModule.title)}`,
      "",
      sanitizeMarkdownText(profileModule.summary),
      "",
      ...(profileModule.claims.length > 0
        ? profileModule.claims.map(claimLine)
        : ["- 아직 작성된 내용이 없습니다."]),
    );
  });

  sections.push(
    "",
    "## 수업 설계 시 고려할 기본 원칙",
    "",
    markdownList(
      profile.teachingDesignPrinciples,
      "아직 확인된 원칙이 없습니다.",
    ),
    "",
    "### 학급 지원 시 고려사항",
    "",
    markdownList(
      profile.classSupportConsiderations,
      "아직 확인된 지원 고려사항이 없습니다.",
    ),
    "",
    "### 현실적인 제약",
    "",
    markdownList(profile.realisticConstraints, "아직 확인된 제약이 없습니다."),
    "",
    "## AI와 협업할 때의 기본 지침",
    "",
    markdownList(
      profile.aiCollaborationInstructions,
      "AI 협업 지침을 직접 추가해 주세요.",
    ),
    "",
    "## 확인한 분석용 태그",
    "",
  );

  for (const key of Object.keys(CONTROLLED_TAGS) as ControlledTagCategory[]) {
    const tags = profile.confirmedTags[key];
    if (tags.length > 0) {
      sections.push(
        `- **${TAG_LABELS[key]}:** ${tags.map(sanitizeMarkdownText).join(", ")}`,
      );
    }
  }
  if (Object.values(profile.confirmedTags).every((tags) => tags.length === 0)) {
    sections.push("- 사용자가 확인한 태그가 없습니다.");
  }

  sections.push(
    "",
    "## 수업마다 추가할 작업 컨텍스트",
    "",
    "교과·단원:",
    "관련 성취기준:",
    "이번 수업의 학습목표:",
    "수업 시간:",
    "학생이 수행할 핵심 활동:",
    "사용 가능한 자료와 기기:",
    "이번 수업에서 특히 고려할 점:",
    "원하는 결과물:",
    "",
  );

  return sections.join("\n");
}

export const generateProfileMarkdown = profileToMarkdown;
