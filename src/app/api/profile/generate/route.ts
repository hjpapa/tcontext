import { NextResponse } from "next/server";

import { generateProfile } from "@/lib/ai/profile";
import { profileGenerateRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

// The profile caller enforces a shared 110s AI deadline, including retries and
// backoff. Leave 10s for request limiting, validation and response delivery.
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
