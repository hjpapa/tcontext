import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { ApiError } from "@/lib/security/api-error";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  namespace: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  limit: number;
  remaining: number;
  resetAt: number;
};

const records = new Map<string, RateLimitRecord>();
const addressDigestKey = randomBytes(32);
let lastSweepAt = 0;

function normalizeAddress(value: string | null): string {
  if (!value) return "unknown";
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "unknown";
  return first.slice(0, 96);
}

function getRequestAddress(request: Request): string {
  return normalizeAddress(
    request.headers.get("x-vercel-forwarded-for") ??
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip"),
  );
}

function rateLimitKey(request: Request, namespace: string): string {
  const addressDigest = createHmac("sha256", addressDigestKey)
    .update(getRequestAddress(request), "utf8")
    .digest("base64url");
  return `${namespace}:${addressDigest}`;
}

function sweepExpired(now: number) {
  if (now - lastSweepAt < 60_000) return;
  lastSweepAt = now;
  for (const [key, record] of records) {
    if (record.resetAt <= now) records.delete(key);
  }
}

/**
 * Best-effort protection for a serverless process. Limits are deliberately
 * generous because many teachers can legitimately share one school NAT IP.
 * A distributed limiter can replace this without changing route contracts.
 */
export function consumeRateLimit(
  request: Request,
  options: RateLimitOptions,
  now = Date.now(),
): RateLimitResult {
  sweepExpired(now);
  const key = rateLimitKey(request, options.namespace);
  const current = records.get(key);
  const record =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + options.windowMs };

  record.count += 1;
  records.set(key, record);

  if (record.count > options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((record.resetAt - now) / 1000),
    );
    throw new ApiError(
      "rate_limit_exceeded",
      429,
      "요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요.",
      { retryAfterSeconds },
    );
  }

  return {
    limit: options.limit,
    remaining: Math.max(0, options.limit - record.count),
    resetAt: record.resetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult): Headers {
  return new Headers({
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  });
}

export function resetRateLimitsForTests() {
  records.clear();
  lastSweepAt = 0;
}
