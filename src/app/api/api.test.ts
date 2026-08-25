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
import { POST as refineProfileRoute } from "@/app/api/profile/refine/route";
import { POST as createSubmissionRoute } from "@/app/api/submissions/create/route";
import { POST as deleteSubmissionRoute } from "@/app/api/submissions/delete/route";
import { decideFollowUp } from "@/lib/ai/follow-up";
import { generateProfile, refineProfile } from "@/lib/ai/profile";
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
      promptVersion: "1.4",
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

  it("accepts a controlled teaching subject and rejects arbitrary subject text", async () => {
    vi.mocked(decideFollowUp).mockResolvedValue({
      needed: false,
      question: null,
    });
    const validBody = {
      schoolLevel: "middle",
      role: "subject_teacher",
      teachingSubject: "science",
      current: safeExchange,
      previousAnswers: [],
      followUpCount: 0,
    };

    const accepted = await followUp(
      jsonRequest("/api/interview/follow-up", validBody),
    );
    expect(accepted.status).toBe(200);
    expect(decideFollowUp).toHaveBeenCalledWith(validBody);

    vi.mocked(decideFollowUp).mockClear();
    const rejected = await followUp(
      jsonRequest("/api/interview/follow-up", {
        ...validBody,
        teachingSubject: "직접 입력한 교과",
      }),
    );
    expect(rejected.status).toBe(400);
    expect(decideFollowUp).not.toHaveBeenCalled();
  });

  it("accepts a 2,000-character answer and rejects anything longer", async () => {
    vi.mocked(decideFollowUp).mockResolvedValue({
      needed: false,
      question: null,
    });

    const accepted = await followUp(
      jsonRequest("/api/interview/follow-up", {
        schoolLevel: "elementary",
        role: "homeroom_teacher",
        current: { ...safeExchange, answer: "가".repeat(2_000) },
        previousAnswers: [],
        followUpCount: 0,
      }),
    );

    expect(accepted.status).toBe(200);
    expect(decideFollowUp).toHaveBeenCalledOnce();

    vi.mocked(decideFollowUp).mockClear();
    const rejected = await followUp(
      jsonRequest("/api/interview/follow-up", {
        schoolLevel: "elementary",
        role: "homeroom_teacher",
        current: { ...safeExchange, answer: "가".repeat(2_001) },
        previousAnswers: [],
        followUpCount: 0,
      }),
    );

    expect(rejected.status).toBe(400);
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

  it("passes a controlled teaching subject through profile generation", async () => {
    const profile = submissionProfile();
    profile.metadata.schoolLevel = "middle";
    profile.metadata.role = "subject_teacher";
    profile.metadata.teachingSubject = "history";
    vi.mocked(generateProfile).mockResolvedValue({
      profile,
      suggestedTags: [],
    });
    const body = {
      schoolLevel: "middle",
      role: "subject_teacher",
      teachingSubject: "history",
      answers: [safeExchange],
    } as const;

    const response = await generateProfileRoute(
      jsonRequest("/api/profile/generate", body),
    );

    expect(response.status).toBe(200);
    expect(generateProfile).toHaveBeenCalledWith(body);
  });

  it("refines a module when the AI-bound natural language is generic", async () => {
    const profile = submissionProfile();
    profile.metadata.modelName = "teacher@example.com";
    profile.privacyReview = {
      status: "needs_review",
      items: [
        {
          text: "김민수 학생",
          reason: "이전 검사 결과",
          suggestedRewrite: "학생",
        },
      ],
    };
    vi.mocked(refineProfile).mockResolvedValue(profile);

    const response = await refineProfileRoute(
      jsonRequest("/api/profile/refine", {
        profile,
        instruction: "학생의 선택권을 더 구체적으로 설명해 주세요.",
        moduleId: "educational_philosophy",
        editableClaimIds: ["claim-2"],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile });
    expect(refineProfile).toHaveBeenCalledOnce();
  });

  it("refines a module when another summary uses ordinary Korean topic grammar", async () => {
    const profile = submissionProfile();
    const firstModule = profile.modules[0];
    if (!firstModule) throw new Error("Missing profile module fixture");
    firstModule.summary =
      "교사는 보드게임과 사회정서적 주제를 학생의 자발적 학습력으로 연결하는 수업 가능성을 탐색하고 있습니다.";
    vi.mocked(refineProfile).mockResolvedValue(profile);

    const response = await refineProfileRoute(
      jsonRequest("/api/profile/refine", {
        profile,
        instruction: "실제 수업에서 활용하는 문장으로 작성",
        moduleId: "educational_philosophy",
        editableClaimIds: ["claim-2"],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile });
    expect(refineProfile).toHaveBeenCalledOnce();
  });

  it.each([
    "교육관과 학생관 요약",
    "배움은 학생이 스스로 의미를 구성하는 과정입니다.",
    "기다림은 학생의 속도를 존중하는 태도입니다.",
    "선택권은 학생과 함께 정합니다.",
    "주도권은 학생에게 넘깁니다.",
  ])(
    "refines a module when a summary contains non-identifying student language: %s",
    async (summary) => {
      const profile = submissionProfile();
      const firstModule = profile.modules[0];
      if (!firstModule) throw new Error("Missing profile module fixture");
      firstModule.summary = summary;
      vi.mocked(refineProfile).mockResolvedValue(profile);

      const response = await refineProfileRoute(
        jsonRequest("/api/profile/refine", {
          profile,
          instruction: "실제 수업에서 활용하는 문장으로 작성",
          moduleId: "educational_philosophy",
          editableClaimIds: ["claim-2"],
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ profile });
      expect(refineProfile).toHaveBeenCalledOnce();
    },
  );

  it("still blocks a likely name in another module summary", async () => {
    const profile = submissionProfile();
    const firstModule = profile.modules[0];
    if (!firstModule) throw new Error("Missing profile module fixture");
    firstModule.summary = "김다은 학생의 선택을 존중합니다.";

    const response = await refineProfileRoute(
      jsonRequest("/api/profile/refine", {
        profile,
        instruction: "실제 수업에서 활용하는 문장으로 작성",
        moduleId: "educational_philosophy",
        editableClaimIds: ["claim-2"],
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      error: {
        code: "privacy_risk_detected",
        details: {
          findings: [
            {
              category: "student_name",
              path: "profile.modules.0.summary",
            },
          ],
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("김다은");
    expect(refineProfile).not.toHaveBeenCalled();
  });

  it("returns the exact draft field path when a refinement draft is invalid", async () => {
    const profile = submissionProfile();
    profile.profileTitle = "";

    const response = await refineProfileRoute(
      jsonRequest("/api/profile/refine", {
        profile,
        instruction: "선택한 모듈을 더 구체적으로 써 주세요.",
        moduleId: "educational_philosophy",
        editableClaimIds: ["claim-2"],
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "invalid_request",
        details: [{ path: "profile.profileTitle" }],
      },
    });
    expect(refineProfile).not.toHaveBeenCalled();
  });

  it("ignores stale prior-review text that a full refinement does not transmit", async () => {
    const profile = submissionProfile();
    profile.privacyReview = {
      status: "needs_review",
      items: [
        {
          text: "stale-person@example.com",
          reason: "이전 검사 결과",
          suggestedRewrite: "연락처를 삭제합니다.",
        },
      ],
    };
    vi.mocked(refineProfile).mockResolvedValue(profile);

    const response = await refineProfileRoute(
      jsonRequest("/api/profile/refine", {
        profile,
        instruction: "문서 전체의 표현을 정돈해 주세요.",
        editableClaimIds: [],
      }),
    );

    expect(response.status).toBe(200);
    expect(refineProfile).toHaveBeenCalledOnce();
  });

  it("scans metadata that a full refinement would transmit", async () => {
    const profile = submissionProfile();
    profile.metadata.modelName = "teacher@example.com";

    const response = await refineProfileRoute(
      jsonRequest("/api/profile/refine", {
        profile,
        instruction: "문서 전체의 표현을 정돈해 주세요.",
        editableClaimIds: [],
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        code: "privacy_risk_detected",
        details: {
          findings: [
            {
              category: "email",
              path: "profile.metadata.modelName",
            },
          ],
        },
      },
    });
    expect(refineProfile).not.toHaveBeenCalled();
  });

  it("returns only category and path when a refinement contains a direct identifier", async () => {
    const profile = submissionProfile();
    const response = await refineProfileRoute(
      jsonRequest("/api/profile/refine", {
        profile,
        instruction: "김민수 학생의 설명을 더 구체적으로 써 주세요.",
        moduleId: "educational_philosophy",
        editableClaimIds: ["claim-2"],
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "privacy_risk_detected",
        message:
          "이름·연락처 등 명확한 직접 식별정보를 제거한 뒤 다시 시도해 주세요.",
        details: {
          findings: [
            {
              category: "student_name",
              path: "refine.request.instruction",
            },
          ],
        },
      },
    });
    expect(refineProfile).not.toHaveBeenCalled();
  });

  it("blocks a direct identifier in the selected module claim", async () => {
    const profile = submissionProfile();
    const targetClaim = profile.modules.find(
      (module) => module.id === "educational_philosophy",
    )?.claims[0];
    if (!targetClaim) throw new Error("Missing target claim fixture");
    targetClaim.text = "김민수 학생은 토론을 선호합니다.";

    const response = await refineProfileRoute(
      jsonRequest("/api/profile/refine", {
        profile,
        instruction: "선택한 문장을 더 구체적으로 써 주세요.",
        moduleId: "educational_philosophy",
        editableClaimIds: ["claim-2"],
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        code: "privacy_risk_detected",
        details: {
          findings: [
            {
              category: "student_name",
              path: "profile.modules.1.claims.0.text",
            },
          ],
        },
      },
    });
    expect(refineProfile).not.toHaveBeenCalled();
  });

  it("does not scan non-target claims during a module-only refinement", async () => {
    const profile = submissionProfile();
    const nonTargetModule = profile.modules.find(
      (module) => module.id === "class_context",
    );
    const nonTargetClaim = nonTargetModule?.claims[0];
    if (!nonTargetClaim) throw new Error("Missing non-target claim fixture");
    nonTargetClaim.text = "학생 김민수의 전화번호는 010-1234-5678입니다.";
    vi.mocked(refineProfile).mockResolvedValue(profile);

    const response = await refineProfileRoute(
      jsonRequest("/api/profile/refine", {
        profile,
        instruction: "선택한 모듈만 더 구체적으로 써 주세요.",
        moduleId: "educational_philosophy",
        editableClaimIds: ["claim-2"],
      }),
    );

    expect(response.status).toBe(200);
    expect(refineProfile).toHaveBeenCalledOnce();
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
