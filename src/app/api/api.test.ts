import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/follow-up", () => ({
  decideFollowUp: vi.fn(),
}));
vi.mock("@/lib/ai/profile", () => ({
  generateProfile: vi.fn(),
  refineProfile: vi.fn(),
}));
vi.mock("@/lib/consent/contribution", () => ({
  contributeProfile: vi.fn(),
}));
vi.mock("@/lib/supabase/submissions", () => ({
  deleteSubmission: vi.fn(),
  getDeletionTokenHash: vi.fn(),
  purgeExpiredSubmissions: vi.fn(),
}));

import { GET as purgeExpired } from "@/app/api/cron/purge-expired/route";
import { POST as followUp } from "@/app/api/interview/follow-up/route";
import { POST as generateProfileRoute } from "@/app/api/profile/generate/route";
import { POST as createSubmissionRoute } from "@/app/api/submissions/create/route";
import { POST as deleteSubmissionRoute } from "@/app/api/submissions/delete/route";
import { decideFollowUp } from "@/lib/ai/follow-up";
import { generateProfile } from "@/lib/ai/profile";
import { contributeProfile } from "@/lib/consent/contribution";
import { ApiError } from "@/lib/security/api-error";
import { resetRateLimitsForTests } from "@/lib/security/rate-limit";
import {
  deleteSubmission,
  getDeletionTokenHash,
  purgeExpiredSubmissions,
} from "@/lib/supabase/submissions";
import {
  PROFILE_MODULE_IDS,
  type TeacherContextProfile,
} from "@/types/profile";

const safeExchange = {
  questionId: "q-1",
  moduleId: "educational_philosophy",
  question: "좋은 수업이었다고 느끼는 순간은 언제인가요?",
  answer: "학생이 자신의 생각을 설명하고 수정했을 때입니다.",
};

function submissionProfile(): TeacherContextProfile {
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
    shortSummary: "Discussion and revision support.",
    modules: PROFILE_MODULE_IDS.map((id, index) => ({
      id,
      title: `${id} title`,
      summary: `${id} summary`,
      claims: [
        {
          id: `claim-${index + 1}`,
          text: `Support statement ${index + 1}`,
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

function submissionBody() {
  const profile = submissionProfile();
  return {
    profile,
    profileMarkdown: "# Teacher context\n",
    confirmedTags: profile.confirmedTags,
    privacyReview: profile.privacyReview,
    consentVersion: "1.0",
    consentAccepted: true,
  };
}

function jsonRequest(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
) {
  return new Request(`https://tcontext.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("API route boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitsForTests();
    process.env.DELETE_TOKEN_PEPPER = "p".repeat(48);
    process.env.CRON_SECRET = "c".repeat(48);
  });

  it("returns 400 for malformed input", async () => {
    const response = await followUp(
      jsonRequest("/api/interview/follow-up", {}),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
    expect(decideFollowUp).not.toHaveBeenCalled();
  });

  it("blocks detected personal information before calling OpenAI", async () => {
    const response = await followUp(
      jsonRequest("/api/interview/follow-up", {
        schoolLevel: "elementary",
        role: "homeroom_teacher",
        current: {
          ...safeExchange,
          answer: "김민수 학생은 ADHD 진단을 받았습니다.",
        },
        previousAnswers: [],
        followUpCount: 0,
      }),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("privacy_risk_detected");
    expect(JSON.stringify(body)).not.toContain("김민수");
    expect(decideFollowUp).not.toHaveBeenCalled();
  });

  it("enforces the four-follow-up maximum without an AI call", async () => {
    const response = await followUp(
      jsonRequest("/api/interview/follow-up", {
        schoolLevel: "elementary",
        role: "homeroom_teacher",
        current: safeExchange,
        previousAnswers: [],
        followUpCount: 4,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      needed: false,
      question: null,
      reason: "follow_up_limit_reached",
    });
    expect(decideFollowUp).not.toHaveBeenCalled();
  });

  it("maps an AI timeout without leaking input", async () => {
    vi.mocked(generateProfile).mockRejectedValue(
      new ApiError(
        "ai_timeout",
        504,
        "AI 응답 시간이 초과되었습니다. 다시 시도해 주세요.",
      ),
    );

    const response = await generateProfileRoute(
      jsonRequest("/api/profile/generate", {
        schoolLevel: "elementary",
        role: "homeroom_teacher",
        answers: [safeExchange],
      }),
    );
    expect(response.status).toBe(504);
    expect((await response.json()).error.code).toBe("ai_timeout");
  });

  it("rejects a declared body larger than 512 KiB", async () => {
    const response = await followUp(
      jsonRequest(
        "/api/interview/follow-up",
        {},
        { "content-length": String(512 * 1024 + 1) },
      ),
    );
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("payload_too_large");
  });

  it("uses one generic response for an unknown submission or token", async () => {
    vi.mocked(getDeletionTokenHash).mockResolvedValue(null);
    const response = await deleteSubmissionRoute(
      jsonRequest("/api/submissions/delete", {
        submissionId: "11111111-1111-4111-8111-111111111111",
        deletionToken: "x".repeat(43),
      }),
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe(
      "invalid_submission_or_token",
    );
    expect(deleteSubmission).not.toHaveBeenCalled();
  });

  it("delegates validated submission creation to the server-only contribution boundary", async () => {
    const input = submissionBody();
    vi.mocked(contributeProfile).mockResolvedValue({
      submissionId: "11111111-1111-4111-8111-111111111111",
      deletionToken: "x".repeat(43),
      createdAt: "2026-07-31T00:00:00.000Z",
      retentionUntil: "2027-07-30T00:00:00.000Z",
    });

    const response = await createSubmissionRoute(
      jsonRequest("/api/submissions/create", input),
    );

    expect(response.status).toBe(201);
    expect(contributeProfile).toHaveBeenCalledWith(
      expect.objectContaining({ profile: input.profile }),
    );
  });

  it("returns the contribution boundary's privacy failure without leaking content", async () => {
    const input = submissionBody();
    vi.mocked(contributeProfile).mockRejectedValue(
      new ApiError(
        "privacy_review_required",
        422,
        "개인정보 최종 검토를 통과하지 못했습니다.",
      ),
    );

    const response = await createSubmissionRoute(
      jsonRequest("/api/submissions/create", input),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("privacy_review_required");
  });

  it("protects the retention purge route with the cron secret", async () => {
    const denied = await purgeExpired(
      new Request("https://tcontext.test/api/cron/purge-expired"),
    );
    expect(denied.status).toBe(401);
    expect(purgeExpiredSubmissions).not.toHaveBeenCalled();

    vi.mocked(purgeExpiredSubmissions).mockResolvedValue(3);
    const allowed = await purgeExpired(
      new Request("https://tcontext.test/api/cron/purge-expired", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ ok: true, deletedCount: 3 });
  });
});
