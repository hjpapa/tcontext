import { NextResponse } from "next/server";

import { submissionDeleteRequestSchema } from "@/lib/ai/schemas/requests";
import {
  handleRouteError,
  ApiError,
  parseJsonBody,
  readJsonRequest,
} from "@/lib/security/api-error";
import {
  hashDeletionToken,
  verifyDeletionToken,
} from "@/lib/security/hash-token";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import {
  deleteSubmission,
  getDeletionTokenHash,
} from "@/lib/supabase/submissions";

export async function POST(request: Request) {
  try {
    const rateLimit = consumeRateLimit(request, {
      namespace: "submissions-delete",
      limit: 60,
      windowMs: 10 * 60_000,
    });
    const input = parseJsonBody(
      submissionDeleteRequestSchema.safeParse(await readJsonRequest(request)),
    );

    const storedHash = await getDeletionTokenHash(input.submissionId);
    if (!storedHash || !verifyDeletionToken(input.deletionToken, storedHash)) {
      throw new ApiError(
        "invalid_submission_or_token",
        404,
        "제출 ID 또는 삭제 코드가 올바르지 않습니다.",
      );
    }

    const deleted = await deleteSubmission(
      input.submissionId,
      hashDeletionToken(input.deletionToken),
    );
    if (!deleted) {
      throw new ApiError(
        "invalid_submission_or_token",
        404,
        "제출 ID 또는 삭제 코드가 올바르지 않습니다.",
      );
    }

    return NextResponse.json(
      { deleted: true },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
