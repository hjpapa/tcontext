import { randomUUID } from "node:crypto";

import { runStructuredResponse } from "@/lib/ai/client";
import {
  OPENAI_MODELS,
  OPENAI_REASONING_EFFORT,
  OPENAI_TIMEOUT_MS,
} from "@/lib/ai/models";
import { INTERVIEW_FOLLOW_UP_INSTRUCTIONS } from "@/lib/ai/prompts/interview";
import { followUpDecisionSchema } from "@/lib/ai/schemas/follow-up";
import { hasUnsupportedGeneratedCharacters } from "@/lib/ai/text-quality";
import type { z } from "zod";
import type { followUpRequestSchema } from "@/lib/ai/schemas/requests";
import type { FollowUpQuestion } from "@/types/interview";

type FollowUpInput = z.output<typeof followUpRequestSchema>;

export async function decideFollowUp(input: FollowUpInput): Promise<{
  needed: boolean;
  question: FollowUpQuestion | null;
}> {
  const result = await runStructuredResponse({
    operation: "follow_up",
    model: OPENAI_MODELS.interview,
    effort: OPENAI_REASONING_EFFORT.interview,
    instructions: INTERVIEW_FOLLOW_UP_INSTRUCTIONS,
    input: JSON.stringify({
      schoolLevel: input.schoolLevel,
      role: input.role,
      teachingSubject: input.teachingSubject ?? null,
      current: input.current,
      previousAnswers: input.previousAnswers,
      remainingFollowUps: Math.max(0, 4 - input.followUpCount),
    }),
    schema: followUpDecisionSchema,
    schemaName: "tcontext_follow_up",
    maxOutputTokens: 2_000,
    retryMaxOutputTokens: 4_000,
    missingParsedFallback: { needed: false, question: null },
    timeoutMs: OPENAI_TIMEOUT_MS.interview,
  });

  if (
    !result.needed ||
    !result.question ||
    hasUnsupportedGeneratedCharacters(result.question)
  ) {
    return { needed: false, question: null };
  }

  return {
    needed: true,
    question: {
      id: `follow-up-${randomUUID()}`,
      moduleId: input.current.moduleId,
      source: "follow_up",
      prompt: result.question.prompt,
      intent: result.question.intent,
      example: result.question.example,
      privacyHint: result.question.privacyHint,
      required: false,
      basedOnQuestionId: input.current.questionId,
    },
  };
}
