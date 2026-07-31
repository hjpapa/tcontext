import { detectPrivacyRisks } from "@/lib/privacy/detector";
import { ApiError } from "@/lib/security/api-error";
import type { PrivacyReview, TeacherContextProfile } from "@/types/profile";

export type TextField = {
  path: string;
  value: string;
};

export function collectTextFields(value: unknown, path = "value"): TextField[] {
  if (typeof value === "string") return [{ path, value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectTextFields(item, `${path}.${index}`),
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectTextFields(item, `${path}.${key}`),
    );
  }
  return [];
}

const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function privacyMatchesForField({ path, value }: TextField) {
  return detectPrivacyRisks(value).matches.filter(
    (match) =>
      !(
        path === "profile.metadata.generatedAt" &&
        ISO_TIMESTAMP.test(value) &&
        match.type === "birth_date"
      ),
  );
}

export function findPrivacyRisks(fields: readonly TextField[]) {
  return fields.flatMap(({ path, value }) =>
    privacyMatchesForField({ path, value }).map((match) => ({
      category: match.type,
      path,
      start: match.start,
      end: match.end,
      reason: match.reason,
      suggestedRewrite: match.suggestedRewrite,
    })),
  );
}

/**
 * Collects every persisted teacher/AI-authored string. The scanner suppresses
 * only the expected birth-date false positive for a schema-valid generatedAt
 * timestamp; fixed enums and all metadata still cross the scan boundary.
 */
export function collectProfilePrivacyTextFields(
  profile: TeacherContextProfile,
): TextField[] {
  return collectTextFields(profile, "profile");
}

/**
 * Collects only natural-language profile fields that a teacher can review.
 * Machine metadata, identifiers, controlled tags, and a prior privacy review
 * are deliberately excluded from the final AI review input.
 */
export function collectProfileAuthoredTextFields(
  profile: TeacherContextProfile,
): TextField[] {
  return [
    { path: "profile.profileTitle", value: profile.profileTitle },
    { path: "profile.shortSummary", value: profile.shortSummary },
    ...profile.modules.flatMap((module, moduleIndex) => [
      {
        path: `profile.modules.${moduleIndex}.title`,
        value: module.title,
      },
      {
        path: `profile.modules.${moduleIndex}.summary`,
        value: module.summary,
      },
      ...module.claims.map((claim, claimIndex) => ({
        path: `profile.modules.${moduleIndex}.claims.${claimIndex}.text`,
        value: claim.text,
      })),
    ]),
    ...profile.teachingDesignPrinciples.map((value, index) => ({
      path: `profile.teachingDesignPrinciples.${index}`,
      value,
    })),
    ...profile.classSupportConsiderations.map((value, index) => ({
      path: `profile.classSupportConsiderations.${index}`,
      value,
    })),
    ...profile.realisticConstraints.map((value, index) => ({
      path: `profile.realisticConstraints.${index}`,
      value,
    })),
    ...profile.aiCollaborationInstructions.map((value, index) => ({
      path: `profile.aiCollaborationInstructions.${index}`,
      value,
    })),
  ].filter((field) => field.value.trim().length > 0);
}

/**
 * Stops sensitive text before it reaches OpenAI. The response contains only
 * offsets and remediation guidance; the matched personal text is not echoed.
 */
export function assertSafeForAI(fields: readonly TextField[]): void {
  const findings = findPrivacyRisks(fields);
  if (findings.length > 0) {
    throw new ApiError(
      "privacy_risk_detected",
      422,
      "개인정보 또는 민감정보로 보이는 내용을 수정한 뒤 다시 시도해 주세요.",
      { details: { findings } },
    );
  }
}

function localPrivacyReviewForFields(fields: readonly TextField[]) {
  const items = fields.flatMap((field): PrivacyReview["items"] => {
    const matches = privacyMatchesForField(field);
    if (matches.length === 0) return [];

    return [
      {
        text: field.value,
        reason: [...new Set(matches.map((match) => match.reason))].join(" "),
        suggestedRewrite:
          matches[0]?.suggestedRewrite ??
          "개인을 특정하지 않는 지원 중심 표현으로 수정해 주세요.",
      },
    ];
  });

  return items.length > 0
    ? { status: "needs_review" as const, items }
    : { status: "clear" as const, items: [] };
}

/** Full persisted-profile defense used before optional contribution storage. */
export function localProfilePrivacyReview(profile: TeacherContextProfile) {
  return localPrivacyReviewForFields(collectProfilePrivacyTextFields(profile));
}

/** Teacher-visible final review that excludes machine-only profile fields. */
export function localAuthoredProfilePrivacyReview(
  profile: TeacherContextProfile,
) {
  return localPrivacyReviewForFields(collectProfileAuthoredTextFields(profile));
}
