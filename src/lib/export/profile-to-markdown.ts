import {
  AI_CONTEXT_PRIORITIES,
  CONTEXT_DOCUMENT_FORMAT_VERSION,
  CONTEXT_DOCUMENT_TITLE,
  LESSON_DESIGN_SELF_CHECKS,
  PROFILE_INTERPRETATION_RULES,
  SCHOOL_LEVEL_DISPLAY_LABELS,
} from "@/content/profile-document";
import { TEACHER_ROLE_LABELS, teacherRoleSchema } from "@/types/interview";
import {
  PROFILE_MODULE_IDS,
  TEACHING_SUBJECT_LABELS,
  hasUnresolvedClaims,
  teacherContextProfileSchema,
  type ProfileClaim,
  type TeacherContextProfile,
} from "@/types/profile";

import { sanitizeMarkdownText, yamlQuoted } from "./sanitize";

const CLAIM_GROUPS: ReadonlyArray<{
  basis: ProfileClaim["basis"];
  title: string;
}> = [
  { basis: "direct", title: "교사가 직접 말한 내용" },
  { basis: "inferred", title: "AI가 답변을 종합해 해석한 내용" },
  { basis: "needs_confirmation", title: "확인하거나 수정할 내용" },
];

function markdownList(values: readonly string[], emptyText: string): string {
  if (values.length === 0) return `- ${emptyText}`;
  return values
    .map((value) => {
      const safe = sanitizeMarkdownText(value).replaceAll("\n", "\n  ");
      return `- ${safe}`;
    })
    .join("\n");
}

function roleLabel(role: string): string {
  const parsedRole = teacherRoleSchema.safeParse(role);
  return parsedRole.success ? TEACHER_ROLE_LABELS[parsedRole.data] : role;
}

function frontMatter(profile: TeacherContextProfile): string {
  return [
    "---",
    `document_type: ${yamlQuoted("teacher_profile_context")}`,
    `document_format_version: ${yamlQuoted(CONTEXT_DOCUMENT_FORMAT_VERSION)}`,
    `title: ${yamlQuoted(CONTEXT_DOCUMENT_TITLE)}`,
    `profile_title: ${yamlQuoted(profile.profileTitle)}`,
    `service: ${yamlQuoted("TContext")}`,
    `language: ${yamlQuoted("ko-KR")}`,
    `school_level: ${yamlQuoted(SCHOOL_LEVEL_DISPLAY_LABELS[profile.metadata.schoolLevel])}`,
    `role: ${yamlQuoted(roleLabel(profile.metadata.role))}`,
    ...(profile.metadata.teachingSubject === undefined
      ? []
      : [
          `teaching_subject: ${yamlQuoted(TEACHING_SUBJECT_LABELS[profile.metadata.teachingSubject])}`,
        ]),
    `schema_version: ${yamlQuoted(profile.metadata.schemaVersion)}`,
    `prompt_version: ${yamlQuoted(profile.metadata.promptVersion)}`,
    `created_at: ${yamlQuoted(profile.metadata.generatedAt)}`,
    `context_scope: ${yamlQuoted("반복 사용하는 교사 프로필과 수업 설계 기본 원칙")}`,
    `privacy_rule: ${yamlQuoted("이름·학교명·특정 학급명·개별 학생 정보는 포함하지 않음")}`,
    `privacy_review: ${yamlQuoted(profile.privacyReview.status)}`,
    `needs_claim_review: ${hasUnresolvedClaims(profile) ? "true" : "false"}`,
    "---",
  ].join("\n");
}

function claimSections(claims: readonly ProfileClaim[]): string[] {
  const sections: string[] = [];

  for (const group of CLAIM_GROUPS) {
    const groupedClaims = claims.filter((claim) => claim.basis === group.basis);
    if (groupedClaims.length === 0) continue;
    sections.push("", `### ${group.title}`, "");
    groupedClaims.forEach((claim) => {
      const reviewLabel = claim.confirmedByUser ? "" : " **[검토 전]**";
      sections.push(
        `- ${sanitizeMarkdownText(claim.text).replaceAll("\n", "\n  ")}${reviewLabel}`,
      );
    });
  }

  return sections.length > 0 ? sections : ["", "- 작성된 내용이 없습니다."];
}

function lessonTaskContext(profile: TeacherContextProfile): string[] {
  const defaultSubject =
    profile.metadata.teachingSubject === undefined ||
    profile.metadata.teachingSubject === "not_applicable"
      ? ""
      : TEACHING_SUBJECT_LABELS[profile.metadata.teachingSubject];

  return [
    "```yaml",
    "# 개인 학생 정보, 학교명, 특정 학급명, 진단·상담·개별 성적은 입력하지 마세요.",
    'task_type: "수업 설계 | 슬라이드 | 활동지 | 평가 | 수업 검토"',
    `school_level: ${yamlQuoted(SCHOOL_LEVEL_DISPLAY_LABELS[profile.metadata.schoolLevel])}`,
    'grade: ""',
    `subject: ${yamlQuoted(defaultSubject)}`,
    'unit_or_topic: ""',
    'achievement_standard: ""',
    "lesson_duration_minutes: null # 이번 작업에 필요한 경우 직접 입력",
    "number_of_lessons: null",
    'learning_goal: ""',
    'essential_question: ""',
    'core_student_activity: ""',
    'student_use_of_ai: "없음 | 교사 시연 | 모둠 활용 | 학생 개별 활용"',
    'available_devices_and_tools: ""',
    'materials: ""',
    'classwide_learning_supports: ""',
    'classwide_participation_or_emotional_supports: ""',
    'desired_output: "수업안 | 슬라이드 구성안 | 활동지 | 평가 기준"',
    'must_include: ""',
    'constraints: ""',
    "```",
  ];
}

function executionPrompt(): string[] {
  return [
    "```text",
    "이 교사 프로파일을 반복해서 사용하는 기본 배경으로 삼고, 이 문서의 수업 작업 컨텍스트에 맞는 초안을 작성해 주세요.",
    "현재 작업 정보가 프로파일과 다르면 현재 작업 정보를 우선하세요.",
    "다만 교사가 밝힌 가치나 판단 경계와 충돌하면 충돌과 대안을 설명하고 확인하세요. AI 해석이나 확인 필요 항목을 확정된 선호로 사용하지 마세요.",
    "교사가 원하는 AI 작업과 답변 방식을 반영하고, 개인적 가치가 이번 제안의 어떤 선택에 반영되었는지 짧게 설명하세요.",
    "결과에 큰 영향을 주는 정보가 부족하면 먼저 질문을 최대 3개만 하고, 바로 초안이 필요하면 가정을 명시하세요.",
    "교사의 설명과 학생이 실제로 수행할 행동을 함께 분명히 설계하고, 교사 프로필에서 확인된 참여 방식을 반영해 주세요.",
    "이 문서의 수업 설계 원칙, 집단 수준 지원, 현실 제약을 반영하고 AI가 필요하지 않으면 억지로 넣지 마세요.",
    "개인 학생을 추정하거나 분류하지 말고, 개인정보를 만들거나 요구하지 마세요.",
    "마지막에 반영한 원칙과 지원, 확인이 필요한 가정, 교사가 최종 선택할 지점을 짧게 정리하세요.",
    "```",
  ];
}

export function profileToMarkdown(input: TeacherContextProfile): string {
  const profile = teacherContextProfileSchema.parse(input);
  const moduleById = new Map(
    profile.modules.map((profileModule) => [profileModule.id, profileModule]),
  );
  const sections: string[] = [
    frontMatter(profile),
    "",
    `# ${sanitizeMarkdownText(profile.profileTitle)}`,
    "",
    "## 0. 문서의 목적과 사용 방법",
    "",
    "이 문서는 인터뷰를 통해 만든 익명의 교사 프로파일로, 수업안·활동지·평가·수업 자료를 설계하거나 기존 수업을 검토할 때 반복해서 사용하는 기본 컨텍스트이다.",
    "교과·단원·성취기준·시간처럼 수업마다 달라지는 정보는 문서 끝의 작업 양식에 별도로 추가한다.",
    "",
    "### AI가 이 문서를 사용할 때의 우선순위",
    "",
    ...AI_CONTEXT_PRIORITIES.map((item, index) => `${index + 1}. ${item}`),
    "",
    "### 해석 원칙",
    "",
    ...PROFILE_INTERPRETATION_RULES.map((item) => `- ${item}`),
    "",
    "### 근거 표시를 읽는 법",
    "",
    "- **교사가 직접 말한 내용**은 인터뷰 답변에 명시된 사실이나 선택이다.",
    "- **AI가 답변을 종합해 해석한 내용**은 여러 답변의 단서를 연결한 설계 가설이며 교사가 수정하거나 삭제할 수 있다.",
    "- **확인하거나 수정할 내용**과 **[검토 전]** 표시는 AI에 사용하기 전에 교사가 먼저 확인해야 한다.",
  ];

  if (profile.privacyReview.status === "needs_review") {
    sections.push(
      "",
      "> **개인정보 경고:** 자동 검사에서 확인이 필요한 표현이 남아 있습니다. 공유하거나 다른 AI에 입력하기 전에 식별 가능한 정보가 없는지 직접 다시 확인해 주세요. 이 상태의 문서는 서버에 선택 저장할 수 없습니다.",
    );
  }

  if (hasUnresolvedClaims(profile)) {
    sections.push(
      "",
      "> **검토 필요:** 아직 확인되지 않은 문장이 있습니다. AI에 사용하기 전에 **[검토 전]** 문장을 수정·삭제하거나 확인해 주세요.",
    );
  }

  sections.push(
    "",
    "## AI 종합 프로파일 요약",
    "",
    sanitizeMarkdownText(profile.shortSummary),
    "",
    "# 교사 프로파일",
  );

  PROFILE_MODULE_IDS.forEach((id, index) => {
    const profileModule = moduleById.get(id);
    if (!profileModule) return;
    sections.push(
      "",
      `## M${index + 1}. ${sanitizeMarkdownText(profileModule.title)}`,
      "",
      sanitizeMarkdownText(profileModule.summary),
      ...claimSections(profileModule.claims),
    );
  });

  sections.push(
    "",
    "# 수업 설계 실행 가이드",
    "",
    "## 핵심 수업 설계 원칙",
    "",
    markdownList(
      profile.teachingDesignPrinciples,
      "아직 확인된 원칙이 없습니다.",
    ),
    "",
    "## 학급 지원 고려사항",
    "",
    markdownList(
      profile.classSupportConsiderations,
      "아직 확인된 지원 고려사항이 없습니다.",
    ),
    "",
    "## 현실적인 제약과 대체안",
    "",
    markdownList(profile.realisticConstraints, "아직 확인된 제약이 없습니다."),
    "",
    "## AI와 협업할 때의 지침과 판단 경계",
    "",
    markdownList(
      profile.aiCollaborationInstructions,
      "AI 협업 지침을 직접 추가해 주세요.",
    ),
    "",
    "## 생성 결과 자기 점검",
    "",
    ...LESSON_DESIGN_SELF_CHECKS.map((item) => `- [ ] ${item}`),
    "",
    "# 수업마다 추가할 작업 컨텍스트",
    "",
    ...lessonTaskContext(profile),
    "",
    "# AI에게 바로 전달할 실행 프롬프트",
    "",
    ...executionPrompt(),
    "",
    "# 유지·갱신 안내",
    "",
    "- 정체성·역할·교육관은 역할이나 관점이 달라졌을 때 다시 검토한다.",
    "- 수업 방식·자료·평가·AI 활용 원칙은 새로운 실천이 자리 잡았을 때 갱신한다.",
    "- 학급 맥락과 지원 조건은 학기 또는 수업 집단이 바뀔 때 다시 확인한다.",
    "- 수업 작업 컨텍스트는 저장되는 프로필이 아니며 수업마다 새로 작성한다.",
    "",
  );

  return sections.join("\n");
}

export const generateProfileMarkdown = profileToMarkdown;
