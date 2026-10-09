import { NextResponse } from "next/server";

import { refineProfile } from "@/lib/ai/profile";
import { profileRefineRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

// Worst case is two 45s OpenAI attempts (the second only after a truncated
// answer). Revisit with the p95 of `openai_request` durationMs logs for
// operation=profile_refine.
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const input = parseJsonBody(
      profileRefineRequestSchema.safeParse(await readJsonRequest(request)),
    );
    const rateLimit = await enforceRateLimit(request, "profile-refine");

    const profile = await refineProfile(input);
    return NextResponse.json(
      { profile },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
