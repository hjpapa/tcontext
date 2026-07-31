import "server-only";

import { reviewProfileWithAI } from "@/lib/ai/privacy";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import {
  APP_VERSION,
  OPENAI_MODELS,
  PROMPT_VERSION,
  PROFILE_SCHEMA_VERSION,
} from "@/lib/ai/models";
import {
  assertConsentVersion,
  calculateRetentionUntil,
  getConsentVersion,
} from "@/lib/consent/policy";
import { ApiError } from "@/lib/security/api-error";
import {
  createDeletionToken,
  hashDeletionToken,
} from "@/lib/security/hash-token";
import { localProfilePrivacyReview } from "@/lib/security/privacy-guard";
import { insertSubmission } from "@/lib/supabase/submissions";
import {
  hasUnresolvedClaims,
  teacherContextProfileSchema,
} from "@/types/profile";
import { teacherRoleSchema } from "@/types/interview";
import type { z } from "zod";
import type { submissionCreateRequestSchema } from "@/lib/ai/schemas/requests";

type SubmissionRequest = z.output<typeof submissionCreateRequestSchema>;

function normalizedMarkdown(markdown: string): string {
  return `${markdown
    .replace(/^\uFEFF/u, "")
    .replaceAll("\r\n", "\n")
    .trimEnd()}\n`;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateContribution(input: SubmissionRequest) {
  if (!input.consentAccepted) {
    throw new ApiError(
      "consent_required",
      403,
      "선택적 데이터 기여에는 명시적인 동의가 필요합니다.",
    );
  }

  assertConsentVersion(input.consentVersion);

  const profile = teacherContextProfileSchema.parse(input.profile);

  if (
    !teacherRoleSchema.safeParse(profile.metadata.role).success ||
    profile.metadata.schemaVersion !== PROFILE_SCHEMA_VERSION ||
    profile.metadata.promptVersion !== PROMPT_VERSION ||
    profile.metadata.modelName !== OPENAI_MODELS.profile
  ) {
    throw new ApiError(
      "profile_data_mismatch",
      409,
      "프로파일 생성 메타데이터가 현재 서버 설정과 일치하지 않습니다.",
    );
  }

  if (profile.privacyReview.status !== "clear") {
    throw new ApiError(
      "privacy_review_required",
      422,
      "개인정보 최종 점검을 완료한 뒤 저장해 주세요.",
    );
  }

  if (hasUnresolvedClaims(profile)) {
    throw new ApiError(
      "unresolved_claims",
      422,
      "확인 필요 문장과 미확인 문장을 모두 처리한 뒤 저장해 주세요.",
    );
  }

  if (
    !sameJson(profile.confirmedTags, input.confirmedTags) ||
    !sameJson(profile.privacyReview, input.privacyReview)
  ) {
    throw new ApiError(
      "profile_data_mismatch",
      409,
      "프로파일과 확인 데이터가 일치하지 않습니다.",
    );
  }

  const expectedMarkdown = profileToMarkdown(profile);
  if (
    normalizedMarkdown(input.profileMarkdown) !==
    normalizedMarkdown(expectedMarkdown)
  ) {
    throw new ApiError(
      "profile_markdown_mismatch",
      409,
      "Markdown이 현재 구조화 프로파일과 일치하지 않습니다.",
    );
  }

  const localReview = localProfilePrivacyReview(profile);
  if (localReview.status !== "clear") {
    throw new ApiError(
      "privacy_review_required",
      422,
      "개인정보 위험 표현을 수정하고 다시 점검해 주세요.",
      {
        details: {
          itemCount: localReview.items.length,
          items: localReview.items.map((item) => ({
            reason: item.reason,
            suggestedRewrite:
              "개인을 특정하는 내용을 제거하고 수업 지원 중심 표현으로 바꿔 주세요.",
          })),
        },
      },
    );
  }

  return { profile, profileMarkdown: expectedMarkdown };
}

export async function contributeProfile(input: SubmissionRequest) {
  const { profile, profileMarkdown } = validateContribution(input);
  const serverReview = await reviewProfileWithAI(profile);
  if (
    serverReview.source !== "openai" ||
    serverReview.review.status !== "clear"
  ) {
    throw new ApiError(
      "privacy_review_required",
      422,
      "개인정보 최종 검토를 통과하지 못했습니다. 내용을 수정한 뒤 다시 검토해 주세요.",
    );
  }

  const consentedAt = new Date();
  const retentionUntil = calculateRetentionUntil(consentedAt);
  const deletionToken = createDeletionToken();
  const deletionTokenHash = hashDeletionToken(deletionToken);

  const receipt = await insertSubmission({
    schema_version: profile.metadata.schemaVersion,
    prompt_version: profile.metadata.promptVersion,
    app_version: APP_VERSION,
    school_level: profile.metadata.schoolLevel,
    teacher_role: profile.metadata.role,
    profile_json: profile,
    profile_markdown: profileMarkdown,
    confirmed_tags: profile.confirmedTags,
    privacy_review: profile.privacyReview,
    model_name: profile.metadata.modelName,
    consent_version: getConsentVersion(),
    consented_at: consentedAt.toISOString(),
    retention_until: retentionUntil.toISOString(),
    deletion_token_hash: deletionTokenHash,
    source: "web",
  });

  return {
    submissionId: receipt.id,
    deletionToken,
    createdAt: receipt.createdAt,
    retentionUntil: receipt.retentionUntil,
  };
}
