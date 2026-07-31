import { NextResponse } from "next/server";

import { decideFollowUp } from "@/lib/ai/follow-up";
import { followUpRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import {
  assertSafeForAI,
  collectTextFields,
} from "@/lib/security/privacy-guard";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { MAX_FOLLOW_UPS } from "@/types/interview";

export async function POST(request: Request) {
  try {
    const rateLimit = consumeRateLimit(request, {
      namespace: "interview-follow-up",
      limit: 120,
      windowMs: 10 * 60_000,
    });
    const input = parseJsonBody(
      followUpRequestSchema.safeParse(await readJsonRequest(request)),
    );

    assertSafeForAI(
      collectTextFields(
        {
          current: input.current,
          previousAnswers: input.previousAnswers,
        },
        "interview",
      ),
    );

    if (input.followUpCount >= MAX_FOLLOW_UPS) {
      return NextResponse.json(
        {
          needed: false,
          question: null,
          reason: "follow_up_limit_reached",
        },
        { headers: rateLimitHeaders(rateLimit) },
      );
    }

    const result = await decideFollowUp(input);
    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
