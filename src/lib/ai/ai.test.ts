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
import { reviewProfileWithAI } from "@/lib/ai/privacy";
import { generateProfile, refineProfile } from "@/lib/ai/profile";
import { privacyReviewCandidatesOutputSchema } from "@/lib/ai/schemas/privacy";
import { profileGenerationOutputSchema } from "@/lib/ai/schemas/profile";
import {
  PROFILE_MODULE_IDS,
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
      promptVersion: "1.1",
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

  it("keeps the privacy candidate schema JSON-Schema compatible", () => {
    expect(() =>
      zodTextFormat(
        privacyReviewCandidatesOutputSchema,
        "tcontext_privacy_review_candidates",
      ),
    ).not.toThrow();
  });

  it("rejects generated evidence IDs that were not supplied as answers", async () => {
    const generated = teacherProfileFixture();
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
    const generated = teacherProfileFixture();
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
  });

  it("preserves everything outside the requested refine scope", async () => {
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
        basis: "direct",
        evidenceQuestionIds: ["q-1"],
        confirmedByUser: true,
      },
    ];
    const lockedUnconfirmedClaim = target.claims[0];
    const lockedConfirmedClaim = target.claims[1];
    if (!lockedUnconfirmedClaim || !lockedConfirmedClaim) {
      throw new Error("locked fixture claims are missing");
    }

    const generated = structuredClone(original);
    generated.profileTitle = "AI changed the global title";
    generated.shortSummary = "AI changed the global summary";
    generated.teachingDesignPrinciples = ["AI changed a principle"];
    generated.classSupportConsiderations = ["AI changed a support"];
    generated.realisticConstraints = ["AI changed a constraint"];
    generated.aiCollaborationInstructions = ["AI changed an instruction"];
    generated.confirmedTags.preferredTeachingMethods = ["inquiry"];
    for (const profileModule of generated.modules) {
      profileModule.title = `AI changed ${profileModule.id} title`;
      profileModule.summary = `AI changed ${profileModule.id} summary`;
      profileModule.claims = profileModule.claims.map((claim) => ({
        ...claim,
        text: `AI changed ${claim.id}`,
        confirmedByUser: false,
      }));
    }
    const generatedTarget = generated.modules.find(
      (profileModule) => profileModule.id === "educational_philosophy",
    );
    if (!generatedTarget) throw new Error("generated target module is missing");
    generatedTarget.claims = [
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
        basis: "inferred",
        evidenceQuestionIds: ["q-1"],
        confirmedByUser: true,
      },
      {
        id: "new-target",
        text: "Unrequested new statement.",
        basis: "inferred",
        evidenceQuestionIds: ["q-1"],
        confirmedByUser: false,
      },
    ];
    generated.modules.reverse();

    setOpenAIClientForTests({
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: { profile: generated },
          usage: null,
        }),
      },
    } as unknown as OpenAI);

    const refined = await refineProfile({
      profile: original,
      instruction: "Revise only the selected statement.",
      moduleId: "educational_philosophy",
      editableClaimIds: ["editable-target"],
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
    expect(refinedTarget?.title).toBe(
      "AI changed educational_philosophy title",
    );
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

  it("computes needs_review from an exact validated AI candidate", async () => {
    const profile = teacherProfileFixture();
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
      review: {
        status: "needs_review",
        items: [
          {
            text: profile.shortSummary,
            reason: "구체적인 단서의 조합으로 개인을 추정할 수 있습니다.",
            suggestedRewrite: "개인을 특정하지 않는 학급 수준 설명",
          },
        ],
      },
    });
    expect(result.review.items[0]).not.toHaveProperty("path");
    expect(result.review.items[0]).not.toHaveProperty("category");
  });
});
