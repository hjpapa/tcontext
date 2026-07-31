import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "invalid_request"
  | "payload_too_large"
  | "privacy_risk_detected"
  | "follow_up_limit_reached"
  | "rate_limit_exceeded"
  | "consent_required"
  | "consent_version_mismatch"
  | "privacy_review_required"
  | "unresolved_claims"
  | "profile_markdown_mismatch"
  | "profile_data_mismatch"
  | "invalid_submission_or_token"
  | "configuration_error"
  | "ai_timeout"
  | "ai_rate_limited"
  | "ai_unavailable"
  | "ai_invalid_response"
  | "database_unavailable"
  | "unauthorized"
  | "internal_error";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    options: {
      details?: unknown;
      retryAfterSeconds?: number;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

function zodIssueDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function handleRouteError(error: unknown): NextResponse {
  const normalized =
    error instanceof ApiError
      ? error
      : error instanceof ZodError
        ? new ApiError(
            "invalid_request",
            400,
            "요청 형식이 올바르지 않습니다.",
            { details: zodIssueDetails(error) },
          )
        : new ApiError("internal_error", 500, "요청을 처리하지 못했습니다.");

  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  if (normalized.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(normalized.retryAfterSeconds));
  }

  return NextResponse.json(
    {
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details === undefined
          ? {}
          : { details: normalized.details }),
      },
    },
    { status: normalized.status, headers },
  );
}

export function parseJsonBody<T>(
  result: { success: true; data: T } | { success: false; error: ZodError },
): T {
  if (!result.success) {
    throw new ApiError(
      "invalid_request",
      400,
      "요청 형식이 올바르지 않습니다.",
      { details: zodIssueDetails(result.error) },
    );
  }
  return result.data;
}

export async function readJsonRequest(request: Request): Promise<unknown> {
  const maxBytes = 512 * 1024;
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(
      "payload_too_large",
      413,
      "요청 본문이 허용된 크기를 초과했습니다.",
    );
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new ApiError(
        "payload_too_large",
        413,
        "요청 본문이 허용된 크기를 초과했습니다.",
      );
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "invalid_request",
      400,
      "JSON 요청 본문이 올바르지 않습니다.",
    );
  }
}
