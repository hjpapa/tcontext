import { NextResponse } from "next/server";

import { submissionCreateRequestSchema } from "@/lib/ai/schemas/requests";
import { contributeProfile } from "@/lib/consent/contribution";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const input = parseJsonBody(
      submissionCreateRequestSchema.safeParse(await readJsonRequest(request)),
    );
    const rateLimit = await enforceRateLimit(request, "submissions-create");
    const receipt = await contributeProfile(input);
    return NextResponse.json(receipt, {
      status: 201,
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
