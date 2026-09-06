import {
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
  type TeacherContextProfile,
} from "@/types/profile";

const clean = (value: string): string =>
  value
    .replace(/[\u0000-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const list = (values: readonly string[]): string =>
  values.length > 0
    ? values.map((value) => `- ${clean(value)}`).join("\n")
    : "- 없음";

const roleLabel = (role: string): string => {
  const parsedRole = teacherRoleSchema.safeParse(role);
  return parsedRole.success
    ? TEACHER_ROLE_LABELS[parsedRole.data]
    : clean(role);
};

export function profileToPlainText(input: TeacherContextProfile): string {
  const profile = teacherContextProfileSchema.parse(input);
  const modules = new Map(profile.modules.map((module) => [module.id, module]));
  const lines = [
    CONTEXT_DOCUMENT_TITLE,
    "용도: 수업안·활동지·평가·수업 자료를 설계하거나 기존 수업을 검토할 때 반복해서 사용하는 기본 컨텍스트",
    "적용 원칙: 교과·단원·성취기준·시간 등 현재 수업 정보가 이 프로필과 다르면 현재 수업 정보를 우선함",
    ...PROFILE_INTERPRETATION_RULES.map((rule) => `해석 원칙: ${rule}`),
    `학교급: ${SCHOOL_LEVEL_DISPLAY_LABELS[profile.metadata.schoolLevel]}`,
    `역할: ${roleLabel(profile.metadata.role)}`,
    ...(profile.metadata.teachingSubject === undefined
      ? []
      : [
          `담당 교과: ${TEACHING_SUBJECT_LABELS[profile.metadata.teachingSubject]}`,
        ]),
    profile.privacyReview.status === "needs_review"
      ? "개인정보 상태: 경고를 확인한 로컬 문서 — 식별 가능 정보가 남아 있을 수 있음"
      : "개인정보 상태: 자동 검사 통과",
    hasUnresolvedClaims(profile)
      ? "상태: 확인이 필요한 문장이 남아 있음"
      : "상태: 교사 검토 완료",
    "",
    "요약",
    clean(profile.shortSummary),
  ];

  PROFILE_MODULE_IDS.forEach((id, index) => {
    const profileModule = modules.get(id);
    if (!profileModule) return;
    lines.push(
      "",
      `${index + 1}. ${clean(profileModule.title)}`,
      clean(profileModule.summary),
      ...profileModule.claims.map((claim) => {
        const label =
          claim.basis === "direct"
            ? "직접 진술"
            : claim.basis === "inferred"
              ? "AI 해석"
              : "확인 필요";
        return `- [${label}] ${clean(claim.text)}`;
      }),
    );
  });

  lines.push(
    "",
    "수업 설계 원칙",
    list(profile.teachingDesignPrinciples),
    "",
    "학급 지원 고려사항",
    list(profile.classSupportConsiderations),
    "",
    "현실적인 제약",
    list(profile.realisticConstraints),
    "",
    "AI 협업 지침",
    list(profile.aiCollaborationInstructions),
    "",
    "수업마다 추가할 작업 컨텍스트",
    "- 교과·학년·단원 또는 주제",
    "- 성취기준·학습목표·핵심 질문",
    "- 수업 시간·차시·핵심 학생 활동",
    "- 사용 가능한 자료·기기와 집단 수준 지원",
    "- 원하는 결과물과 반드시 지킬 제약",
    "",
    "생성 결과 자기 점검",
    list(LESSON_DESIGN_SELF_CHECKS),
  );

  return lines.join("\n").trimEnd();
}

/**
 * Compact, vendor-neutral context suitable for pasting into an AI request.
 * Keeps evidence labels while omitting raw question IDs and analytics tags.
 */
export function profileToCompactText(input: TeacherContextProfile): string {
  const profile = teacherContextProfileSchema.parse(input);
  const setupContext = [
    SCHOOL_LEVEL_DISPLAY_LABELS[profile.metadata.schoolLevel],
    roleLabel(profile.metadata.role),
    ...(profile.metadata.teachingSubject === undefined
      ? []
      : [TEACHING_SUBJECT_LABELS[profile.metadata.teachingSubject]]),
  ].join(" · ");
  const confirmedContextByModule = profile.modules.flatMap((module) => {
    const claims = module.claims
      .filter(
        (claim) =>
          claim.confirmedByUser && claim.basis !== "needs_confirmation",
      )
      .map(
        (claim) =>
          `${claim.basis === "inferred" ? "[AI 해석]" : "[직접 진술]"} ${clean(claim.text)}`,
      );

    return claims.length > 0
      ? [`[확인된 맥락 · ${clean(module.title)}] ${claims.join(" / ")}`]
      : [];
  });

  return [
    ...(profile.privacyReview.status === "needs_review"
      ? [
          "[개인정보 경고] 식별 가능 정보가 남아 있을 수 있어 외부 서비스에 붙여 넣기 전에 직접 확인해야 합니다.",
        ]
      : []),
    `[학교급·역할·담당 교과] ${setupContext}`,
    `[교사 컨텍스트] ${clean(profile.shortSummary)}`,
    ...PROFILE_INTERPRETATION_RULES.map((rule) => `[해석 원칙] ${rule}`),
    "[적용 원칙] 현재 수업의 교과·단원·성취기준·시간 정보가 프로필과 다르면 현재 수업 정보를 우선하세요.",
    `[수업 원칙] ${profile.teachingDesignPrinciples.map(clean).join(" / ") || "별도 확인 필요"}`,
    `[지원 고려] ${profile.classSupportConsiderations.map(clean).join(" / ") || "별도 확인 필요"}`,
    `[현실 제약] ${profile.realisticConstraints.map(clean).join(" / ") || "별도 확인 필요"}`,
    ...(confirmedContextByModule.length > 0
      ? confirmedContextByModule
      : ["[확인된 맥락] 별도 확인 필요"]),
    `[AI 지침] ${profile.aiCollaborationInstructions.map(clean).join(" / ") || "교사의 최종 판단을 우선할 것"}`,
    "[최종 확인] AI 제안은 초안입니다. 학습목표, 학생 참여와 지원, 실행 가능성, 개인정보를 교사가 확인하세요.",
  ].join("\n");
}

export const generatePlainText = profileToPlainText;
export const generateCompactProfile = profileToCompactText;
