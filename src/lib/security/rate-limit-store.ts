import "server-only";

import { z } from "zod";

export type RateLimitTier = {
  /** Opaque store key. Holds only HMAC digests, never a raw address or tab ID. */
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitDecision =
  | { allowed: true; counts: number[] }
  | { allowed: false; blockedTier: number; retryAfterMs: number };

/**
 * Sliding-window log over several tiers at once. A request is recorded in
 * every tier or in none, so a request one tier rejects never uses up the
 * budget of another (an abusive tab cannot drain its network's allowance).
 */
export interface RateLimitStore {
  consume(
    tiers: readonly RateLimitTier[],
    now: number,
    member: string,
  ): Promise<RateLimitDecision>;
}

export class RateLimitStoreError extends Error {
  readonly reason: "http_error" | "invalid_response" | "request_failed";
  readonly status: number | null;

  constructor(
    reason: RateLimitStoreError["reason"],
    status: number | null = null,
    options: { cause?: unknown } = {},
  ) {
    super(`rate limit store ${reason}`, options);
    this.name = "RateLimitStoreError";
    this.reason = reason;
    this.status = status;
  }
}

type MemoryRecord = { windowMs: number; stamps: number[] };

export function createMemoryRateLimitStore(): RateLimitStore & {
  clear(): void;
} {
  const records = new Map<string, MemoryRecord>();
  let lastSweepAt = 0;

  const liveStamps = (tier: RateLimitTier, now: number): number[] => {
    const record = records.get(tier.key);
    if (!record) return [];
    const cutoff = now - tier.windowMs;
    const firstLive = record.stamps.findIndex((stamp) => stamp > cutoff);
    record.stamps.splice(
      0,
      firstLive === -1 ? record.stamps.length : firstLive,
    );
    return record.stamps;
  };

  const sweep = (now: number) => {
    if (now - lastSweepAt < 60_000) return;
    lastSweepAt = now;
    for (const [key, record] of records) {
      const newest = record.stamps.at(-1);
      if (newest === undefined || newest <= now - record.windowMs) {
        records.delete(key);
      }
    }
  };

  return {
    async consume(tiers, now) {
      sweep(now);
      const counts: number[] = [];
      for (const [index, tier] of tiers.entries()) {
        const stamps = liveStamps(tier, now);
        if (stamps.length >= tier.limit) {
          const releasing = stamps[stamps.length - tier.limit] ?? now;
          return {
            allowed: false,
            blockedTier: index,
            retryAfterMs: releasing + tier.windowMs - now,
          };
        }
        counts.push(stamps.length + 1);
      }
      for (const tier of tiers) {
        const record = records.get(tier.key) ?? {
          windowMs: tier.windowMs,
          stamps: [],
        };
        record.stamps.push(now);
        record.stamps.sort((left, right) => left - right);
        records.set(tier.key, record);
      }
      return { allowed: true, counts };
    },
    clear() {
      records.clear();
      lastSweepAt = 0;
    },
  };
}

/**
 * Same algorithm as the memory store, run atomically inside Redis.
 * KEYS[i] is one sorted set per tier; ARGV is now, member, then limit and
 * window (ms) for each tier. Each key expires one window after its newest
 * entry, so nothing outlives the window it counts.
 * Allowed: {1, 0, 0, count per tier...}. Rejected: {0, tier (1-based), retryAfterMs}.
 */
export const SLIDING_WINDOW_SCRIPT = `
local now = tonumber(ARGV[1])
local counts = {}
for i = 1, #KEYS do
  local limit = tonumber(ARGV[i * 2 + 1])
  local window = tonumber(ARGV[i * 2 + 2])
  redis.call("ZREMRANGEBYSCORE", KEYS[i], "-inf", now - window)
  local count = redis.call("ZCARD", KEYS[i])
  if count >= limit then
    local releasing = redis.call("ZRANGE", KEYS[i], count - limit, count - limit, "WITHSCORES")
    return {0, i, tonumber(releasing[2]) + window - now}
  end
  counts[i] = count + 1
end
local result = {1, 0, 0}
for i = 1, #KEYS do
  redis.call("ZADD", KEYS[i], ARGV[1], ARGV[2])
  redis.call("PEXPIRE", KEYS[i], ARGV[i * 2 + 2])
  result[i + 3] = counts[i]
end
return result
`;

const upstashResponseSchema = z.object({
  result: z.array(z.number().int()).min(3),
});

export function createUpstashRateLimitStore(options: {
  url: string;
  token: string;
  timeoutMs?: number;
}): RateLimitStore {
  const timeoutMs = options.timeoutMs ?? 800;

  return {
    async consume(tiers, now, member) {
      let response: Response;
      try {
        response = await fetch(options.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            "EVAL",
            SLIDING_WINDOW_SCRIPT,
            String(tiers.length),
            ...tiers.map((tier) => tier.key),
            String(now),
            member,
            ...tiers.flatMap((tier) => [
              String(tier.limit),
              String(tier.windowMs),
            ]),
          ]),
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new RateLimitStoreError("request_failed", null, {
          cause: error,
        });
      }
      if (!response.ok) {
        throw new RateLimitStoreError("http_error", response.status);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        throw new RateLimitStoreError("invalid_response", response.status, {
          cause: error,
        });
      }
      const parsed = upstashResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new RateLimitStoreError("invalid_response", response.status);
      }

      const [allowed, blockedTier = 0, retryAfterMs = 0, ...counts] =
        parsed.data.result;
      if (allowed === 1 && counts.length === tiers.length) {
        return { allowed: true, counts };
      }
      if (allowed === 0 && blockedTier >= 1 && blockedTier <= tiers.length) {
        return { allowed: false, blockedTier: blockedTier - 1, retryAfterMs };
      }
      throw new RateLimitStoreError("invalid_response", response.status);
    },
  };
}
