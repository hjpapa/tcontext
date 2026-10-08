import { NextResponse } from "next/server";

import { generateProfile } from "@/lib/ai/profile";
import { profileGenerateRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

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

    const result = await generateProfile(input);
    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
