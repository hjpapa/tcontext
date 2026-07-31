import { runStructuredResponse } from "@/lib/ai/client";
import {
  OPENAI_MODELS,
  OPENAI_REASONING_EFFORT,
  OPENAI_TIMEOUT_MS,
} from "@/lib/ai/models";
import { PRIVACY_REVIEW_INSTRUCTIONS } from "@/lib/ai/prompts/privacy";
import { privacyReviewCandidatesOutputSchema } from "@/lib/ai/schemas/privacy";
import {
  collectProfileAuthoredTextFields,
  localAuthoredProfilePrivacyReview,
  type TextField,
} from "@/lib/security/privacy-guard";
import {
  privacyReviewSchema,
  type PrivacyReview,
  type TeacherContextProfile,
} from "@/types/profile";

function validatedPublicReview(
  fields: readonly TextField[],
  candidates: Awaited<ReturnType<typeof runPrivacyReviewCandidates>>["items"],
): PrivacyReview {
  const allowedTextByPath = new Map(
    fields.map((field) => [field.path, field.value] as const),
  );
  const candidatesByPath = new Map<string, typeof candidates>();

  for (const candidate of candidates) {
    if (allowedTextByPath.get(candidate.path) !== candidate.text) continue;

    const existing = candidatesByPath.get(candidate.path) ?? [];
    if (
      !existing.some(
        (item) =>
          item.category === candidate.category &&
          item.reason === candidate.reason &&
          item.suggestedRewrite === candidate.suggestedRewrite,
      )
    ) {
      existing.push(candidate);
      candidatesByPath.set(candidate.path, existing);
    }
  }

  const items: PrivacyReview["items"] = [];
  for (const [path, pathCandidates] of candidatesByPath) {
    const first = pathCandidates[0];
    const text = allowedTextByPath.get(path);
    if (!first || text === undefined) continue;

    items.push({
      text,
      reason: [...new Set(pathCandidates.map((item) => item.reason))].join(" "),
      suggestedRewrite: first.suggestedRewrite,
    });
  }

  return privacyReviewSchema.parse({
    status: items.length > 0 ? "needs_review" : "clear",
    items,
  });
}

async function runPrivacyReviewCandidates(fields: readonly TextField[]) {
  return runStructuredResponse({
    operation: "privacy_review",
    model: OPENAI_MODELS.privacy,
    effort: OPENAI_REASONING_EFFORT.privacy,
    instructions: PRIVACY_REVIEW_INSTRUCTIONS,
    input: JSON.stringify({
      fields: fields.map(({ path, value }) => ({ path, text: value })),
    }),
    schema: privacyReviewCandidatesOutputSchema,
    schemaName: "tcontext_privacy_review_candidates",
    maxOutputTokens: 2_000,
    timeoutMs: OPENAI_TIMEOUT_MS.privacy,
  });
}

export async function reviewProfileWithAI(
  profile: TeacherContextProfile,
): Promise<{ source: "local" | "openai"; review: PrivacyReview }> {
  const fields = collectProfileAuthoredTextFields(profile);
  const localReview = localAuthoredProfilePrivacyReview(profile);
  if (localReview.status === "needs_review") {
    return { source: "local", review: localReview };
  }

  const output = await runPrivacyReviewCandidates(fields);

  return {
    source: "openai",
    review: validatedPublicReview(fields, output.items),
  };
}
