import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  PROFILE_MODULE_IDS,
  PROFILE_MODULE_TITLES,
  UNVERIFIED_PRIVACY_REVIEW,
  type TeacherContextProfile,
} from "@/types/profile";
import type { ContextAsOf, VariantResult } from "./profile-variants";

export const TEST_AS_OF: ContextAsOf = {
  date: "2026-10-27",
  source: "confirmed",
};

function maximalProfile(): TeacherContextProfile {
  const profile = structuredClone(FICTIONAL_PROFILES[1]!);
  profile.profileTitle = "합성 교사 맥락 문서";
  profile.shortSummary = "합성 전체 요약은 모듈 선택본에 포함하지 않습니다.";
  profile.metadata.generatedAt = "2026-10-25T15:30:00.000Z";
  profile.modules = PROFILE_MODULE_IDS.map((id, moduleIndex) => ({
    id,
    title: PROFILE_MODULE_TITLES[id],
    summary: `영역 ${moduleIndex + 1}의 검토한 요약 문단입니다.`,
    claims: [
      {
        id: `variant-${moduleIndex}-direct`,
        text: `영역 ${moduleIndex + 1}의 직접 진술은 충분한 준비 시간과 선택 기회를 둡니다.`,
        basis: "direct",
        confirmedByUser: moduleIndex !== 6,
        evidenceQuestionIds: ["fixture-question"],
      },
      {
        id: `variant-${moduleIndex}-inferred`,
        text: `영역 ${moduleIndex + 1}의 승인된 해석은 활동 순서를 함께 검토한다는 것입니다.`,
        basis: "inferred",
        confirmedByUser: moduleIndex !== 6,
        evidenceQuestionIds: ["fixture-question"],
      },
      {
        id: `variant-${moduleIndex}-unconfirmed`,
        text: `영역 ${moduleIndex + 1}의 미확인 해석은 교사가 아직 승인하지 않은 내용입니다.`,
        basis: "inferred",
        confirmedByUser: false,
        evidenceQuestionIds: ["fixture-question"],
      },
      {
        id: `variant-${moduleIndex}-pending`,
        text: `영역 ${moduleIndex + 1}의 확인 필요 문장은 다음 검토에서 직접 확인합니다.`,
        basis: "needs_confirmation",
        confirmedByUser: false,
        evidenceQuestionIds: ["fixture-question"],
      },
    ],
  }));
  profile.modules[1]!.claims[0]!.text =
    "도구 <선택> & 안내문에 javascript: 실행 주소가 포함되지 않도록 확인합니다.";
  profile.modules[2]!.claims[0]!.text =
    "첫 번째 활동은 교사가 순서를 안내합니다.\n두 번째 활동은 참여 방법을 고를 수 있게 합니다.";
  profile.teachingDesignPrinciples = Array.from(
    { length: 6 },
    (_, i) =>
      `원칙 ${i + 1}: 수업 설계에서 질문과 선택 기회를 함께 검토합니다.`,
  );
  profile.teachingDesignPrinciples[0] = profile.modules[0]!.claims[0]!.text;
  profile.classSupportConsiderations = Array.from(
    { length: 6 },
    (_, i) => `지원 ${i + 1}: 집단 수준의 참여를 위해 준비 시간을 제공합니다.`,
  );
  profile.classSupportConsiderations[0] = profile.teachingDesignPrinciples[1]!;
  profile.realisticConstraints = Array.from(
    { length: 5 },
    (_, i) => `제약 ${i + 1}: 준비 시간이 부족하면 대체 활동을 선택합니다.`,
  );
  profile.realisticConstraints[0] = profile.modules[0]!.claims[0]!.text;
  profile.aiCollaborationInstructions = Array.from(
    { length: 6 },
    (_, i) =>
      `판단 경계 ${i + 1}: 근거를 확인한 뒤 교사가 최종 결정을 내립니다.`,
  );
  profile.aiCollaborationInstructions[0] = profile.modules[0]!.claims[0]!.text;
  profile.privacyReview = { status: "clear", items: [] };
  return profile;
}

export const MAX_VARIANT_PROFILE = maximalProfile();
const warning = structuredClone(MAX_VARIANT_PROFILE);
warning.privacyReview = {
  status: "needs_review",
  items: [
    {
      text: "검토할 표현",
      reason: "공유 전 확인이 필요합니다.",
      suggestedRewrite: "집단 지원 표현으로 검토합니다.",
    },
  ],
};
const unverified = structuredClone(MAX_VARIANT_PROFILE);
unverified.privacyReview = structuredClone(UNVERIFIED_PRIVACY_REVIEW);
const legacy = structuredClone(FICTIONAL_PROFILES[1]!);
delete legacy.metadata.teachingSubject;

export const VARIANT_FIXTURES = [
  ...FICTIONAL_PROFILES.map((profile, index) => ({
    name: `fictional-${index}`,
    profile,
  })),
  { name: "maximal", profile: MAX_VARIANT_PROFILE },
  { name: "privacy-warning", profile: warning },
  { name: "privacy-unverified", profile: unverified },
  { name: "legacy", profile: legacy },
];

export function variantMarkdown(result: VariantResult): string {
  if (!result.ok)
    throw new Error(`Expected successful variant: ${result.error}`);
  return result.markdown;
}
