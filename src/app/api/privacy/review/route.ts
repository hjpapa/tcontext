import { NextResponse } from "next/server";

import { reviewProfileWithAI } from "@/lib/ai/privacy";
import { privacyReviewRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import {
  isPrivacyReviewSigningConfigured,
  issuePrivacyReviewToken,
} from "@/lib/security/privacy-review-token";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

// Worst case is two 25s OpenAI attempts (the second only after a truncated
// answer). Revisit with the p95 of `openai_request` durationMs logs for
// operation=privacy_review.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const input = parseJsonBody(
      privacyReviewRequestSchema.safeParse(await readJsonRequest(request)),
    );
    const rateLimit = await enforceRateLimit(request, "privacy-review");

    const result = await reviewProfileWithAI(input.profile);
    // Contribution trusts this signed verdict instead of asking OpenAI again,
    // so only a clear review that OpenAI produced is ever signed.
    const reviewToken =
      result.source === "openai" &&
      result.review.status === "clear" &&
      isPrivacyReviewSigningConfigured()
        ? issuePrivacyReviewToken({
            ...input.profile,
            privacyReview: result.review,
          })
        : undefined;
    return NextResponse.json(
      reviewToken === undefined ? result : { ...result, reviewToken },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
