import { randomUUID } from "node:crypto";

import {
  COMMON_PRIVACY_HINT,
  KINDERGARTEN_PRIVACY_HINT,
} from "@/content/questions";
import { runStructuredResponse } from "@/lib/ai/client";
import {
  OPENAI_MODELS,
  OPENAI_REASONING_EFFORT,
  OPENAI_TIMEOUT_MS,
} from "@/lib/ai/models";
import { INTERVIEW_FOLLOW_UP_INSTRUCTIONS } from "@/lib/ai/prompts/interview";
import { followUpDecisionSchema } from "@/lib/ai/schemas/follow-up";
import { hasUnsupportedGeneratedCharacters } from "@/lib/ai/text-quality";
import { containsPrivacyRisk } from "@/lib/privacy/detector";
import type { z } from "zod";
import type { followUpRequestSchema } from "@/lib/ai/schemas/requests";
import type { FollowUpQuestion } from "@/types/interview";

type FollowUpInput = z.output<typeof followUpRequestSchema>;

/**
 * The generated prompt is shown to the teacher and echoed back as the
 * `question` of later requests, so a follow-up whose wording trips the
 * detector is skipped rather than shown.
 */
function hasDetectedPrivacyRisk(
  question: Pick<FollowUpQuestion, "prompt" | "intent" | "example">,
) {
  return [question.prompt, question.intent, question.example].some(
    containsPrivacyRisk,
  );
}

// The prompt asks for 80 characters; the extra room allows a short quote.
const MAX_FOLLOW_UP_PROMPT_LENGTH = 100;

/**
 * The teacher answers the prompt as written, so a run-on or two-part
 * question is skipped rather than shown.
 */
function isSingleShortQuestion(prompt: string) {
  const questionMarks = prompt.match(/[?？]/gu) ?? [];
  return (
    prompt.length <= MAX_FOLLOW_UP_PROMPT_LENGTH &&
    questionMarks.length === 1 &&
    /[?？]$/u.test(prompt)
  );
}

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
    hasUnsupportedGeneratedCharacters(result.question) ||
    hasDetectedPrivacyRisk(result.question) ||
    !isSingleShortQuestion(result.question.prompt)
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
      // A fixed hint keeps the guidance consistent with the base questions.
      privacyHint:
        input.schoolLevel === "kindergarten"
          ? KINDERGARTEN_PRIVACY_HINT
          : COMMON_PRIVACY_HINT,
      required: false,
      basedOnQuestionId: input.current.questionId,
    },
  };
}
