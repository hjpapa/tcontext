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

export function localProfilePrivacyReview(profile: TeacherContextProfile) {
  const items = collectProfilePrivacyTextFields(profile).flatMap(
    (field): PrivacyReview["items"] => {
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
    },
  );

  return items.length > 0
    ? { status: "needs_review" as const, items }
    : { status: "clear" as const, items: [] };
}
