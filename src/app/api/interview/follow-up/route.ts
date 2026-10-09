import { NextResponse } from "next/server";

import { decideFollowUp } from "@/lib/ai/follow-up";
import { followUpRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { MAX_FOLLOW_UPS } from "@/types/interview";

export async function POST(request: Request) {
  try {
    const input = parseJsonBody(
      followUpRequestSchema.safeParse(await readJsonRequest(request)),
    );

    // Answered without OpenAI, so it does not count toward any limit.
    if (input.followUpCount >= MAX_FOLLOW_UPS) {
      return NextResponse.json({
        needed: false,
        question: null,
        reason: "follow_up_limit_reached",
      });
    }

    const rateLimit = await enforceRateLimit(request, "interview-follow-up");
    const result = await decideFollowUp(input);
    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
