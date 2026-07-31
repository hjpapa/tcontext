import { z } from "zod";

import { teacherRoleSchema, type InterviewState } from "@/types/interview";
import { schoolLevelSchema } from "@/types/profile";

export const storedInterviewProgressSchema = z
  .object({
    version: z.literal("1.0"),
    schoolLevel: schoolLevelSchema,
    role: teacherRoleSchema,
    currentQuestionId: z.string().min(1),
    currentQuestionIndex: z.number().int().nonnegative(),
    fixedQuestionIds: z.array(z.string().min(1)),
    completedQuestionCount: z.number().int().nonnegative(),
    followUpCount: z.number().int().min(0).max(4),
    privacyNoticeAccepted: z.boolean(),
    startedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type StoredInterviewProgress = z.infer<
  typeof storedInterviewProgressSchema
>;

/**
 * Explicit allowlist serializer. In particular, `answers` and follow-up text
 * cannot reach Web Storage even if InterviewState later gains more fields.
 */
export function toStoredInterviewProgress(
  state: InterviewState,
): StoredInterviewProgress {
  const currentQuestion =
    state.questions[state.currentQuestionIndex] ?? state.questions[0];
  if (!currentQuestion) {
    throw new Error("저장할 인터뷰 질문이 없습니다.");
  }

  return storedInterviewProgressSchema.parse({
    version: "1.0",
    schoolLevel: state.schoolLevel,
    role: state.role,
    currentQuestionId: currentQuestion.id,
    currentQuestionIndex: state.currentQuestionIndex,
    fixedQuestionIds: state.questions
      .filter((question) => question.source !== "follow_up")
      .map((question) => question.id),
    completedQuestionCount: Object.keys(state.answers).length,
    followUpCount: state.followUpCount,
    privacyNoticeAccepted: state.privacyNoticeAccepted,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
  });
}
