import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/security/api-error";
import { secretsMatch } from "@/lib/security/secret";
import { purgeExpiredSubmissions } from "@/lib/supabase/submissions";

async function purge(request: Request) {
  try {
    const expected = process.env.CRON_SECRET?.trim();
    const authorization = request.headers.get("authorization");
    const provided = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

    if (!expected || expected.length < 32) {
      throw new ApiError(
        "configuration_error",
        503,
        "정리 작업 보안 설정이 완료되지 않았습니다.",
      );
    }
    if (!secretsMatch(provided, expected)) {
      throw new ApiError(
        "unauthorized",
        401,
        "정리 작업을 실행할 권한이 없습니다.",
      );
    }

    const deletedCount = await purgeExpiredSubmissions(new Date());
    return NextResponse.json(
      { ok: true, deletedCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export const GET = purge;
export const POST = purge;
