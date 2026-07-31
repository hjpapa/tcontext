import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  calculateRetentionUntil,
  getRetentionDays,
} from "@/lib/consent/policy";
import {
  createDeletionToken,
  hashDeletionToken,
  verifyDeletionToken,
} from "@/lib/security/hash-token";
import {
  assertSafeForAI,
  collectProfilePrivacyTextFields,
  findPrivacyRisks,
  localProfilePrivacyReview,
} from "@/lib/security/privacy-guard";
import {
  consumeRateLimit,
  resetRateLimitsForTests,
} from "@/lib/security/rate-limit";
import {
  PROFILE_MODULE_IDS,
  teacherContextProfileSchema,
  type TeacherContextProfile,
} from "@/types/profile";
import { FICTIONAL_PROFILES } from "@/content/examples";

function storedProfile(): TeacherContextProfile {
  return {
    metadata: {
      schoolLevel: "elementary",
      role: "homeroom_teacher",
      generatedAt: "2026-07-31T00:00:00.000Z",
      schemaVersion: "1.0",
      modelName: "gpt-5.4-nano",
      promptVersion: "1.1",
    },
    profileTitle: "Teacher context",
    shortSummary: "A safe class-level summary.",
    modules: PROFILE_MODULE_IDS.map((id, index) => ({
      id,
      title: `${id} title`,
      summary: `${id} summary`,
      claims: [
        {
          id: `claim-${index + 1}`,
          text: `Class support ${index + 1}`,
          basis: "direct",
          evidenceQuestionIds: [`q-${index + 1}`],
          confirmedByUser: true,
        },
      ],
    })),
    teachingDesignPrinciples: ["Invite student reasoning."],
    classSupportConsiderations: ["Offer predictable steps."],
    realisticConstraints: ["Lesson time is limited."],
    aiCollaborationInstructions: ["Keep teacher judgment final."],
    confirmedTags: {
      preferredTeachingMethods: ["discussion"],
      participationPriorities: ["revision"],
      emotionalSupportPriorities: ["psychological_safety"],
      assessmentPriorities: ["learning_process"],
      environmentConstraints: ["limited_time"],
      aiBoundaries: ["teacher_final_judgment"],
    },
    privacyReview: { status: "clear", items: [] },
  };
}

describe("security boundaries", () => {
  const originalPepper = process.env.DELETE_TOKEN_PEPPER;
  const originalRetention = process.env.DATA_RETENTION_DAYS;

  beforeEach(() => {
    process.env.DELETE_TOKEN_PEPPER = "p".repeat(48);
    process.env.DATA_RETENTION_DAYS = "365";
    resetRateLimitsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.DELETE_TOKEN_PEPPER = originalPepper;
    process.env.DATA_RETENTION_DAYS = originalRetention;
  });

  it("blocks personal data before an OpenAI boundary without echoing it", () => {
    let thrown: unknown;
    try {
      assertSafeForAI([
        { path: "answers.0", value: "김민수 학생은 ADHD 진단을 받았습니다." },
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: "privacy_risk_detected",
      status: 422,
    });
    expect(JSON.stringify(thrown)).not.toContain("김민수");
  });

  it("keeps every fictional example clear at the full persistence boundary", () => {
    for (const profile of FICTIONAL_PROFILES) {
      expect(
        findPrivacyRisks(collectProfilePrivacyTextFields(profile)),
      ).toEqual([]);
    }
  });

  it("allows group-level support language", () => {
    expect(() =>
      assertSafeForAI([
        {
          path: "answers.0",
          value:
            "일부 학생은 긴 설명 뒤 집중 전환이 어려워 짧은 단계 안내가 필요합니다.",
        },
      ]),
    ).not.toThrow();
  });

  it("scans every persisted authored string, including role, titles, and IDs", () => {
    const fields = collectProfilePrivacyTextFields(storedProfile());
    const paths = fields.map((field) => field.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "profile.metadata.role",
        "profile.metadata.generatedAt",
        "profile.metadata.schemaVersion",
        "profile.metadata.modelName",
        "profile.metadata.promptVersion",
        "profile.profileTitle",
        "profile.shortSummary",
        "profile.modules.0.id",
        "profile.modules.0.title",
        "profile.modules.0.summary",
        "profile.modules.0.claims.0.id",
        "profile.modules.0.claims.0.text",
        "profile.modules.0.claims.0.basis",
        "profile.modules.0.claims.0.evidenceQuestionIds.0",
        "profile.teachingDesignPrinciples.0",
        "profile.classSupportConsiderations.0",
        "profile.realisticConstraints.0",
        "profile.aiCollaborationInstructions.0",
        "profile.confirmedTags.preferredTeachingMethods.0",
        "profile.privacyReview.status",
      ]),
    );
    expect(localProfilePrivacyReview(storedProfile()).status).toBe("clear");
  });

  it("detects personal information hidden in stored titles and IDs", () => {
    const value = storedProfile();
    const firstModule = value.modules[0];
    const secondModule = value.modules[1];
    const thirdModule = value.modules[2];
    if (!firstModule || !secondModule || !thirdModule) {
      throw new Error("profile fixture modules are missing");
    }
    const secondClaim = secondModule.claims[0];
    const thirdClaim = thirdModule.claims[0];
    if (!secondClaim || !thirdClaim) {
      throw new Error("profile fixture claims are missing");
    }

    value.metadata.modelName = "teacher@example.com";
    firstModule.title = "teacher@example.com";
    secondClaim.id = "010-1234-5678";
    thirdClaim.evidenceQuestionIds = ["evidence@example.com"];

    const review = localProfilePrivacyReview(value);

    expect(review.status).toBe("needs_review");
    expect(review.items).toHaveLength(4);
  });

  it("rejects names in machine identifiers before they can be persisted", () => {
    const claimIdProfile = storedProfile();
    const evidenceIdProfile = storedProfile();
    const claim = claimIdProfile.modules[0]?.claims[0];
    const evidenceClaim = evidenceIdProfile.modules[0]?.claims[0];
    if (!claim || !evidenceClaim) throw new Error("Missing profile claim");

    claim.id = "김소영";
    evidenceClaim.evidenceQuestionIds = ["박은영"];

    expect(teacherContextProfileSchema.safeParse(claimIdProfile).success).toBe(
      false,
    );
    expect(
      teacherContextProfileSchema.safeParse(evidenceIdProfile).success,
    ).toBe(false);
  });

  it("creates a 32-byte deletion token and verifies only its HMAC", () => {
    const token = createDeletionToken();
    const hash = hashDeletionToken(token);

    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(hash).not.toContain(token);
    expect(verifyDeletionToken(token, hash)).toBe(true);
    expect(verifyDeletionToken(createDeletionToken(), hash)).toBe(false);
  });

  it("rejects a short deletion-token pepper", () => {
    process.env.DELETE_TOKEN_PEPPER = "too-short";
    expect(() => hashDeletionToken("x".repeat(43))).toThrowError(
      expect.objectContaining({ code: "configuration_error" }),
    );
  });

  it("reserves one daily purge interval inside the maximum retention period", () => {
    const consentedAt = new Date("2026-07-31T00:00:00.000Z");
    expect(getRetentionDays()).toBe(365);
    expect(calculateRetentionUntil(consentedAt).toISOString()).toBe(
      "2027-07-30T00:00:00.000Z",
    );
  });

  it("makes a one-day policy eligible immediately for the next purge", () => {
    const consentedAt = new Date("2026-07-31T00:00:00.000Z");

    expect(calculateRetentionUntil(consentedAt, 1)).toEqual(consentedAt);
  });

  it("rejects a retention setting longer than the promised 365 days", () => {
    process.env.DATA_RETENTION_DAYS = "366";
    expect(() => getRetentionDays()).toThrowError(
      expect.objectContaining({ code: "configuration_error" }),
    );
    expect(() =>
      calculateRetentionUntil(new Date("2026-07-31T00:00:00.000Z"), 366),
    ).toThrowError(expect.objectContaining({ code: "configuration_error" }));
  });

  it("uses a generous per-address limit for shared school networks", () => {
    const request = new Request("https://tcontext.test", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const options = { namespace: "test", limit: 2, windowMs: 60_000 };

    expect(consumeRateLimit(request, options, 1_000).remaining).toBe(1);
    expect(consumeRateLimit(request, options, 1_000).remaining).toBe(0);
    expect(() => consumeRateLimit(request, options, 1_000)).toThrowError(
      expect.objectContaining({ code: "rate_limit_exceeded" }),
    );
  });
});
