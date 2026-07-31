import { NextResponse } from "next/server";

import { refineProfile } from "@/lib/ai/profile";
import { profileRefineRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import {
  assertSafeForAI,
  collectProfilePrivacyTextFields,
  collectTextFields,
} from "@/lib/security/privacy-guard";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const rateLimit = consumeRateLimit(request, {
      namespace: "profile-refine",
      limit: 40,
      windowMs: 10 * 60_000,
    });
    const input = parseJsonBody(
      profileRefineRequestSchema.safeParse(await readJsonRequest(request)),
    );
    assertSafeForAI([
      ...collectProfilePrivacyTextFields(input.profile),
      ...collectTextFields(
        {
          instruction: input.instruction,
          moduleId: input.moduleId,
          editableClaimIds: input.editableClaimIds,
        },
        "refine.request",
      ),
    ]);

    const profile = await refineProfile(input);
    return NextResponse.json(
      { profile },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
