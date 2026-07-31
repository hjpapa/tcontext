import { NextResponse } from "next/server";

import { reviewProfileWithAI } from "@/lib/ai/privacy";
import { privacyReviewRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const rateLimit = consumeRateLimit(request, {
      namespace: "privacy-review",
      limit: 50,
      windowMs: 10 * 60_000,
    });
    const input = parseJsonBody(
      privacyReviewRequestSchema.safeParse(await readJsonRequest(request)),
    );

    const result = await reviewProfileWithAI(input.profile);
    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
