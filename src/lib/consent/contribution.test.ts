import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Contribution must trust the signed review instead of calling OpenAI again;
// this mock only proves that no second review happens.
vi.mock("@/lib/ai/privacy", () => ({
  reviewProfileWithAI: vi.fn(),
}));
vi.mock("@/lib/supabase/submissions", () => ({
  insertSubmission: vi.fn(),
}));

import { reviewProfileWithAI } from "@/lib/ai/privacy";
import { OPENAI_MODELS, PROMPT_VERSION } from "@/lib/ai/models";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import {
  contributeProfile,
  validateContribution,
} from "@/lib/consent/contribution";
import {
  issuePrivacyReviewToken,
  PRIVACY_REVIEW_TOKEN_TTL_MS,
} from "@/lib/security/privacy-review-token";
import { insertSubmission } from "@/lib/supabase/submissions";
import {
  PROFILE_MODULE_IDS,
  PROFILE_MODULE_TITLES,
  UNVERIFIED_PRIVACY_REVIEW,
  type TeacherContextProfile,
} from "@/types/profile";

const SIGNING_SECRET = "s".repeat(48);

function profile(
  options: {
    confirmed?: boolean;
    privacyStatus?: "clear" | "needs_review";
  } = {},
): TeacherContextProfile {
  const confirmed = options.confirmed ?? true;
  const privacyStatus = options.privacyStatus ?? "clear";
  return {
    metadata: {
      schoolLevel: "elementary",
      role: "homeroom_teacher",
      generatedAt: "2026-07-31T00:00:00.000Z",
      schemaVersion: "1.0",
      modelName: OPENAI_MODELS.profile,
      promptVersion: PROMPT_VERSION,
    },
    profileTitle: "수업 설계를 위한 교사 컨텍스트",
    shortSummary: "질문과 수정 기회를 중시하는 수업 맥락입니다.",
    modules: PROFILE_MODULE_IDS.map((id, index) => ({
      id,
      title: PROFILE_MODULE_TITLES[id],
      summary: `${PROFILE_MODULE_TITLES[id]}에 관한 요약입니다.`,
      claims: [
        {
          id: `claim-${index + 1}`,
          text: "학생이 생각을 설명하고 수정할 시간을 제공합니다.",
          basis: "direct",
          evidenceQuestionIds: [`q-${index + 1}`],
          confirmedByUser: confirmed,
        },
      ],
    })),
    teachingDesignPrinciples: ["학생의 생각을 먼저 확인합니다."],
    classSupportConsiderations: ["짧은 단계 안내를 제공합니다."],
    realisticConstraints: ["수업 시간이 제한적입니다."],
    aiCollaborationInstructions: ["사실 확인이 필요한 부분을 표시합니다."],
    confirmedTags: {
      preferredTeachingMethods: ["discussion"],
      participationPriorities: ["revision"],
      emotionalSupportPriorities: ["psychological_safety"],
      assessmentPriorities: ["learning_process"],
      environmentConstraints: ["limited_time"],
      aiBoundaries: ["teacher_final_judgment"],
    },
    privacyReview:
      privacyStatus === "clear"
        ? { status: "clear", items: [] }
        : {
            status: "needs_review",
            items: [
              {
                text: "검토할 문장",
                reason: "개인정보 가능성이 있습니다.",
                suggestedRewrite: "집단 수준 표현으로 수정합니다.",
              },
            ],
          },
  };
}

function contribution(overrides: Record<string, unknown> = {}) {
  const value = profile();
  return {
    profile: value,
    profileMarkdown: profileToMarkdown(value),
    confirmedTags: value.confirmedTags,
    privacyReview: value.privacyReview,
    consentVersion: "1.0",
    consentAccepted: true,
    privacyReviewToken: issuePrivacyReviewToken(value),
    ...overrides,
  };
}

function storedReceipt() {
  vi.mocked(insertSubmission).mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-07-31T00:00:00.000Z",
    retentionUntil: "2027-07-30T00:00:00.000Z",
  });
}

describe("optional profile contribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONSENT_VERSION = "1.0";
    process.env.DATA_RETENTION_DAYS = "365";
    process.env.DELETE_TOKEN_PEPPER = "p".repeat(48);
    process.env.PRIVACY_REVIEW_SIGNING_SECRET = SIGNING_SECRET;
  });

  it("requires explicit consent", () => {
    expect(() =>
      validateContribution(contribution({ consentAccepted: false }) as never),
    ).toThrowError(expect.objectContaining({ code: "consent_required" }));
  });

  it("blocks unresolved claims and incomplete privacy review", () => {
    const unresolved = profile({ confirmed: false });
    expect(() =>
      validateContribution(
        contribution({
          profile: unresolved,
          profileMarkdown: profileToMarkdown(unresolved),
          confirmedTags: unresolved.confirmedTags,
          privacyReview: unresolved.privacyReview,
        }) as never,
      ),
    ).toThrowError(expect.objectContaining({ code: "unresolved_claims" }));

    const unsafe = profile({ privacyStatus: "needs_review" });
    expect(() =>
      validateContribution(
        contribution({
          profile: unsafe,
          profileMarkdown: profileToMarkdown(unsafe),
          confirmedTags: unsafe.confirmedTags,
          privacyReview: unsafe.privacyReview,
        }) as never,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "privacy_review_required" }),
    );
  });

  it("rejects Markdown that is not derived from the profile JSON", () => {
    expect(() =>
      validateContribution(
        contribution({ profileMarkdown: "# 다른 문서" }) as never,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "profile_markdown_mismatch" }),
    );
  });

  it("rejects client-modified generation metadata", () => {
    const modified = profile();
    modified.metadata.modelName = "pretend-model";
    expect(() =>
      validateContribution(
        contribution({
          profile: modified,
          profileMarkdown: profileToMarkdown(modified),
          confirmedTags: modified.confirmedTags,
          privacyReview: modified.privacyReview,
        }) as never,
      ),
    ).toThrowError(expect.objectContaining({ code: "profile_data_mismatch" }));
  });

  it("keeps locally unsafe stored strings away from OpenAI and the database", async () => {
    const unsafe = profile();
    const claim = unsafe.modules[0]?.claims[0];
    if (!claim) throw new Error("profile fixture claim is missing");
    claim.text = "teacher@example.com";

    let thrown: unknown;
    try {
      await contributeProfile(
        contribution({
          profile: unsafe,
          profileMarkdown: profileToMarkdown(unsafe),
          confirmedTags: unsafe.confirmedTags,
          privacyReview: unsafe.privacyReview,
        }) as never,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: "privacy_review_required",
      details: { itemCount: 1 },
    });
    expect(JSON.stringify(thrown)).not.toContain("teacher@example.com");
    expect(reviewProfileWithAI).not.toHaveBeenCalled();
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it("rejects an unverified review that the teacher continued past locally", () => {
    const unverified = profile();
    unverified.privacyReview = UNVERIFIED_PRIVACY_REVIEW;

    expect(() =>
      validateContribution(
        contribution({
          profile: unverified,
          profileMarkdown: profileToMarkdown(unverified),
          confirmedTags: unverified.confirmedTags,
          privacyReview: unverified.privacyReview,
          privacyReviewToken: undefined,
        }) as never,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "privacy_review_required" }),
    );
  });

  it("stores a signed clear profile without asking OpenAI again", async () => {
    storedReceipt();
    const input = contribution();

    const receipt = await contributeProfile(input as never);
    const payload = vi.mocked(insertSubmission).mock.calls[0]?.[0];

    expect(receipt.deletionToken).toHaveLength(43);
    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty("answers");
    expect(payload).not.toHaveProperty("raw_answers");
    expect(JSON.stringify(payload)).not.toContain(input.privacyReviewToken);
    expect(payload?.deletion_token_hash).not.toBe(receipt.deletionToken);
    expect(payload?.retention_until).toBeTruthy();
    expect(payload?.profile_markdown).toBe(
      profileToMarkdown(contribution().profile as TeacherContextProfile),
    );
    expect(reviewProfileWithAI).not.toHaveBeenCalled();
  });

  it("accepts the same profile when its keys arrive in another order", async () => {
    storedReceipt();
    const reordered = Object.fromEntries(
      Object.entries(profile()).reverse(),
    ) as TeacherContextProfile;

    await expect(
      contributeProfile(
        contribution({
          profile: reordered,
          profileMarkdown: profileToMarkdown(reordered),
        }) as never,
      ),
    ).resolves.toMatchObject({ deletionToken: expect.any(String) });
  });

  it.each([
    ["is missing", () => undefined],
    ["has a forged signature", () => "v1.1785456000000.forged-signature"],
    [
      "has a tampered timestamp",
      () => {
        const [version, issuedAt, mac] =
          issuePrivacyReviewToken(profile()).split(".");
        return `${version}.${Number(issuedAt) + 1}.${mac}`;
      },
    ],
    [
      "was signed with another secret",
      () => {
        process.env.PRIVACY_REVIEW_SIGNING_SECRET = "o".repeat(48);
        const token = issuePrivacyReviewToken(profile());
        process.env.PRIVACY_REVIEW_SIGNING_SECRET = SIGNING_SECRET;
        return token;
      },
    ],
  ])("rejects a review token that %s", async (_label, makeToken) => {
    await expect(
      contributeProfile(
        contribution({ privacyReviewToken: makeToken() }) as never,
      ),
    ).rejects.toMatchObject({ code: "privacy_review_required", status: 422 });
    expect(insertSubmission).not.toHaveBeenCalled();
    expect(reviewProfileWithAI).not.toHaveBeenCalled();
  });

  it("rejects a review token after one hour", async () => {
    const issuedAt = Date.now() - PRIVACY_REVIEW_TOKEN_TTL_MS - 1_000;

    await expect(
      contributeProfile(
        contribution({
          privacyReviewToken: issuePrivacyReviewToken(profile(), issuedAt),
        }) as never,
      ),
    ).rejects.toMatchObject({
      code: "privacy_review_required",
      status: 422,
      message: expect.stringContaining("만료"),
    });
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it("rejects a profile that changed after the review was signed", async () => {
    const token = issuePrivacyReviewToken(profile());
    const changed = profile();
    const claim = changed.modules[0]?.claims[0];
    if (!claim) throw new Error("profile fixture claim is missing");
    claim.text = "학생이 생각을 말로 설명할 시간을 충분히 줍니다.";

    await expect(
      contributeProfile(
        contribution({
          profile: changed,
          profileMarkdown: profileToMarkdown(changed),
          privacyReviewToken: token,
        }) as never,
      ),
    ).rejects.toMatchObject({ code: "privacy_review_required", status: 422 });
    expect(insertSubmission).not.toHaveBeenCalled();
    expect(reviewProfileWithAI).not.toHaveBeenCalled();
  });

  it("refuses contribution when the signing secret is missing or short", async () => {
    const input = contribution();
    process.env.PRIVACY_REVIEW_SIGNING_SECRET = "short";

    await expect(contributeProfile(input as never)).rejects.toMatchObject({
      code: "configuration_error",
      status: 503,
    });
    expect(insertSubmission).not.toHaveBeenCalled();
  });
});
