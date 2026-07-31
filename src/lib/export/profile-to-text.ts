import {
  PROFILE_MODULE_IDS,
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

export function profileToPlainText(input: TeacherContextProfile): string {
  const profile = teacherContextProfileSchema.parse(input);
  const modules = new Map(profile.modules.map((module) => [module.id, module]));
  const lines = [
    "AI 활용을 위한 교사 프로파일 컨텍스트",
    `학교급: ${profile.metadata.schoolLevel}`,
    `역할: ${clean(profile.metadata.role)}`,
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
  );

  return lines.join("\n").trimEnd();
}

/**
 * Compact, vendor-neutral context suitable for pasting into an AI request.
 * Evidence metadata and analytics tags are intentionally omitted.
 */
export function profileToCompactText(input: TeacherContextProfile): string {
  const profile = teacherContextProfileSchema.parse(input);
  const confirmedClaims = profile.modules.flatMap((module) =>
    module.claims
      .filter(
        (claim) =>
          claim.confirmedByUser && claim.basis !== "needs_confirmation",
      )
      .map((claim) => clean(claim.text)),
  );

  return [
    `[교사 컨텍스트] ${clean(profile.shortSummary)}`,
    `수업 원칙: ${profile.teachingDesignPrinciples.map(clean).join(" / ") || "별도 확인 필요"}`,
    `지원 고려: ${profile.classSupportConsiderations.map(clean).join(" / ") || "별도 확인 필요"}`,
    `현실 제약: ${profile.realisticConstraints.map(clean).join(" / ") || "별도 확인 필요"}`,
    `확인된 맥락: ${confirmedClaims.join(" / ") || "별도 확인 필요"}`,
    `AI 지침: ${profile.aiCollaborationInstructions.map(clean).join(" / ") || "교사의 최종 판단을 우선할 것"}`,
  ].join("\n");
}

export const generatePlainText = profileToPlainText;
export const generateCompactProfile = profileToCompactText;
