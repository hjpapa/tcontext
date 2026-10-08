import { NextResponse } from "next/server";

import { generateProfile } from "@/lib/ai/profile";
import { profileGenerateRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import {
  assertSafeForAI,
  collectInterviewAnswerFields,
} from "@/lib/security/privacy-guard";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

// Worst case is a jittered 429/5xx retry plus two 45s OpenAI attempts (the
// second only after a truncated answer). Revisit with the p95 of
// `openai_request` durationMs logs for operation=profile_generate.
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const rateLimit = consumeRateLimit(request, {
      namespace: "profile-generate",
      limit: 40,
      windowMs: 10 * 60_000,
    });
    const input = parseJsonBody(
      profileGenerateRequestSchema.safeParse(await readJsonRequest(request)),
    );
    assertSafeForAI(collectInterviewAnswerFields(input.answers, "answers"));

    const result = await generateProfile(input);
    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
