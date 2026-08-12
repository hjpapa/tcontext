import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  resetOpenAIClientForTests,
  runStructuredResponse,
  setOpenAIClientForTests,
} from "@/lib/ai/client";
import { decideFollowUp } from "@/lib/ai/follow-up";
import { reviewProfileWithAI } from "@/lib/ai/privacy";
import { generateProfile, refineProfile } from "@/lib/ai/profile";
import { privacyReviewCandidatesOutputSchema } from "@/lib/ai/schemas/privacy";
import {
  profileGenerationOutputSchema,
  profileModuleRefineOutputSchema,
} from "@/lib/ai/schemas/profile";
import {
  PROFILE_MODULE_IDS,
  type ProfileModule,
  type TeacherContextProfile,
} from "@/types/profile";

function teacherProfileFixture(): TeacherContextProfile {
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
    shortSummary: "Supports discussion and revision.",
    modules: PROFILE_MODULE_IDS.map((id, index) => ({
      id,
      title: `${id} title`,
      summary: `${id} summary`,
      claims: [
        {
          id: `claim-${index + 1}`,
          text: `Support statement ${index + 1}`,
          basis: "direct",
          evidenceQuestionIds: ["q-1"],
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

function generatedProfileFixture(): TeacherContextProfile {
  const profile = teacherProfileFixture();
  profile.modules = profile.modules.map((module, index) => ({
    ...module,
    claims: [
      {
        ...module.claims[0]!,
        confirmedByUser: false,
      },
      {
        id: `${module.id}-inferred-${index + 1}`,
        text: `Grounded inference ${index + 1}`,
        basis: "inferred",
        evidenceQuestionIds: ["q-1"],
        confirmedByUser: false,
      },
    ],
  }));
  profile.teachingDesignPrinciples.push("Connect feedback to revision.");
  profile.classSupportConsiderations.push("Keep participation low risk.");
  profile.aiCollaborationInstructions.push("Show reasoning for review.");
  return profile;
}

describe("OpenAI structured boundary", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  });

  afterEach(() => {
    resetOpenAIClientForTests();
    vi.restoreAllMocks();
  });

  it("always sends store:false and re-validates parsed output", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { answer: "검증된 응답" },
      usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const result = await runStructuredResponse({
      operation: "follow_up",
      model: "gpt-5-nano",
      effort: "minimal",
      instructions: "테스트",
      input: "민감한 테스트 본문",
      schema: z.object({ answer: z.string() }).strict(),
      schemaName: "test_schema",
      maxOutputTokens: 100,
      timeoutMs: 1_000,
    });

    expect(result).toEqual({ answer: "검증된 응답" });
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-nano",
        store: false,
        reasoning: { effort: "minimal" },
      }),
      expect.objectContaining({ maxRetries: 0, timeout: 1_000 }),
    );
  });

  it("does not include request or response bodies in logs", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { answer: "비밀 응답 본문" },
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    await runStructuredResponse({
      operation: "follow_up",
      model: "gpt-5-nano",
      effort: "minimal",
      instructions: "테스트",
      input: "김민수 학생의 비밀 입력",
      schema: z.object({ answer: z.string() }).strict(),
      schemaName: "test_schema",
      maxOutputTokens: 100,
      timeoutMs: 1_000,
    });

    const serializedLogs = JSON.stringify(log.mock.calls);
    expect(serializedLogs).not.toContain("김민수");
    expect(serializedLogs).not.toContain("비밀 응답");
    expect(serializedLogs).toContain("gpt-5-nano");
  });

  it("retries max-output incompletes exactly once with a larger token budget", async () => {
    const retryLog = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const successLog = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const parse = vi
      .fn()
      .mockResolvedValueOnce({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_parsed: null,
        usage: { input_tokens: 7, output_tokens: 2_000, total_tokens: 2_007 },
      })
      .mockResolvedValueOnce({
        status: "completed",
        incomplete_details: null,
        output_parsed: { answer: "재시도에서 검증된 응답" },
        usage: { input_tokens: 7, output_tokens: 501, total_tokens: 508 },
      });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const result = await runStructuredResponse({
      operation: "follow_up",
      model: "gpt-5.6-luna",
      effort: "none",
      instructions: "테스트",
      input: "로그에 남으면 안 되는 입력 본문",
      schema: z.object({ answer: z.string() }).strict(),
      schemaName: "test_retry_schema",
      maxOutputTokens: 2_000,
      retryMaxOutputTokens: 4_000,
      timeoutMs: 1_000,
    });

    expect(result).toEqual({ answer: "재시도에서 검증된 응답" });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        reasoning: { effort: "none" },
        max_output_tokens: 2_000,
      }),
    );
    expect(parse.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        reasoning: { effort: "none" },
        max_output_tokens: 4_000,
      }),
    );

    const serializedLogs = JSON.stringify([
      ...retryLog.mock.calls,
      ...successLog.mock.calls,
    ]);
    expect(serializedLogs).toContain("incomplete");
    expect(serializedLogs).toContain("max_output_tokens");
    expect(serializedLogs).toContain("inputTokens");
    expect(serializedLogs).not.toContain("로그에 남으면 안 되는 입력 본문");
    expect(serializedLogs).not.toContain("재시도에서 검증된 응답");
  });

  it("falls back to no follow-up after the single max-output retry", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const parse = vi.fn().mockResolvedValue({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output_parsed: null,
      usage: { input_tokens: 10, output_tokens: 4_000, total_tokens: 4_010 },
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const result = await decideFollowUp({
      schoolLevel: "elementary",
      role: "homeroom_teacher",
      current: {
        questionId: "q-1",
        moduleId: "identity_and_role",
        question: "최근 수업 장면을 알려 주세요.",
        answer: "디지털 기기를 활용하는 수업을 잘하는 것 같습니다.",
      },
      previousAnswers: [],
      followUpCount: 0,
    });

    expect(result).toEqual({ needed: false, question: null });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls.map((call) => call[0].max_output_tokens)).toEqual([
      2_000, 4_000,
    ]);
    expect(parse.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ reasoning: { effort: "none" } }),
    );
  });

  it("does not retry a non-token incomplete follow-up response", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const parse = vi.fn().mockResolvedValue({
      status: "incomplete",
      incomplete_details: { reason: "content_filter" },
      output_parsed: null,
      usage: { input_tokens: 10, output_tokens: 0, total_tokens: 10 },
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const result = await decideFollowUp({
      schoolLevel: "elementary",
      role: "homeroom_teacher",
      current: {
        questionId: "q-1",
        moduleId: "identity_and_role",
        question: "최근 수업 장면을 알려 주세요.",
        answer: "디지털 기기를 활용하는 수업을 잘하는 것 같습니다.",
      },
      previousAnswers: [],
      followUpCount: 0,
    });

    expect(result).toEqual({ needed: false, question: null });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("keeps missing structured profile and privacy responses as errors", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const parse = vi.fn().mockResolvedValue({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output_parsed: null,
      usage: { input_tokens: 3, output_tokens: 100, total_tokens: 103 },
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    await expect(
      runStructuredResponse({
        operation: "privacy_review",
        model: "gpt-5.6-terra",
        effort: "low",
        instructions: "테스트",
        input: "입력",
        schema: z.object({ items: z.array(z.string()) }).strict(),
        schemaName: "test_privacy_schema",
        maxOutputTokens: 100,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: "ai_invalid_response", status: 502 });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid parsed response", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setOpenAIClientForTests({
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: { answer: 123 },
          usage: null,
        }),
      },
    } as unknown as OpenAI);

    await expect(
      runStructuredResponse({
        operation: "follow_up",
        model: "gpt-5-nano",
        effort: "minimal",
        instructions: "테스트",
        input: "입력",
        schema: z.object({ answer: z.string() }).strict(),
        schemaName: "test_schema",
        maxOutputTokens: 100,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({
      code: "ai_invalid_response",
      status: 502,
    });
  });

  it("maps the SDK timeout to a stable 504 error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setOpenAIClientForTests({
      responses: {
        parse: vi
          .fn()
          .mockRejectedValue(new OpenAI.APIConnectionTimeoutError()),
      },
    } as unknown as OpenAI);

    await expect(
      runStructuredResponse({
        operation: "follow_up",
        model: "gpt-5-nano",
        effort: "minimal",
        instructions: "테스트",
        input: "입력",
        schema: z.object({ answer: z.string() }).strict(),
        schemaName: "test_schema",
        maxOutputTokens: 100,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "ai_timeout", status: 504 });
  });

  it("accepts only controlled suggested-tag category/value pairs", () => {
    const suggestedTags =
      profileGenerationOutputSchema.shape.suggestedTags.element;
    expect(
      suggestedTags.safeParse({
        category: "participationPriorities",
        tag: "revision",
      }).success,
    ).toBe(true);
    expect(
      suggestedTags.safeParse({
        category: "participationPriorities",
        tag: "limited_time",
      }).success,
    ).toBe(false);
  });

  it("keeps the profile Structured Output schema JSON-Schema compatible", () => {
    expect(() =>
      zodTextFormat(
        profileGenerationOutputSchema,
        "tcontext_profile_generation",
      ),
    ).not.toThrow();
  });

  it("keeps the compact module-refine schema JSON-Schema compatible", () => {
    expect(() =>
      zodTextFormat(
        profileModuleRefineOutputSchema,
        "tcontext_profile_module_refine",
      ),
    ).not.toThrow();
  });

  it("allows one grounded claim for sparse answers and caps modules at four", () => {
    const generated = generatedProfileFixture();
    expect(
      profileGenerationOutputSchema.safeParse({
        profile: generated,
        suggestedTags: [],
      }).success,
    ).toBe(true);

    generated.modules[0]!.claims = generated.modules[0]!.claims.slice(0, 1);
    expect(
      profileGenerationOutputSchema.safeParse({
        profile: generated,
        suggestedTags: [],
      }).success,
    ).toBe(true);

    const firstClaim = generated.modules[0]!.claims[0]!;
    generated.modules[0]!.claims = Array.from({ length: 5 }, (_, index) => ({
      ...firstClaim,
      id: `identity-claim-${index + 1}`,
    }));
    expect(
      profileGenerationOutputSchema.safeParse({
        profile: generated,
        suggestedTags: [],
      }).success,
    ).toBe(false);
  });

  it("keeps the privacy candidate schema JSON-Schema compatible", () => {
    expect(() =>
      zodTextFormat(
        privacyReviewCandidatesOutputSchema,
        "tcontext_privacy_review_candidates",
      ),
    ).not.toThrow();
  });

  it("rejects generated evidence IDs that were not supplied as answers", async () => {
    const generated = generatedProfileFixture();
    const generatedClaim = generated.modules[0]?.claims[0];
    if (!generatedClaim) throw new Error("fixture claim is missing");
    generatedClaim.evidenceQuestionIds = ["q-1", "invented-question"];
    setOpenAIClientForTests({
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: { profile: generated, suggestedTags: [] },
          usage: null,
        }),
      },
    } as unknown as OpenAI);

    await expect(
      generateProfile({
        schoolLevel: "elementary",
        role: "homeroom_teacher",
        answers: [
          {
            questionId: "q-1",
            moduleId: "identity_and_role",
            question: "What helps your class learn?",
            answer: "Discussion and revision time help.",
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "ai_invalid_response",
      status: 502,
    });
  });

  it("accepts generated evidence IDs drawn only from supplied answers", async () => {
    const generated = generatedProfileFixture();
    const generatedClaim = generated.modules[0]?.claims[0];
    if (!generatedClaim) throw new Error("fixture claim is missing");
    generatedClaim.evidenceQuestionIds = ["q-1", "q-2"];
    setOpenAIClientForTests({
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: { profile: generated, suggestedTags: [] },
          usage: null,
        }),
      },
    } as unknown as OpenAI);

    const result = await generateProfile({
      schoolLevel: "elementary",
      role: "homeroom_teacher",
      answers: [
        {
          questionId: "q-1",
          moduleId: "identity_and_role",
          question: "What helps your class learn?",
          answer: "Discussion helps.",
        },
        {
          questionId: "q-2",
          moduleId: "educational_philosophy",
          question: "What helps students revise?",
          answer: "Specific feedback helps.",
        },
      ],
    });

    expect(result.profile.modules[0]?.claims[0]?.evidenceQuestionIds).toEqual([
      "q-1",
      "q-2",
    ]);
    expect(result.profile.modules[0]?.claims.map((claim) => claim.id)).toEqual([
      "identity_and_role:claim:1",
      "identity_and_role:claim:2",
    ]);
  });

  it("maps invalid generated module composition to an AI response error", async () => {
    const generated = generatedProfileFixture();
    generated.modules[1] = {
      ...generated.modules[1]!,
      id: generated.modules[0]!.id,
    };
    setOpenAIClientForTests({
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: { profile: generated, suggestedTags: [] },
          usage: null,
        }),
      },
    } as unknown as OpenAI);

    await expect(
      generateProfile({
        schoolLevel: "elementary",
        role: "homeroom_teacher",
        answers: [
          {
            questionId: "q-1",
            moduleId: "identity_and_role",
            question: "What guides your lesson design?",
            answer: "Discussion and revision guide my lesson design.",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "ai_invalid_response", status: 502 });
  });

  it("retries an output-limited rich profile generation with more tokens", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const generated = generatedProfileFixture();
    const parse = vi
      .fn()
      .mockResolvedValueOnce({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_parsed: null,
        usage: { input_tokens: 500, output_tokens: 8_000, total_tokens: 8_500 },
      })
      .mockResolvedValueOnce({
        status: "completed",
        output_parsed: { profile: generated, suggestedTags: [] },
        usage: { input_tokens: 500, output_tokens: 5_000, total_tokens: 5_500 },
      });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    await generateProfile({
      schoolLevel: "elementary",
      role: "homeroom_teacher",
      answers: [
        {
          questionId: "q-1",
          moduleId: "identity_and_role",
          question: "What guides your lesson design?",
          answer: "I connect discussion, feedback, and revision.",
        },
      ],
    });

    expect(parse.mock.calls.map((call) => call[0].max_output_tokens)).toEqual([
      8_000, 16_000,
    ]);
  });

  it("refines only unconfirmed claims in the requested module", async () => {
    const original = teacherProfileFixture();
    const target = original.modules.find(
      (profileModule) => profileModule.id === "educational_philosophy",
    );
    if (!target) throw new Error("fixture target module is missing");
    target.claims = [
      {
        id: "locked-unconfirmed",
        text: "Keep this unconfirmed statement unchanged.",
        basis: "inferred",
        evidenceQuestionIds: ["q-1"],
        confirmedByUser: false,
      },
      {
        id: "locked-confirmed",
        text: "Keep this confirmed statement unchanged.",
        basis: "direct",
        evidenceQuestionIds: ["q-1"],
        confirmedByUser: true,
      },
      {
        id: "editable-target",
        text: "Original editable statement.",
        basis: "inferred",
        evidenceQuestionIds: ["q-1"],
        confirmedByUser: false,
      },
    ];
    const lockedUnconfirmedClaim = target.claims[0];
    const lockedConfirmedClaim = target.claims[1];
    if (!lockedUnconfirmedClaim || !lockedConfirmedClaim) {
      throw new Error("locked fixture claims are missing");
    }

    const generatedTarget: (typeof original.modules)[number] = {
      ...structuredClone(target),
      title: "AI changed educational_philosophy title",
      summary: "AI changed educational_philosophy summary",
      claims: [
        {
          id: "locked-unconfirmed",
          text: "AI attempted to change a locked statement.",
          basis: "direct",
          evidenceQuestionIds: ["q-1"],
          confirmedByUser: true,
        },
        {
          id: "locked-confirmed",
          text: "AI also attempted to change a confirmed locked statement.",
          basis: "inferred",
          evidenceQuestionIds: ["q-1"],
          confirmedByUser: false,
        },
        {
          id: "editable-target",
          text: "Edited statement.",
          basis: "direct",
          evidenceQuestionIds: ["invented-evidence"],
          confirmedByUser: true,
        },
        {
          id: "new-target",
          text: "Unrequested new statement.",
          basis: "inferred",
          evidenceQuestionIds: ["q-1"],
          confirmedByUser: false,
        },
      ],
    };

    const parse = vi.fn().mockResolvedValue({
      output_parsed: { module: generatedTarget },
      usage: null,
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const refined = await refineProfile({
      profile: original,
      instruction: "Revise only the selected statement.",
      moduleId: "educational_philosophy",
      editableClaimIds: ["locked-confirmed", "editable-target"],
    });

    expect(refined.metadata).toEqual(original.metadata);
    expect(refined.profileTitle).toBe(original.profileTitle);
    expect(refined.shortSummary).toBe(original.shortSummary);
    expect(refined.teachingDesignPrinciples).toEqual(
      original.teachingDesignPrinciples,
    );
    expect(refined.classSupportConsiderations).toEqual(
      original.classSupportConsiderations,
    );
    expect(refined.realisticConstraints).toEqual(original.realisticConstraints);
    expect(refined.aiCollaborationInstructions).toEqual(
      original.aiCollaborationInstructions,
    );
    expect(refined.confirmedTags).toEqual(original.confirmedTags);
    expect(refined.modules.map((profileModule) => profileModule.id)).toEqual(
      original.modules.map((profileModule) => profileModule.id),
    );

    const isOutsideTarget = (
      profileModule: TeacherContextProfile["modules"][number],
    ) => profileModule.id !== "educational_philosophy";
    expect(refined.modules.filter(isOutsideTarget)).toEqual(
      original.modules.filter(isOutsideTarget),
    );

    const refinedTarget = refined.modules.find(
      (profileModule) => profileModule.id === "educational_philosophy",
    );
    expect(refinedTarget?.title).toBe(target.title);
    expect(refinedTarget?.summary).toBe(
      "AI changed educational_philosophy summary",
    );
    expect(refinedTarget?.claims).toEqual([
      lockedUnconfirmedClaim,
      lockedConfirmedClaim,
      {
        id: "editable-target",
        text: "Edited statement.",
        basis: "inferred",
        evidenceQuestionIds: ["q-1"],
        confirmedByUser: false,
      },
    ]);

    const request = parse.mock.calls[0]?.[0] as
      { input?: string; max_output_tokens?: number } | undefined;
    expect(request?.max_output_tokens).toBe(3_000);
    const requestInput = JSON.parse(request?.input ?? "{}") as {
      editableClaimIds?: string[];
      protectedClaimIds?: string[];
      targetModule?: ProfileModule;
      profile?: unknown;
    };
    expect(requestInput.editableClaimIds).toEqual(["editable-target"]);
    expect(requestInput.protectedClaimIds).toContain("locked-confirmed");
    expect(requestInput.targetModule?.id).toBe("educational_philosophy");
    expect(requestInput).not.toHaveProperty("profile");
  });

  it("retries an incomplete module refinement and preserves a missing edit", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const original = teacherProfileFixture();
    const target = original.modules.find(
      (profileModule) => profileModule.id === "educational_philosophy",
    );
    if (!target) throw new Error("fixture target module is missing");
    const editableClaim = target.claims[0];
    if (!editableClaim) throw new Error("fixture editable claim is missing");
    editableClaim.confirmedByUser = false;

    const parse = vi
      .fn()
      .mockResolvedValueOnce({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_parsed: null,
        usage: { input_tokens: 100, output_tokens: 3_000, total_tokens: 3_100 },
      })
      .mockResolvedValueOnce({
        status: "completed",
        output_parsed: {
          module: {
            ...structuredClone(target),
            title: "Refined title",
            claims: [],
          },
        },
        usage: { input_tokens: 100, output_tokens: 400, total_tokens: 500 },
      });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const refined = await refineProfile({
      profile: original,
      instruction: "Make the module more concrete.",
      moduleId: "educational_philosophy",
      editableClaimIds: [editableClaim.id],
    });

    expect(parse.mock.calls.map((call) => call[0].max_output_tokens)).toEqual([
      3_000, 6_000,
    ]);
    expect(
      refined.modules.find((module) => module.id === target.id)?.claims,
    ).toEqual(target.claims);
  });

  it("does not send a previous privacy finding back during a full refinement", async () => {
    const original = teacherProfileFixture();
    original.privacyReview = {
      status: "needs_review",
      items: [
        {
          text: "stale-person@example.com",
          reason: "이전 검사에서 발견한 연락처",
          suggestedRewrite: "연락처를 삭제합니다.",
        },
      ],
    };
    const generated = structuredClone(original);
    generated.privacyReview = { status: "clear", items: [] };
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { profile: generated },
      usage: null,
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    await refineProfile({
      profile: original,
      instruction: "문서 전체의 표현을 정돈해 주세요.",
      editableClaimIds: [],
    });

    const request = parse.mock.calls[0]?.[0] as { input?: string } | undefined;
    const requestInput = JSON.parse(request?.input ?? "{}") as {
      profile?: TeacherContextProfile;
    };
    expect(requestInput.profile?.privacyReview).toEqual({
      status: "clear",
      items: [],
    });
    expect(request?.input).not.toContain("stale-person@example.com");
  });

  it("sends only authored fields to the final AI privacy review", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { items: [] },
      usage: null,
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);
    const profile = teacherProfileFixture();
    const firstClaim = profile.modules[0]?.claims[0];
    if (!firstClaim) throw new Error("fixture claim is missing");
    profile.metadata.modelName = "teacher@example.com";
    firstClaim.id = "010-1234-5678";
    firstClaim.evidenceQuestionIds = ["evidence@example.com"];
    profile.privacyReview = {
      status: "needs_review",
      items: [
        {
          text: "stale@example.com",
          reason: "stale prior review",
          suggestedRewrite: "remove the stale item",
        },
      ],
    };

    const result = await reviewProfileWithAI(profile);

    expect(result).toEqual({
      source: "openai",
      review: { status: "clear", items: [] },
    });
    const request = parse.mock.calls[0]?.[0] as { input?: string } | undefined;
    expect(request?.input).toBeTypeOf("string");
    const input = JSON.parse(request?.input ?? "{}") as {
      fields?: Array<{ path: string; text: string }>;
    };
    expect(Object.keys(input)).toEqual(["fields"]);
    expect(input.fields).toContainEqual({
      path: "profile.shortSummary",
      text: "Supports discussion and revision.",
    });
    expect(input.fields?.some((field) => field.path.includes("metadata"))).toBe(
      false,
    );
    expect(input.fields?.some((field) => field.path.endsWith(".id"))).toBe(
      false,
    );
    expect(
      input.fields?.some((field) => field.path.includes("evidenceQuestionIds")),
    ).toBe(false);
    expect(
      input.fields?.some((field) => field.path.includes("confirmedTags")),
    ).toBe(false);
    expect(
      input.fields?.some((field) => field.path.includes("privacyReview")),
    ).toBe(false);
    expect(request?.input).not.toContain("teacher@example.com");
    expect(request?.input).not.toContain("010-1234-5678");
    expect(request?.input).not.toContain("stale@example.com");
  });

  it("stops locally detected authored personal data before OpenAI", async () => {
    const parse = vi.fn();
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);
    const profile = teacherProfileFixture();
    const firstClaim = profile.modules[0]?.claims[0];
    if (!firstClaim) throw new Error("fixture claim is missing");
    firstClaim.text = "김민수 학생의 연락처는 010-1234-5678이다.";

    const result = await reviewProfileWithAI(profile);

    expect(result.source).toBe("local");
    expect(result.review.status).toBe("needs_review");
    expect(parse).not.toHaveBeenCalled();
  });

  it("discards AI candidates whose path or text is not an exact input field", async () => {
    const profile = teacherProfileFixture();
    setOpenAIClientForTests({
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: {
            items: [
              {
                path: "profile.metadata.modelName",
                category: "contact",
                text: profile.metadata.modelName,
                reason: "hallucinated metadata finding",
                suggestedRewrite: "remove it",
              },
              {
                path: "profile.shortSummary",
                category: "combination_risk",
                text: "AI changed the original text.",
                reason: "altered text finding",
                suggestedRewrite: "rewrite it",
              },
            ],
          },
          usage: null,
        }),
      },
    } as unknown as OpenAI);

    const result = await reviewProfileWithAI(profile);

    expect(result).toEqual({
      source: "openai",
      review: { status: "clear", items: [] },
    });
  });

  it("discards AI false positives based only on generic student and class wording", async () => {
    const profile = teacherProfileFixture();
    const firstModule = profile.modules[0];
    if (!firstModule) throw new Error("fixture module is missing");
    profile.shortSummary =
      "교사의 수업 운영 방식은 학생의 선택과 참여를 존중하는 데 초점을 둔다.";
    firstModule.summary = "학급 전체의 참여를 돕는 예측 가능한 흐름을 만든다.";
    profile.teachingDesignPrinciples[0] =
      "우리 학급은 토론과 수정 기회를 중요하게 여긴다.";
    profile.classSupportConsiderations[0] =
      "우리 반 학생들이 안전하게 질문하도록 지원한다.";
    profile.aiCollaborationInstructions[0] =
      "초등학교 학생에게 맞는 일반 표현을 사용한다.";
    profile.realisticConstraints[0] =
      "선택한 학생과 이해한 학생 모두에게 기다릴 시간을 제공한다.";

    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        items: [
          {
            path: "profile.shortSummary",
            category: "person_name",
            text: profile.shortSummary,
            reason: "방식은 학생이라는 표현을 이름으로 판단했습니다.",
            suggestedRewrite: "일반적인 표현으로 바꿉니다.",
          },
          {
            path: "profile.modules.0.summary",
            category: "specific_school_or_class",
            text: firstModule.summary,
            reason: "학급이라는 단어가 있습니다.",
            suggestedRewrite: "학급이라는 단어를 삭제합니다.",
          },
          {
            path: "profile.teachingDesignPrinciples.0",
            category: "combination_risk",
            text: profile.teachingDesignPrinciples[0],
            reason: "우리 학급이라는 표현이 있습니다.",
            suggestedRewrite: "일반적인 표현으로 바꿉니다.",
          },
          {
            path: "profile.classSupportConsiderations.0",
            category: "identifiable_sensitive_context",
            text: profile.classSupportConsiderations[0],
            reason: "우리 반 학생이라는 표현이 있습니다.",
            suggestedRewrite: "일반적인 표현으로 바꿉니다.",
          },
          {
            path: "profile.aiCollaborationInstructions.0",
            category: "person_name",
            text: profile.aiCollaborationInstructions[0],
            reason: "초등학교 학생이라는 표현이 있습니다.",
            suggestedRewrite: "학교급 표현을 삭제합니다.",
          },
          {
            path: "profile.realisticConstraints.0",
            category: "person_name",
            text: profile.realisticConstraints[0],
            reason: "선택한 학생과 이해한 학생이라는 표현이 있습니다.",
            suggestedRewrite: "이름처럼 보이는 표현을 삭제합니다.",
          },
        ],
      },
      usage: null,
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const result = await reviewProfileWithAI(profile);

    expect(result).toEqual({
      source: "openai",
      review: { status: "clear", items: [] },
    });
    const request = parse.mock.calls[0]?.[0] as
      { instructions?: string } | undefined;
    expect(request?.instructions).toContain(
      '"학생", "학생들", "학급", "우리 학급", "우리 반"',
    );
  });

  it("discards AI privacy candidates for anonymous sensitive context and labels", async () => {
    const profile = teacherProfileFixture();
    const firstModule = profile.modules[0];
    const firstClaim = firstModule?.claims[0];
    if (!firstModule || !firstClaim)
      throw new Error("fixture claim is missing");
    profile.shortSummary = "한 학생의 점수는 85점이다.";
    firstModule.summary = "그 학생이 ADHD 진단을 받았다.";
    firstClaim.text = "산만한 학생에게 짧은 활동 순서를 안내한다.";

    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        items: [
          {
            path: "profile.shortSummary",
            category: "identifiable_sensitive_context",
            text: profile.shortSummary,
            reason: "개별 점수가 있습니다.",
            suggestedRewrite: "학급 수준 점수 설명으로 바꿉니다.",
          },
          {
            path: "profile.modules.0.summary",
            category: "identifiable_sensitive_context",
            text: firstModule.summary,
            reason: "진단 정보가 있습니다.",
            suggestedRewrite: "지원 요구로 바꿉니다.",
          },
          {
            path: "profile.modules.0.claims.0.text",
            category: "identifiable_sensitive_context",
            text: firstClaim.text,
            reason: "낙인 표현이 있습니다.",
            suggestedRewrite: "관찰 가능한 지원으로 바꿉니다.",
          },
        ],
      },
      usage: null,
    });
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const result = await reviewProfileWithAI(profile);

    expect(result).toEqual({
      source: "openai",
      review: { status: "clear", items: [] },
    });
    const request = parse.mock.calls[0]?.[0] as
      { instructions?: string } | undefined;
    expect(request?.instructions).toContain(
      '"한 학생", "그 학생", "해당 학생", "학생 한 명"',
    );
    expect(request?.instructions).toContain(
      "그 표현만으로는 개인정보 후보가 아니다",
    );
  });

  it("stops an explicit name and sensitive context locally before AI", async () => {
    const profile = teacherProfileFixture();
    profile.shortSummary = "학생 Alex Kim은 ADHD 진단을 받았다.";
    const parse = vi.fn();
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const result = await reviewProfileWithAI(profile);

    expect(result).toMatchObject({
      source: "local",
      review: { status: "needs_review" },
    });
    expect(parse).not.toHaveBeenCalled();
  });

  it("discards a combination candidate without a direct personal identifier", async () => {
    const profile = teacherProfileFixture();
    profile.shortSummary =
      "지난 4월 12일 시청 과학대회에서 단독 수상한 5학년 학생의 참여를 지원한다.";
    setOpenAIClientForTests({
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: {
            items: [
              {
                path: "profile.shortSummary",
                category: "combination_risk",
                text: profile.shortSummary,
                reason: "구체적인 단서의 조합으로 개인을 추정할 수 있습니다.",
                suggestedRewrite: "개인을 특정하지 않는 학급 수준 설명",
              },
            ],
          },
          usage: null,
        }),
      },
    } as unknown as OpenAI);

    const result = await reviewProfileWithAI(profile);

    expect(result).toEqual({
      source: "openai",
      review: { status: "clear", items: [] },
    });
  });

  it("stops a combination with a direct identifier locally before AI", async () => {
    const profile = teacherProfileFixture();
    profile.shortSummary =
      "Alex Kim 학생은 지난 4월 12일 시청 과학대회에서 단독 수상했다.";
    const parse = vi.fn();
    setOpenAIClientForTests({
      responses: { parse },
    } as unknown as OpenAI);

    const result = await reviewProfileWithAI(profile);

    expect(result).toMatchObject({
      source: "local",
      review: { status: "needs_review" },
    });
    expect(parse).not.toHaveBeenCalled();
  });
});
