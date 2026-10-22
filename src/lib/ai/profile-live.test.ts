// @vitest-environment node
import { loadEnvFile } from "node:process";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { COMMON_QUESTIONS } from "@/content/questions/common";
import { profileGenerateRequestSchema } from "@/lib/ai/schemas/requests";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";

vi.mock("server-only", () => ({}));

// Opt-in only: no real teacher answers, saved generated profiles or DB writes.
// Assertions expose booleans/counts rather than interview or model text.
const cases = [
  {
    name: "independent-thinking-with-low-preparation",
    answers: {
      "common-personal-value": "스스로 생각하는 게 중요해요.",
      "common-environment": "준비할 시간이 별로 없어요.",
      "common-ai-boundaries": "최종 판단은 제가 할게요.",
    },
    concepts: [/생각|사고|질문|힌트/u, /준비|재사용|간단|부담/u],
  },
  {
    name: "predictable-steps-with-comparison",
    answers: {
      "common-personal-value": "예측 가능한 약속을 중요하게 생각해요.",
      "common-lesson-flow": "할 일을 순서대로 짧게 안내해요.",
      "common-ai-response": "대안 두 개를 장단점으로 비교해 주세요.",
    },
    concepts: [/순서|단계|예측|절차/u, /대안|비교|장단점/u],
  },
  {
    name: "ambiguous-fairness",
    answers: {
      "common-personal-value": "공정함이 중요해요.",
    },
    concepts: [/공정/u],
  },
] as const;

describe.skipIf(process.env.RUN_PROFILE_LIVE_EVAL !== "1")(
  "live short-answer profile evaluation",
  () => {
    beforeAll(async () => {
      try {
        loadEnvFile(".env.local");
      } catch {
        /* CI can provide environment variables. */
      }
      if (!process.env.OPENAI_API_KEY?.trim())
        throw new Error("Live evaluation needs OPENAI_API_KEY.");
      const { OPENAI_MODELS, OPENAI_REASONING_EFFORT } =
        await import("./models");
      expect(OPENAI_MODELS.profile).toBe("gpt-6-luna");
      expect(OPENAI_REASONING_EFFORT.profile).toBe("medium");
    });

    it.each(cases)(
      "$name",
      async (scenario) => {
        const input = profileGenerateRequestSchema.parse({
          schoolLevel: "elementary",
          role: "homeroom_teacher",
          answers: Object.entries(scenario.answers).map(
            ([questionId, answer]) => {
              const question = COMMON_QUESTIONS.find(
                (item) => item.id === questionId,
              )!;
              return {
                questionId,
                moduleId: question.moduleId,
                question: question.prompt,
                answer,
              };
            },
          ),
        });
        const { generateProfile } = await import("./profile");
        const startedAt = Date.now();
        let result: Awaited<ReturnType<typeof generateProfile>>;
        try {
          result = await generateProfile(input);
        } catch {
          // SDK/Zod errors may contain response data. Never let the runner print them.
          throw new Error(
            `Live profile generation failed for ${scenario.name}; inspect safe request metadata.`,
          );
        }
        const { profile } = result;
        const claims = profile.modules.flatMap((module) => module.claims);
        const inferences = claims.filter((claim) => claim.basis === "inferred");
        const pending = claims.filter(
          (claim) => claim.basis === "needs_confirmation",
        );
        const actionable = [
          ...inferences.map((claim) => claim.text),
          ...profile.teachingDesignPrinciples,
          ...profile.aiCollaborationInstructions,
        ].join("\n");
        const answerIds = new Set(
          input.answers.map((answer) => answer.questionId),
        );
        const markdown = profileToMarkdown(profile);
        const checks = {
          sevenModules: profile.modules.length === 7,
          groundedIds: claims.every(
            (claim) =>
              claim.evidenceQuestionIds.length > 0 &&
              claim.evidenceQuestionIds.every((id) => answerIds.has(id)),
          ),
          unconfirmed: claims.every((claim) => !claim.confirmedByUser),
          expanded:
            scenario.name === "ambiguous-fairness"
              ? pending.length > 0
              : inferences.length >= 2,
          actionable:
            profile.teachingDesignPrinciples.length > 0 &&
            profile.aiCollaborationInstructions.length > 0,
          relevantConcepts: scenario.concepts.every((pattern) =>
            pattern.test(actionable),
          ),
          noInventedClassNumbers:
            !/\d+\s*(?:명|학년|반|분|대)(?:\s|[,.]|이다|입니다)/u.test(
              claims.map((claim) => claim.text).join("\n"),
            ),
          noTypes: !/MBTI|[IE][NS][TF][JP]|성격\s*유형/u.test(markdown),
          privacyClear: profile.privacyReview.status === "clear",
          exportPreservesClaims: claims.every((claim) =>
            markdown.includes(claim.text),
          ),
        };
        console.info("profile_live_eval", {
          scenario: scenario.name,
          model: profile.metadata.modelName,
          effort: "medium",
          durationMs: Date.now() - startedAt,
          claims: claims.length,
          inferences: inferences.length,
          needsConfirmation: pending.length,
          checks,
        });
        for (const [check, passed] of Object.entries(checks))
          expect(passed, `${scenario.name}: ${check}`).toBe(true);
      },
      120_000,
    );
  },
);
