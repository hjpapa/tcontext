import { NextResponse } from "next/server";

import { generateProfile } from "@/lib/ai/profile";
import { profileGenerateRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

// At most two 45s OpenAI attempts in total, including transient/truncation
// retries, plus up to 15s of provider-directed backoff. Revisit with the p95 of
// `openai_request` durationMs logs for operation=profile_generate.
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const input = parseJsonBody(
      profileGenerateRequestSchema.safeParse(await readJsonRequest(request)),
    );
    const rateLimit = await enforceRateLimit(request, "profile-generate");

    const result = await generateProfile(input);
    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
