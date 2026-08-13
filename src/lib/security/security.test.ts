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
  collectProfileRefinePrivacyTextFields,
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
      promptVersion: "1.4",
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
      details: {
        findings: expect.arrayContaining([
          { category: "student_name", path: "answers.0" },
          { category: "medical_or_counseling", path: "answers.0" },
        ]),
      },
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

  it("allows ordinary Korean grammar in a module-refinement summary", () => {
    const profile = storedProfile();
    const summary =
      "교사의 수업 운영 방식은 학생의 선택과 참여를 존중하는 데 초점을 둡니다.";
    const firstModule = profile.modules[0];
    if (!firstModule) throw new Error("Missing profile module fixture");
    firstModule.summary = summary;

    const fields = collectProfileRefinePrivacyTextFields(
      profile,
      "educational_philosophy",
    );

    expect(fields).toContainEqual({
      path: "profile.modules.0.summary",
      value: summary,
    });
    expect(findPrivacyRisks(fields)).toEqual([]);
    expect(() => assertSafeForAI(fields)).not.toThrow();
  });

  it("allows an educational topic object before a generic student reference", () => {
    const text =
      "교사는 보드게임과 사회정서적 주제를 학생의 자발적 학습력으로 연결하는 수업 가능성을 탐색하고 있다. 활동 자체의 재미뿐 아니라 학생들이 편안하고 즐겁게 참여하는 분위기 조성이 중요한 역할로 나타난다.";

    expect(() =>
      assertSafeForAI([{ path: "profile.shortSummary", value: text }]),
    ).not.toThrow();
  });

  it("still blocks a likely name in a module-refinement summary", () => {
    const profile = storedProfile();
    const firstModule = profile.modules[0];
    if (!firstModule) throw new Error("Missing profile module fixture");
    firstModule.summary = "김다은 학생의 선택을 존중합니다.";

    let thrown: unknown;
    try {
      assertSafeForAI(
        collectProfileRefinePrivacyTextFields(
          profile,
          "educational_philosophy",
        ),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: "privacy_risk_detected",
      details: {
        findings: expect.arrayContaining([
          {
            category: "student_name",
            path: "profile.modules.0.summary",
          },
        ]),
      },
    });
    expect(JSON.stringify(thrown)).not.toContain("김다은");
  });

  it.each([
    "학생",
    "학생들",
    "학급",
    "우리 학급",
    "우리 반",
    "학생들은 자신의 생각을 설명할 시간이 필요합니다.",
    "학급 전체에 시각적 순서를 제공합니다.",
    "우리 학급은 토론과 수정 기회를 중요하게 여깁니다.",
    "우리 반 학생들이 안전하게 질문하도록 지원합니다.",
    "교육관과 학생관 요약",
    "배움은 학생이 스스로 의미를 구성하는 과정입니다.",
    "기다림은 학생의 속도를 존중하는 태도입니다.",
    "선택권은 학생과 함께 정합니다.",
    "주도권은 학생에게 넘깁니다.",
    "수업은 학생이 질문하는 시간입니다.",
    "교실은 학생이 실수해도 안전한 곳입니다.",
    "관계는 학생과 함께 만듭니다.",
    "평가는 학생의 성장을 돕습니다.",
  ])(
    "allows generic educational context before an OpenAI boundary: %s",
    (text) => {
      expect(() =>
        assertSafeForAI([{ path: "answers.0", value: text }]),
      ).not.toThrow();
    },
  );

  it.each([
    "푸른하늘초등학교에서 근무합니다.",
    "한빛교육지원청에서 근무합니다.",
    "3학년 2반 학생들과 토론합니다.",
    "3학년 2반을 대상으로 토론합니다.",
    "햇살반 학생들에게 활동 순서를 안내합니다.",
    "햇살반에서 토론합니다.",
    "김민수 학생의 점수는 43점입니다.",
    "학생 김민수는 토론을 선호합니다.",
    "박은영 교사는 토론을 선호합니다.",
    "Alex Kim 학생은 토론을 선호합니다.",
  ])("blocks identifiable context before an OpenAI boundary: %s", (text) => {
    expect(() =>
      assertSafeForAI([{ path: "answers.0", value: text }]),
    ).toThrowError(expect.objectContaining({ code: "privacy_risk_detected" }));
  });

  it.each([
    "한 학생의 점수는 85점입니다.",
    "한 학생이 ADHD 진단을 받았습니다.",
    "학생 한 명의 석차는 3등입니다.",
    "학생 한 명의 상담 내용은 외부에 공유되었습니다.",
    "그 학생의 상담 내용: 최근 불안으로 치료 중입니다.",
    "상담 내용은 보호자에게 제공하거나 교내에 기록합니다.",
    "산만한 학생에게 짧은 활동 순서를 안내합니다.",
    "현재 교사는 토론 수업을 준비합니다.",
    "전입 학생은 새 환경을 익히는 중입니다.",
    "조용한 학생에게 생각할 시간을 줍니다.",
    "이상한 학생이라는 표현은 사용하지 않습니다.",
    "이러한 교사는 질문을 기다려 줍니다.",
    "최대한 학생 참여를 지원합니다.",
    "이전의 학생 반응을 다음 수업에 반영합니다.",
    "성적별 학생 지원 자료를 준비합니다.",
  ])("allows non-identifying context before an OpenAI boundary: %s", (text) => {
    expect(() =>
      assertSafeForAI([{ path: "answers.0", value: text }]),
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
