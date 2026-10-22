import { NextResponse } from "next/server";

import { refineProfile } from "@/lib/ai/profile";
import { profileRefineRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

// Generation and refinement share the same 110s AI deadline, including the
// optional truncation retry, leaving 10s for other route work.
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
