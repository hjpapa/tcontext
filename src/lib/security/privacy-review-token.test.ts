import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isPrivacyReviewSigningConfigured,
  issuePrivacyReviewToken,
  PRIVACY_REVIEW_TOKEN_TTL_MS,
  verifyPrivacyReviewToken,
} from "@/lib/security/privacy-review-token";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  UNVERIFIED_PRIVACY_REVIEW,
  type TeacherContextProfile,
} from "@/types/profile";

const NOW = Date.parse("2026-10-08T03:00:00.000Z");

function clearProfile(): TeacherContextProfile {
  const fixture = FICTIONAL_PROFILES[0];
  if (!fixture) throw new Error("Missing fictional profile");
  return {
    ...structuredClone(fixture),
    privacyReview: { status: "clear", items: [] },
  };
}

describe("signed privacy review token", () => {
  beforeEach(() => {
    process.env.PRIVACY_REVIEW_SIGNING_SECRET = "s".repeat(48);
  });

  it("verifies within the hour and expires after it", () => {
    const profile = clearProfile();
    const token = issuePrivacyReviewToken(profile, NOW);

    expect(() =>
      verifyPrivacyReviewToken(
        token,
        profile,
        NOW + PRIVACY_REVIEW_TOKEN_TTL_MS,
      ),
    ).not.toThrow();
    expect(() =>
      verifyPrivacyReviewToken(
        token,
        profile,
        NOW + PRIVACY_REVIEW_TOKEN_TTL_MS + 1,
      ),
    ).toThrow(
      expect.objectContaining({ message: expect.stringContaining("만료") }),
    );
  });

  it("rejects a token dated in the future", () => {
    const profile = clearProfile();
    const token = issuePrivacyReviewToken(profile, NOW + 10 * 60_000);

    expect(() => verifyPrivacyReviewToken(token, profile, NOW)).toThrow(
      expect.objectContaining({ code: "privacy_review_required", status: 422 }),
    );
  });

  it.each([
    [
      "the tag selection",
      (profile: TeacherContextProfile) => {
        profile.confirmedTags.aiBoundaries = [];
      },
    ],
    [
      "a claim confirmation",
      (profile: TeacherContextProfile) => {
        const claim = profile.modules[0]?.claims[0];
        if (!claim) throw new Error("Missing claim");
        claim.confirmedByUser = !claim.confirmedByUser;
      },
    ],
    [
      "a synthesis sentence",
      (profile: TeacherContextProfile) => {
        profile.aiCollaborationInstructions.push("새 지침");
      },
    ],
  ])("binds %s", (_label, mutate) => {
    const profile = clearProfile();
    const token = issuePrivacyReviewToken(profile, NOW);
    mutate(profile);

    expect(() => verifyPrivacyReviewToken(token, profile, NOW)).toThrow(
      expect.objectContaining({ code: "privacy_review_required" }),
    );
  });

  it.each([
    "",
    "v1",
    "v2.1785456000000.abc",
    "v1.not-a-time.abc",
    "v1.1785456000000.abc.extra",
  ])("rejects the malformed token %j", (token) => {
    expect(() => verifyPrivacyReviewToken(token, clearProfile(), NOW)).toThrow(
      expect.objectContaining({ code: "privacy_review_required" }),
    );
  });

  it("never signs a review that is not clear", () => {
    const profile = {
      ...clearProfile(),
      privacyReview: UNVERIFIED_PRIVACY_REVIEW,
    };

    expect(() => issuePrivacyReviewToken(profile, NOW)).toThrow();
  });

  it("requires a server secret of at least 32 characters", () => {
    process.env.PRIVACY_REVIEW_SIGNING_SECRET = "x".repeat(31);

    expect(isPrivacyReviewSigningConfigured()).toBe(false);
    expect(() => issuePrivacyReviewToken(clearProfile(), NOW)).toThrow(
      expect.objectContaining({ code: "configuration_error", status: 503 }),
    );
  });
});
