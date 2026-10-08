import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/privacy", () => ({
  reviewProfileWithAI: vi.fn(),
}));

import { maxDuration as generateMaxDuration } from "@/app/api/profile/generate/route";
import { maxDuration as refineMaxDuration } from "@/app/api/profile/refine/route";
import {
  maxDuration as privacyMaxDuration,
  POST as privacyReviewRoute,
} from "@/app/api/privacy/review/route";
import { reviewProfileWithAI } from "@/lib/ai/privacy";
import { ApiError } from "@/lib/security/api-error";
import { verifyPrivacyReviewToken } from "@/lib/security/privacy-review-token";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { UNVERIFIED_PRIVACY_REVIEW } from "@/types/profile";

const PENDING_REVIEW = {
  status: "needs_review" as const,
  items: [
    {
      text: "최종 개인정보 검사를 완료하지 않은 초안",
      reason: "현재 내용은 최종 개인정보 검사를 다시 받아야 합니다.",
      suggestedRewrite: "검토를 마친 뒤 최종 개인정보 검사를 실행해 주세요.",
    },
  ],
};

function pendingProfile() {
  const fixture = FICTIONAL_PROFILES[0];
  if (!fixture) throw new Error("Missing fictional profile");
  return { ...structuredClone(fixture), privacyReview: PENDING_REVIEW };
}

function reviewRequest(profile: unknown) {
  return new Request("https://tcontext.test/api/privacy/review", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.20",
    },
    body: JSON.stringify({ profile }),
  });
}

describe("final privacy review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitsForTests();
    process.env.PRIVACY_REVIEW_SIGNING_SECRET = "s".repeat(48);
  });

  it("signs a clear OpenAI verdict for the exact profile the browser will submit", async () => {
    vi.mocked(reviewProfileWithAI).mockResolvedValue({
      source: "openai",
      review: { status: "clear", items: [] },
    });
    const profile = pendingProfile();

    const response = await privacyReviewRoute(reviewRequest(profile));
    const body = (await response.json()) as { reviewToken?: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      source: "openai",
      review: { status: "clear", items: [] },
      reviewToken: expect.stringMatching(/^v1\.\d+\./u),
    });
    const reviewed = {
      ...profile,
      privacyReview: { status: "clear" as const, items: [] },
    };
    expect(() =>
      verifyPrivacyReviewToken(body.reviewToken, reviewed),
    ).not.toThrow();
    expect(() =>
      verifyPrivacyReviewToken(body.reviewToken, {
        ...reviewed,
        shortSummary: `${reviewed.shortSummary} 바뀐 문장`,
      }),
    ).toThrow(expect.objectContaining({ code: "privacy_review_required" }));
  });

  it.each([
    [
      "a local finding",
      {
        source: "local" as const,
        review: {
          status: "needs_review" as const,
          items: [
            {
              text: "검토할 문장",
              reason: "직접 식별정보가 있습니다.",
              suggestedRewrite: "지원 중심으로 바꿉니다.",
            },
          ],
        },
      },
    ],
    [
      "an OpenAI finding",
      {
        source: "openai" as const,
        review: {
          status: "needs_review" as const,
          items: [
            {
              text: "검토할 문장",
              reason: "직접 식별정보가 있습니다.",
              suggestedRewrite: "지원 중심으로 바꿉니다.",
            },
          ],
        },
      },
    ],
    [
      "a clear result that OpenAI did not produce",
      {
        source: "local" as const,
        review: { status: "clear" as const, items: [] },
      },
    ],
  ])("does not sign %s", async (_label, result) => {
    vi.mocked(reviewProfileWithAI).mockResolvedValue(result);

    const response = await privacyReviewRoute(reviewRequest(pendingProfile()));

    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("reviewToken");
  });

  it("still returns the review without a token when signing is not configured", async () => {
    delete process.env.PRIVACY_REVIEW_SIGNING_SECRET;
    vi.mocked(reviewProfileWithAI).mockResolvedValue({
      source: "openai",
      review: { status: "clear", items: [] },
    });

    const response = await privacyReviewRoute(reviewRequest(pendingProfile()));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ review: { status: "clear" } });
    expect(body).not.toHaveProperty("reviewToken");
  });

  it("returns a retryable AI failure without document text", async () => {
    vi.mocked(reviewProfileWithAI).mockRejectedValue(
      new ApiError(
        "ai_rate_limited",
        503,
        "AI 서비스 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요.",
        { retryAfterSeconds: 10 },
      ),
    );
    const profile = pendingProfile();

    const response = await privacyReviewRoute(reviewRequest(profile));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("10");
    expect(text).not.toContain(profile.shortSummary);
  });

  it("accepts an unverified profile for a fresh review", async () => {
    vi.mocked(reviewProfileWithAI).mockResolvedValue({
      source: "openai",
      review: { status: "clear", items: [] },
    });

    const response = await privacyReviewRoute(
      reviewRequest({
        ...pendingProfile(),
        privacyReview: UNVERIFIED_PRIVACY_REVIEW,
      }),
    );

    expect(response.status).toBe(200);
  });

  it("declares function time limits that cover the OpenAI retry budget", () => {
    // Two 25s privacy attempts and two 45s profile attempts, within Vercel's
    // 300s Fluid compute ceiling.
    expect(privacyMaxDuration).toBeGreaterThanOrEqual(50);
    expect(generateMaxDuration).toBeGreaterThanOrEqual(92);
    expect(refineMaxDuration).toBeGreaterThanOrEqual(90);
    for (const value of [
      privacyMaxDuration,
      generateMaxDuration,
      refineMaxDuration,
    ]) {
      expect(value).toBeLessThanOrEqual(300);
    }
  });
});
