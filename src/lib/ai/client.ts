import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ReasoningEffort } from "openai/resources/shared";
import { z } from "zod";

import { formatRetryAfter } from "@/lib/http/retry-after";
import { ApiError } from "@/lib/security/api-error";

let client: OpenAI | undefined;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiError(
      "configuration_error",
      503,
      "AI 서비스 설정이 완료되지 않았습니다.",
    );
  }
  client ??= new OpenAI({
    apiKey,
    maxRetries: 0,
  });
  return client;
}

type StructuredResponseOptions<Schema extends z.ZodType> = {
  operation:
    "follow_up" | "profile_generate" | "profile_refine" | "privacy_review";
  model: string;
  effort: Exclude<ReasoningEffort, null>;
  instructions: string;
  input: string;
  schema: Schema;
  schemaName: string;
  maxOutputTokens: number;
  retryMaxOutputTokens?: number;
  missingParsedFallback?: z.input<Schema>;
  /**
   * Retries once after a short jittered pause when OpenAI answers 429 or 5xx
   * or drops the connection. Timeouts are not retried to avoid repeating
   * expensive work after an already long wait.
   */
  retryTransientErrorOnce?: boolean;
  timeoutMs: number;
  /** Shared deadline across provider calls and retry backoff. */
  totalTimeoutMs?: number;
};

const TRANSIENT_RETRY_BASE_DELAY_MS = 400;
const TRANSIENT_RETRY_JITTER_MS = 800;
// Provider-directed waits are also charged to the caller's total deadline.
const MAX_TRANSIENT_RETRY_DELAY_MS = 15_000;
const MAX_PROVIDER_ATTEMPTS = 2;

type SafeUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type SafeResponseDetails = {
  status: string | null;
  reason: string | null;
  usage: SafeUsage;
};

function usageOf(response: {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
}): SafeUsage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };
}

function responseDetailsOf(response: {
  status?: string | null;
  incomplete_details?: { reason?: string | null } | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
}): SafeResponseDetails {
  return {
    status: response.status ?? null,
    reason: response.incomplete_details?.reason ?? null,
    usage: usageOf(response),
  };
}

function logSuccess(
  options: StructuredResponseOptions<z.ZodType>,
  startedAt: number,
  response: SafeResponseDetails,
  attempt: number,
) {
  console.info("openai_request", {
    operation: options.operation,
    model: options.model,
    durationMs: Date.now() - startedAt,
    attempt,
    response,
    success: true,
  });
}

function logRetry(
  options: StructuredResponseOptions<z.ZodType>,
  startedAt: number,
  response: SafeResponseDetails,
) {
  console.warn("openai_request_retry", {
    operation: options.operation,
    model: options.model,
    durationMs: Date.now() - startedAt,
    attempt: 1,
    nextMaxOutputTokens: options.retryMaxOutputTokens,
    response,
  });
}

function logTransientRetry(
  options: StructuredResponseOptions<z.ZodType>,
  startedAt: number,
  error: unknown,
  delayMs: number,
) {
  console.warn("openai_request_transient_retry", {
    operation: options.operation,
    model: options.model,
    durationMs: Date.now() - startedAt,
    errorType: error instanceof Error ? error.constructor.name : "UnknownError",
    status: error instanceof OpenAI.APIError ? (error.status ?? null) : null,
    delayMs,
  });
}

function logFallback(
  options: StructuredResponseOptions<z.ZodType>,
  startedAt: number,
  response: SafeResponseDetails,
  attempt: number,
) {
  console.warn("openai_request_fallback", {
    operation: options.operation,
    model: options.model,
    durationMs: Date.now() - startedAt,
    attempt,
    response,
  });
}

function logFailure(
  options: StructuredResponseOptions<z.ZodType>,
  startedAt: number,
  error: unknown,
  response?: SafeResponseDetails,
) {
  console.warn("openai_request", {
    operation: options.operation,
    model: options.model,
    durationMs: Date.now() - startedAt,
    errorType: error instanceof Error ? error.constructor.name : "UnknownError",
    ...(response ? { response } : {}),
    success: false,
  });
}

function isTransientOpenAIError(error: unknown): boolean {
  if (error instanceof OpenAI.APIConnectionTimeoutError) return false;
  if (error instanceof OpenAI.APIConnectionError) return true;
  if (!(error instanceof OpenAI.APIError)) return false;
  // An exhausted quota stays exhausted; retrying only adds latency.
  if (error.status === 429) return error.code !== "insufficient_quota";
  return typeof error.status === "number" && error.status >= 500;
}

function providerRetryAfterMs(error: unknown): number | undefined {
  if (!(error instanceof OpenAI.APIError)) return undefined;
  const milliseconds = error.headers?.get("retry-after-ms");
  if (milliseconds?.trim()) {
    const value = Number(milliseconds);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  const header = error.headers?.get("retry-after")?.trim();
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  // A negative numeric header is invalid, not an HTTP date.
  if (Number.isFinite(seconds)) return undefined;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function transientRetryDelayMs(error: unknown): number | undefined {
  const requested = providerRetryAfterMs(error);
  // Never retry earlier than the provider allows. Long waits belong in the
  // response to the teacher, rather than running past the function deadline.
  if (requested !== undefined && requested > MAX_TRANSIENT_RETRY_DELAY_MS) {
    return undefined;
  }
  return Math.min(
    MAX_TRANSIENT_RETRY_DELAY_MS,
    (requested ?? TRANSIENT_RETRY_BASE_DELAY_MS) +
      Math.floor(Math.random() * TRANSIENT_RETRY_JITTER_MS),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapOpenAIError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new ApiError(
      "ai_timeout",
      504,
      "AI 응답 시간이 초과되었습니다. 다시 시도해 주세요.",
      { cause: error },
    );
  }

  if (
    error instanceof OpenAI.RateLimitError ||
    (error instanceof OpenAI.APIError && error.status === 429)
  ) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((providerRetryAfterMs(error) ?? 10_000) / 1_000),
    );
    return new ApiError(
      "ai_rate_limited",
      503,
      `AI 서비스 요청이 잠시 많습니다. ${formatRetryAfter(retryAfterSeconds)} 뒤 다시 시도해 주세요. 답변은 이 탭에 그대로 있습니다.`,
      { cause: error, retryAfterSeconds, details: { retryAfterSeconds } },
    );
  }

  if (
    error instanceof OpenAI.AuthenticationError ||
    error instanceof OpenAI.PermissionDeniedError
  ) {
    return new ApiError(
      "configuration_error",
      503,
      "AI 서비스 연결 설정을 확인해 주세요.",
      { cause: error },
    );
  }

  if (
    error instanceof OpenAI.APIConnectionError ||
    (error instanceof OpenAI.APIError &&
      typeof error.status === "number" &&
      error.status >= 500)
  ) {
    return new ApiError(
      "ai_unavailable",
      503,
      "AI 서비스에 일시적으로 연결할 수 없습니다.",
      { cause: error },
    );
  }

  if (error instanceof OpenAI.APIError) {
    return new ApiError(
      "ai_unavailable",
      502,
      "AI 요청을 처리하지 못했습니다.",
      { cause: error },
    );
  }

  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return new ApiError(
      "ai_invalid_response",
      502,
      "AI 응답 형식을 검증하지 못했습니다. 다시 시도해 주세요.",
      { cause: error },
    );
  }

  return new ApiError("ai_unavailable", 502, "AI 요청을 처리하지 못했습니다.", {
    cause: error,
  });
}

export async function runStructuredResponse<Schema extends z.ZodType>(
  options: StructuredResponseOptions<Schema>,
): Promise<z.output<Schema>> {
  const startedAt = Date.now();
  let lastResponseDetails: SafeResponseDetails | undefined;
  let transientRetryAvailable = options.retryTransientErrorOnce === true;
  let providerAttempts = 0;
  const remainingMs = () =>
    options.totalTimeoutMs === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, options.totalTimeoutMs - (Date.now() - startedAt));

  const parseResponse = async (maxOutputTokens: number) => {
    const request = () => {
      const timeout = Math.min(options.timeoutMs, remainingMs());
      if (timeout <= 0) throw new OpenAI.APIConnectionTimeoutError();
      providerAttempts += 1;
      return getOpenAIClient().responses.parse(
        {
          model: options.model,
          instructions: options.instructions,
          input: options.input,
          text: {
            format: zodTextFormat(options.schema, options.schemaName),
          },
          reasoning: { effort: options.effort },
          max_output_tokens: maxOutputTokens,
          store: false,
        },
        {
          maxRetries: 0,
          timeout,
        },
      );
    };

    try {
      return await request();
    } catch (error) {
      if (
        !transientRetryAvailable ||
        providerAttempts >= MAX_PROVIDER_ATTEMPTS ||
        !isTransientOpenAIError(error)
      ) {
        throw error;
      }
      transientRetryAvailable = false;
      const delayMs = transientRetryDelayMs(error);
      if (delayMs === undefined) throw error;
      // Return the provider's actionable error when its wait would consume the
      // remaining deadline; never retry early or start a call after the budget.
      if (delayMs >= remainingMs()) throw error;
      logTransientRetry(options, startedAt, error, delayMs);
      await sleep(delayMs);
      return request();
    }
  };

  try {
    const outputTokenLimits = [
      options.maxOutputTokens,
      ...(options.retryMaxOutputTokens === undefined
        ? []
        : [options.retryMaxOutputTokens]),
    ];

    for (const [attemptIndex, maxOutputTokens] of outputTokenLimits.entries()) {
      lastResponseDetails = undefined;
      const response = await parseResponse(maxOutputTokens);

      lastResponseDetails = responseDetailsOf(response);
      if (response.output_parsed !== null) {
        // Structured Outputs constrains generation; this second parse protects
        // the application boundary even if a provider or SDK regression occurs.
        const parsed = options.schema.parse(response.output_parsed);
        logSuccess(options, startedAt, lastResponseDetails, attemptIndex + 1);
        return parsed;
      }

      const shouldRetry =
        attemptIndex === 0 &&
        providerAttempts < MAX_PROVIDER_ATTEMPTS &&
        options.retryMaxOutputTokens !== undefined &&
        lastResponseDetails.reason === "max_output_tokens";
      if (shouldRetry) {
        logRetry(options, startedAt, lastResponseDetails);
        continue;
      }

      if (options.missingParsedFallback !== undefined) {
        const fallback = options.schema.parse(options.missingParsedFallback);
        logFallback(options, startedAt, lastResponseDetails, attemptIndex + 1);
        return fallback;
      }

      throw new ApiError(
        "ai_invalid_response",
        502,
        "AI가 검증 가능한 응답을 생성하지 못했습니다.",
      );
    }

    throw new ApiError(
      "ai_invalid_response",
      502,
      "AI가 검증 가능한 응답을 생성하지 못했습니다.",
    );
  } catch (error) {
    logFailure(options, startedAt, error, lastResponseDetails);
    throw mapOpenAIError(error);
  }
}

export function resetOpenAIClientForTests() {
  client = undefined;
}

export function setOpenAIClientForTests(value: OpenAI) {
  client = value;
}
