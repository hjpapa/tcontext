// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TAB_ID_HEADER } from "@/lib/http/tab-id";
import {
  enforceRateLimit,
  isSharedRateLimitConfigured,
  resetRateLimitsForTests,
  type RateLimitPolicyName,
} from "@/lib/security/rate-limit";
import {
  createMemoryRateLimitStore,
  createUpstashRateLimitStore,
  type RateLimitTier,
} from "@/lib/security/rate-limit-store";
import { createFakeUpstash } from "@/lib/security/testing/fake-upstash";

const SCHOOL_NETWORK = "203.0.113.10";
const OTHER_NETWORK = "198.51.100.7";
const UPSTASH_URL = "https://fake-upstash.test";
const UPSTASH_TOKEN = "fake-upstash-token";
// 10:00 on 2026-10-09 in Seoul.
const T0 = Date.UTC(2026, 9, 9, 1, 0, 0);

const ENV_NAMES = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "RATE_LIMIT_SECRET",
  "RATE_LIMIT_TEACHERS_PER_NETWORK",
  "RATE_LIMIT_AI_PER_MINUTE",
  "RATE_LIMIT_AI_PER_DAY",
] as const;

function tabId(index: number): string {
  return (index + 1).toString(16).padStart(32, "a");
}

function request(network: string = SCHOOL_NETWORK, tab?: string): Request {
  return new Request("https://tcontext.test/api", {
    method: "POST",
    headers: {
      "x-forwarded-for": network,
      ...(tab ? { [TAB_ID_HEADER]: tab } : {}),
    },
  });
}

function limited(scope: "tab" | "network" | "service") {
  return expect.objectContaining({
    status: 429,
    code: "rate_limit_exceeded",
    details: expect.objectContaining({ scope }),
  });
}

let fake: ReturnType<typeof createFakeUpstash>;

function useSharedStore() {
  process.env.UPSTASH_REDIS_REST_URL = UPSTASH_URL;
  process.env.UPSTASH_REDIS_REST_TOKEN = UPSTASH_TOKEN;
  process.env.RATE_LIMIT_SECRET = "s".repeat(48);
}

const savedEnv = Object.fromEntries(
  ENV_NAMES.map((name) => [name, process.env[name]]),
);

beforeEach(() => {
  for (const name of ENV_NAMES) delete process.env[name];
  resetRateLimitsForTests();
  fake = createFakeUpstash(UPSTASH_TOKEN);
  vi.stubGlobal("fetch", vi.fn(fake.fetch));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const name of ENV_NAMES) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

const storeSetups: ReadonlyArray<[label: string, configure: () => void]> = [
  ["per-instance memory", () => undefined],
  ["shared Upstash store", useSharedStore],
];

describe.each(storeSetups)("request limits with %s", (_label, configure) => {
  beforeEach(() => configure());

  it("lets 30 teachers on one school network finish a full interview", async () => {
    // One teacher's whole session: every OpenAI call plus contribution and
    // deletion, all inside one 10-minute window.
    const session: RateLimitPolicyName[] = [
      ...Array<RateLimitPolicyName>(14).fill("interview-follow-up"),
      "profile-generate",
      ...Array<RateLimitPolicyName>(5).fill("profile-refine"),
      "privacy-review",
      "privacy-review",
      "submissions-create",
      "submissions-delete",
    ];
    const outcomes: string[] = [];
    for (const [step, policy] of session.entries()) {
      for (let teacher = 0; teacher < 30; teacher += 1) {
        await enforceRateLimit(
          request(SCHOOL_NETWORK, tabId(teacher)),
          policy,
          T0 + step * 20_000 + teacher * 200,
        ).then(
          () => outcomes.push("ok"),
          (error: { code?: string }) => outcomes.push(error.code ?? "error"),
        );
      }
    }
    expect(outcomes).toHaveLength(30 * session.length);
    expect(outcomes.every((outcome) => outcome === "ok")).toBe(true);
  });

  it("stops one looping tab while colleagues on the network keep working", async () => {
    for (let index = 0; index < 40; index += 1) {
      await enforceRateLimit(
        request(SCHOOL_NETWORK, tabId(0)),
        "interview-follow-up",
        T0 + index,
      );
    }
    await expect(
      enforceRateLimit(
        request(SCHOOL_NETWORK, tabId(0)),
        "interview-follow-up",
        T0 + 40,
      ),
    ).rejects.toEqual(limited("tab"));
    await expect(
      enforceRateLimit(
        request(SCHOOL_NETWORK, tabId(1)),
        "interview-follow-up",
        T0 + 41,
      ),
    ).resolves.toMatchObject({ remaining: 39 });
  });

  it("does not let a tab's rejected requests use up its network's allowance", async () => {
    process.env.RATE_LIMIT_TEACHERS_PER_NETWORK = "4"; // network limit 48
    for (let index = 0; index < 100; index += 1) {
      await enforceRateLimit(
        request(SCHOOL_NETWORK, tabId(0)),
        "interview-follow-up",
        T0 + index,
      ).catch(() => undefined);
    }
    for (let index = 0; index < 8; index += 1) {
      await enforceRateLimit(
        request(SCHOOL_NETWORK, tabId(1 + index)),
        "interview-follow-up",
        T0 + 200 + index,
      );
    }
    await expect(
      enforceRateLimit(
        request(SCHOOL_NETWORK, tabId(20)),
        "interview-follow-up",
        T0 + 300,
      ),
    ).rejects.toEqual(limited("network"));
  });

  it("bounds a client that invents a new tab ID for every request", async () => {
    process.env.RATE_LIMIT_TEACHERS_PER_NETWORK = "2"; // network limit 24
    for (let index = 0; index < 24; index += 1) {
      await enforceRateLimit(
        request(SCHOOL_NETWORK, tabId(index)),
        "interview-follow-up",
        T0 + index,
      );
    }
    await expect(
      enforceRateLimit(
        request(SCHOOL_NETWORK, tabId(99)),
        "interview-follow-up",
        T0 + 30,
      ),
    ).rejects.toEqual(limited("network"));
    await expect(
      enforceRateLimit(
        request(OTHER_NETWORK, tabId(99)),
        "interview-follow-up",
        T0 + 31,
      ),
    ).resolves.toBeDefined();
  });

  it("caps OpenAI requests per minute across every network", async () => {
    process.env.RATE_LIMIT_AI_PER_MINUTE = "5";
    for (let index = 0; index < 5; index += 1) {
      await enforceRateLimit(
        request(`192.0.2.${index + 1}`, tabId(index)),
        index % 2 ? "profile-generate" : "interview-follow-up",
        T0 + index * 1_000,
      );
    }
    const refused = enforceRateLimit(
      request("192.0.2.99", tabId(99)),
      "privacy-review",
      T0 + 10_000,
    );
    await expect(refused).rejects.toEqual(limited("service"));
    await expect(refused).rejects.toMatchObject({
      retryAfterSeconds: 50,
      message: expect.stringContaining("약 50초 뒤"),
    });

    // Routes that never call OpenAI are not held back by the AI caps.
    await expect(
      enforceRateLimit(
        request("192.0.2.99"),
        "submissions-create",
        T0 + 10_001,
      ),
    ).resolves.toBeDefined();
    // The window slides: one minute after the first call there is room again.
    await expect(
      enforceRateLimit(request("192.0.2.99"), "privacy-review", T0 + 60_001),
    ).resolves.toBeDefined();
  });

  it("caps OpenAI requests per day across every network", async () => {
    process.env.RATE_LIMIT_AI_PER_DAY = "8";
    for (let index = 0; index < 8; index += 1) {
      await enforceRateLimit(
        request(`192.0.2.${index + 1}`),
        "profile-generate",
        T0 + index * 3_600_000,
      );
    }
    const refused = enforceRateLimit(
      request("192.0.2.50"),
      "profile-generate",
      T0 + 8 * 3_600_000,
    );
    await expect(refused).rejects.toEqual(limited("service"));
    await expect(refused).rejects.toMatchObject({
      retryAfterSeconds: 16 * 3_600,
      message: expect.stringContaining("오늘 서비스의 AI 사용 한도"),
    });
  });

  it("counts an IPv6 /64 and its IPv4-mapped form as single networks", async () => {
    process.env.RATE_LIMIT_TEACHERS_PER_NETWORK = "1"; // network limit 12
    const sameSubnet = ["2001:db8:1:2::a", "2001:DB8:1:2:ffff::1"];
    for (let index = 0; index < 12; index += 1) {
      await enforceRateLimit(
        request(sameSubnet[index % 2], tabId(index)),
        "interview-follow-up",
        T0 + index,
      );
    }
    await expect(
      enforceRateLimit(
        request("2001:db8:1:2::77", tabId(50)),
        "interview-follow-up",
        T0 + 20,
      ),
    ).rejects.toEqual(limited("network"));
    await expect(
      enforceRateLimit(
        request("2001:db8:1:3::1", tabId(51)),
        "interview-follow-up",
        T0 + 21,
      ),
    ).resolves.toBeDefined();

    for (let index = 0; index < 12; index += 1) {
      await enforceRateLimit(
        request(index % 2 ? "::ffff:192.0.2.8" : "192.0.2.8", tabId(index)),
        "interview-follow-up",
        T0 + 100 + index,
      );
    }
    await expect(
      enforceRateLimit(
        request("192.0.2.8", tabId(60)),
        "interview-follow-up",
        T0 + 200,
      ),
    ).rejects.toEqual(limited("network"));
  });

  it("ignores a malformed tab ID instead of counting it as a tab", async () => {
    for (let index = 0; index < 50; index += 1) {
      await enforceRateLimit(
        request(SCHOOL_NETWORK, "not-a-tab-id"),
        "interview-follow-up",
        T0 + index,
      );
    }
  });

  it("limits admin login attempts per network", async () => {
    for (let index = 0; index < 5; index += 1) {
      await enforceRateLimit(request(), "admin-login", T0 + index);
    }
    await expect(
      enforceRateLimit(request(), "admin-login", T0 + 10),
    ).rejects.toEqual(limited("network"));
  });
});

describe("shared store", () => {
  beforeEach(() => useSharedStore());

  it("is used for counting when it is configured", async () => {
    expect(isSharedRateLimitConfigured()).toBe(true);
    await enforceRateLimit(
      request(SCHOOL_NETWORK, tabId(0)),
      "profile-refine",
      T0,
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(fake.keys()).toHaveLength(4);
  });

  it("accepts the KV_REST_API_* names the Vercel integration may inject", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.KV_REST_API_URL = UPSTASH_URL;
    process.env.KV_REST_API_TOKEN = UPSTASH_TOKEN;
    await enforceRateLimit(request(), "submissions-create", T0);
    expect(fake.keys()).toHaveLength(1);
  });

  it("stays per-instance until RATE_LIMIT_SECRET is set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    delete process.env.RATE_LIMIT_SECRET;
    expect(isSharedRateLimitConfigured()).toBe(false);
    await enforceRateLimit(request(), "profile-generate", T0);
    expect(fetch).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("rate_limit_shared_store_disabled", {
      reason: "missing_secret",
    });
  });

  it.each([
    [
      "request_failed",
      null,
      () => Promise.reject(new TypeError("fetch failed")),
    ],
    [
      "http_error",
      503,
      () => Promise.resolve(new Response("unavailable", { status: 503 })),
    ],
    [
      "invalid_response",
      200,
      () => Promise.resolve(Response.json({ result: "OK" })),
    ],
  ])(
    "falls back to per-instance counting on %s and retries the store later",
    async (reason, status, failure) => {
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      fake.fail(failure);

      await expect(
        enforceRateLimit(
          request(SCHOOL_NETWORK, tabId(0)),
          "interview-follow-up",
          T0,
        ),
      ).resolves.toMatchObject({ remaining: 39 });
      expect(warn).toHaveBeenCalledWith("rate_limit_store_fallback", {
        store: "upstash",
        reason,
        status,
        retryInMs: 30_000,
      });

      // While the store is skipped, the memory fallback still limits.
      for (let index = 1; index < 40; index += 1) {
        await enforceRateLimit(
          request(SCHOOL_NETWORK, tabId(0)),
          "interview-follow-up",
          T0 + index,
        );
      }
      await expect(
        enforceRateLimit(
          request(SCHOOL_NETWORK, tabId(0)),
          "interview-follow-up",
          T0 + 50,
        ),
      ).rejects.toEqual(limited("tab"));
      expect(fetch).toHaveBeenCalledOnce();

      fake.fail(undefined);
      await enforceRateLimit(
        request(SCHOOL_NETWORK, tabId(1)),
        "interview-follow-up",
        T0 + 30_001,
      );
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fake.keys().length).toBeGreaterThan(0);
    },
  );

  it("never sends, stores or logs a raw address or tab ID", async () => {
    const logged: unknown[] = [];
    for (const method of ["log", "info", "warn", "error"] as const) {
      vi.spyOn(console, method).mockImplementation((...args) => {
        logged.push(args);
      });
    }
    const networks = [SCHOOL_NETWORK, "2001:db8:abcd:12::5"];
    const tab = tabId(7);

    for (const [index, network] of networks.entries()) {
      await enforceRateLimit(
        request(network, tab),
        "privacy-review",
        T0 + index,
      );
      await enforceRateLimit(request(network), "admin-login", T0 + index);
    }
    fake.fail(() => Promise.reject(new TypeError("fetch failed")));
    await enforceRateLimit(
      request(SCHOOL_NETWORK, tab),
      "profile-refine",
      T0 + 5,
    );

    const visible = JSON.stringify({
      bodies: fake.bodies,
      keys: fake.keys(),
      members: fake.members(),
      logged,
    }).toLowerCase();
    expect(fake.bodies.length).toBeGreaterThan(0);
    for (const secret of [
      SCHOOL_NETWORK,
      "2001:db8",
      "2001:0db8",
      "abcd:12",
      "abcd:0012",
      tab,
    ]) {
      expect(visible).not.toContain(secret);
    }
  });

  it("keeps network and tab keys no longer than the 10-minute window", async () => {
    await enforceRateLimit(
      request(SCHOOL_NETWORK, tabId(0)),
      "profile-generate",
      T0,
    );
    await enforceRateLimit(request(), "admin-login", T0);

    const entries = [...fake.ttlMs.entries()];
    expect(entries).toHaveLength(5);
    for (const [key, ttl] of entries) {
      if (key.includes(":tab:") || key.includes(":net:")) {
        expect(ttl).toBe(10 * 60_000);
      } else {
        // Service-wide counters hold no address or tab digest at all.
        expect(key).toMatch(/^tc:rl:v1:ai:(minute|day)$/);
      }
    }
  });

  it("rotates address digests at midnight Seoul time", async () => {
    const networkKeys = () =>
      new Set(fake.keys().filter((key) => key.includes(":net:")));
    const beforeMidnight = Date.UTC(2026, 9, 9, 14, 59, 0); // 23:59 KST
    await enforceRateLimit(request(), "submissions-create", beforeMidnight);
    await enforceRateLimit(
      request(),
      "submissions-create",
      beforeMidnight + 30_000,
    );
    expect(networkKeys().size).toBe(1);
    await enforceRateLimit(
      request(),
      "submissions-create",
      beforeMidnight + 90_000,
    );
    expect(networkKeys().size).toBe(2);
  });
});

describe("rate limit stores", () => {
  it("run the Redis script with the same decisions as the memory store", async () => {
    useSharedStore();
    const memory = createMemoryRateLimitStore();
    const shared = createUpstashRateLimitStore({
      url: UPSTASH_URL,
      token: UPSTASH_TOKEN,
    });
    const tiers: RateLimitTier[] = [
      { key: "a", limit: 3, windowMs: 1_000 },
      { key: "b", limit: 5, windowMs: 4_000 },
      { key: "c", limit: 2, windowMs: 700 },
    ];
    let seed = 7;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };

    let now = T0;
    for (let step = 0; step < 300; step += 1) {
      now += Math.floor(random() * 400);
      const chosen = tiers.filter(() => random() < 0.7);
      const subset = chosen.length > 0 ? chosen : tiers;
      const member = `${now}-${step}`;
      expect(await shared.consume(subset, now, member)).toEqual(
        await memory.consume(subset, now, member),
      );
    }
  });
});
