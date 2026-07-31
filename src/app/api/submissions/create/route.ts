import { NextResponse } from "next/server";

import { submissionCreateRequestSchema } from "@/lib/ai/schemas/requests";
import { contributeProfile } from "@/lib/consent/contribution";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const rateLimit = consumeRateLimit(request, {
      namespace: "submissions-create",
      limit: 60,
      windowMs: 10 * 60_000,
    });
    const input = parseJsonBody(
      submissionCreateRequestSchema.safeParse(await readJsonRequest(request)),
    );
    const receipt = await contributeProfile(input);
    return NextResponse.json(receipt, {
      status: 201,
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
