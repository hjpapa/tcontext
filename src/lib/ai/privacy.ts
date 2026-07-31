import { runStructuredResponse } from "@/lib/ai/client";
import {
  OPENAI_MODELS,
  OPENAI_REASONING_EFFORT,
  OPENAI_TIMEOUT_MS,
} from "@/lib/ai/models";
import { PRIVACY_REVIEW_INSTRUCTIONS } from "@/lib/ai/prompts/privacy";
import { localProfilePrivacyReview } from "@/lib/security/privacy-guard";
import {
  privacyReviewOutputSchema,
  privacyReviewSchema,
  type PrivacyReview,
  type TeacherContextProfile,
} from "@/types/profile";

export async function reviewProfileWithAI(
  profile: TeacherContextProfile,
): Promise<{ source: "local" | "openai"; review: PrivacyReview }> {
  const localReview = localProfilePrivacyReview(profile);
  if (localReview.status === "needs_review") {
    return { source: "local", review: localReview };
  }

  const output = await runStructuredResponse({
    operation: "privacy_review",
    model: OPENAI_MODELS.privacy,
    effort: OPENAI_REASONING_EFFORT.privacy,
    instructions: PRIVACY_REVIEW_INSTRUCTIONS,
    input: JSON.stringify({
      profile,
    }),
    schema: privacyReviewOutputSchema,
    schemaName: "tcontext_privacy_review",
    maxOutputTokens: 2_000,
    timeoutMs: OPENAI_TIMEOUT_MS.privacy,
  });

  return {
    source: "openai",
    review: privacyReviewSchema.parse(output),
  };
}
