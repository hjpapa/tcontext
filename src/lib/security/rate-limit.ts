import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { z } from "zod";

import { formatRetryAfter } from "@/lib/http/retry-after";
import { TAB_ID_HEADER, TAB_ID_PATTERN } from "@/lib/http/tab-id";
import { ApiError } from "@/lib/security/api-error";
import {
  createMemoryRateLimitStore,
  createUpstashRateLimitStore,
  RateLimitStoreError,
  type RateLimitDecision,
  type RateLimitStore,
  type RateLimitTier,
} from "@/lib/security/rate-limit-store";

const WINDOW_MS = 10 * 60_000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const SEOUL_OFFSET_MS = 9 * 60 * MINUTE_MS;
const SHARED_STORE_RETRY_MS = 30_000;
const MIN_SECRET_LENGTH = 32;

const RATE_LIMIT_DEFAULTS = {
  teachersPerNetwork: 100,
  aiRequestsPerMinute: 300,
  aiRequestsPerDay: 7_500,
} as const;

type RateLimitPolicy = {
  /** Requests one browser tab may make per window. */
  tab?: number;
  /**
   * A shared school network gets the requests one teacher normally makes per
   * window times RATE_LIMIT_TEACHERS_PER_NETWORK, unless the limit is fixed.
   */
  network: { perTeacher: number } | { fixed: number };
  /** Also counts toward the service-wide OpenAI request caps. */
  usesAI?: true;
};

const RATE_LIMIT_POLICIES = {
  "interview-follow-up": {
    tab: 40,
    network: { perTeacher: 12 },
    usesAI: true,
  },
  "profile-generate": { tab: 10, network: { perTeacher: 2 }, usesAI: true },
  "profile-refine": { tab: 30, network: { perTeacher: 6 }, usesAI: true },
  "privacy-review": { tab: 20, network: { perTeacher: 3 }, usesAI: true },
  "submissions-create": { tab: 10, network: { perTeacher: 2 } },
  "submissions-delete": { tab: 20, network: { perTeacher: 2 } },
  "admin-login": { network: { fixed: 5 } },
} satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

type TierScope = "tab" | "network" | "ai-minute" | "ai-day";

type RateLimitResult = {
  limit: number;
  remaining: number;
  resetAt: number;
};

const memoryStore = createMemoryRateLimitStore();
const processSecret = randomBytes(32).toString("base64url");
let sharedStore: { signature: string; store: RateLimitStore } | undefined;
let sharedStoreRetryAt = 0;
const lastWarningAt = new Map<string, number>();

function warnAtMostEveryMinute(
  event: string,
  details: Record<string, string | number | null>,
  now: number,
) {
  const last = lastWarningAt.get(event);
  if (last !== undefined && now - last < MINUTE_MS) return;
  lastWarningAt.set(event, now);
  console.warn(event, details);
}

const positiveIntSchema = z.coerce.number().int().min(1);

function readPositiveInt(name: string, fallback: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = positiveIntSchema.max(max).safeParse(raw);
  if (parsed.success) return parsed.data;
  warnAtMostEveryMinute(
    "rate_limit_invalid_config",
    { variable: name },
    Date.now(),
  );
  return fallback;
}

function readSecret(): string | undefined {
  const secret = process.env.RATE_LIMIT_SECRET?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : undefined;
}

const restUrlSchema = z.url({ protocol: /^https$/ });

function readSharedStoreConfig(): { url: string; token: string } | undefined {
  // The Vercel Marketplace integration may inject the KV_REST_API_* names.
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token || !restUrlSchema.safeParse(url).success) return undefined;
  return { url, token };
}

/** Shared counting needs both the store and the secret that keys it. */
export function isSharedRateLimitConfigured(): boolean {
  return readSharedStoreConfig() !== undefined && readSecret() !== undefined;
}

function activeSharedStore(now: number): RateLimitStore | undefined {
  const config = readSharedStoreConfig();
  if (!config) return undefined;
  if (!readSecret()) {
    warnAtMostEveryMinute(
      "rate_limit_shared_store_disabled",
      { reason: "missing_secret" },
      now,
    );
    return undefined;
  }
  if (now < sharedStoreRetryAt) return undefined;
  const signature = `${config.url}\n${config.token}`;
  if (sharedStore?.signature !== signature) {
    sharedStore = { signature, store: createUpstashRateLimitStore(config) };
  }
  return sharedStore.store;
}

function seoulDate(now: number): string {
  return new Date(now + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Store keys hold only an HMAC under a key that changes every day (Seoul
 * time), so a stored digest cannot be matched to an address or linked to
 * the same network on another day.
 */
function keyDigest(kind: "net" | "tab", value: string, now: number): string {
  const dailyKey = createHmac("sha256", readSecret() ?? processSecret)
    .update(`tcontext:rate-limit:v1:${seoulDate(now)}`, "utf8")
    .digest();
  return createHmac("sha256", dailyKey)
    .update(`${kind}:${value}`, "utf8")
    .digest("base64url")
    .slice(0, 32);
}

const ipv6GroupPattern = /^[0-9a-f]{1,4}$/;

/** One home or school usually holds a whole IPv6 /64, so count it as one network. */
function ipv6Network(address: string): string | undefined {
  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (mappedIpv4?.[1]) return mappedIpv4[1];

  const halves = address.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const gap = 8 - head.length - tail.length;
  if (halves.length === 1 ? gap !== 0 : gap < 1) return undefined;
  const groups = [...head, ...Array<string>(gap).fill("0"), ...tail];
  if (!groups.every((group) => ipv6GroupPattern.test(group))) return undefined;
  return `${groups
    .slice(0, 4)
    .map((group) => group.padStart(4, "0"))
    .join(":")}::/64`;
}

function requestNetwork(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");
  const address = forwarded?.split(",")[0]?.trim().toLowerCase();
  if (!address) return "unknown";
  return (
    (address.includes(":") ? ipv6Network(address) : undefined) ??
    address.slice(0, 96)
  );
}

const tabIdSchema = z.string().regex(TAB_ID_PATTERN);

function requestTabId(request: Request): string | undefined {
  const parsed = tabIdSchema.safeParse(request.headers.get(TAB_ID_HEADER));
  return parsed.success ? parsed.data : undefined;
}

function policyTiers(
  request: Request,
  policyName: RateLimitPolicyName,
  now: number,
): { tiers: RateLimitTier[]; scopes: TierScope[] } {
  const policy: RateLimitPolicy = RATE_LIMIT_POLICIES[policyName];
  const tiers: RateLimitTier[] = [];
  const scopes: TierScope[] = [];

  const tabId = requestTabId(request);
  // A request without a tab ID (an older page, or a client that omits it)
  // still counts toward its network and the service-wide caps.
  if (policy.tab !== undefined && tabId) {
    tiers.push({
      key: `tc:rl:v1:${policyName}:tab:${keyDigest("tab", tabId, now)}`,
      limit: policy.tab,
      windowMs: WINDOW_MS,
    });
    scopes.push("tab");
  }

  const networkLimit =
    "fixed" in policy.network
      ? policy.network.fixed
      : policy.network.perTeacher *
        readPositiveInt(
          "RATE_LIMIT_TEACHERS_PER_NETWORK",
          RATE_LIMIT_DEFAULTS.teachersPerNetwork,
          5_000,
        );
  tiers.push({
    key: `tc:rl:v1:${policyName}:net:${keyDigest("net", requestNetwork(request), now)}`,
    limit: networkLimit,
    windowMs: WINDOW_MS,
  });
  scopes.push("network");

  if (policy.usesAI) {
    tiers.push(
      {
        key: "tc:rl:v1:ai:minute",
        limit: readPositiveInt(
          "RATE_LIMIT_AI_PER_MINUTE",
          RATE_LIMIT_DEFAULTS.aiRequestsPerMinute,
          100_000,
        ),
        windowMs: MINUTE_MS,
      },
      {
        key: "tc:rl:v1:ai:day",
        limit: readPositiveInt(
          "RATE_LIMIT_AI_PER_DAY",
          RATE_LIMIT_DEFAULTS.aiRequestsPerDay,
          1_000_000,
        ),
        windowMs: DAY_MS,
      },
    );
    scopes.push("ai-minute", "ai-day");
  }

  return { tiers, scopes };
}

function rateLimitError(
  policyName: RateLimitPolicyName,
  scope: TierScope,
  retryAfterMs: number,
  now: number,
): ApiError {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const wait = formatRetryAfter(retryAfterSeconds);
  const message = {
    tab: `요청이 짧은 시간에 많이 반복되었습니다. ${wait} 뒤 다시 시도해 주세요.`,
    network: `같은 네트워크에서 요청이 많습니다. ${wait} 뒤 다시 시도해 주세요.`,
    "ai-minute": `지금 AI 요청이 몰려 있습니다. ${wait} 뒤 다시 시도해 주세요.`,
    "ai-day": `오늘 서비스의 AI 사용 한도에 도달했습니다. ${wait} 뒤 다시 시도해 주세요.`,
  }[scope];
  if (scope === "ai-minute" || scope === "ai-day") {
    warnAtMostEveryMinute(
      "rate_limit_service_cap_reached",
      { policy: policyName, window: scope === "ai-day" ? "day" : "minute" },
      now,
    );
  }
  return new ApiError("rate_limit_exceeded", 429, message, {
    retryAfterSeconds,
    details: {
      retryAfterSeconds,
      scope: scope === "tab" || scope === "network" ? scope : "service",
    },
  });
}

/**
 * Counts one request against its tab, its network and, for OpenAI routes,
 * the service-wide caps, shared across instances through Upstash Redis.
 * When the shared store is missing or failing, each instance counts in
 * memory instead so a store outage never takes the service down.
 * Call it after the request body validates so malformed requests are free.
 */
export async function enforceRateLimit(
  request: Request,
  policyName: RateLimitPolicyName,
  now = Date.now(),
): Promise<RateLimitResult> {
  const { tiers, scopes } = policyTiers(request, policyName, now);
  const member = `${now}-${randomBytes(8).toString("hex")}`;

  const shared = activeSharedStore(now);
  let decision: RateLimitDecision | undefined;
  if (shared) {
    try {
      decision = await shared.consume(tiers, now, member);
    } catch (error) {
      sharedStoreRetryAt = now + SHARED_STORE_RETRY_MS;
      console.warn("rate_limit_store_fallback", {
        store: "upstash",
        reason:
          error instanceof RateLimitStoreError ? error.reason : "unexpected",
        status: error instanceof RateLimitStoreError ? error.status : null,
        retryInMs: SHARED_STORE_RETRY_MS,
      });
    }
  }
  decision ??= await memoryStore.consume(tiers, now, member);

  if (!decision.allowed) {
    throw rateLimitError(
      policyName,
      scopes[decision.blockedTier] ?? "network",
      decision.retryAfterMs,
      now,
    );
  }

  // Report whichever tier is closest to its limit.
  const { counts } = decision;
  const tightest = tiers
    .map((tier, index) => ({
      tier,
      remaining: Math.max(0, tier.limit - (counts[index] ?? tier.limit)),
    }))
    .reduce((left, right) => (right.remaining < left.remaining ? right : left));
  return {
    limit: tightest.tier.limit,
    remaining: tightest.remaining,
    resetAt: now + tightest.tier.windowMs,
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
  memoryStore.clear();
  sharedStore = undefined;
  sharedStoreRetryAt = 0;
  lastWarningAt.clear();
}
