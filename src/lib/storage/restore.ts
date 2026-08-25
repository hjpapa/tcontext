import { createInterviewState } from "@/lib/interview/state";
import type { InterviewState } from "@/types/interview";

import type { StoredInterviewProgress } from "./schema";

export type RestoredInterview = {
  interview: InterviewState;
  previousCompletedQuestionCount: number;
  restoredQuestionNumber: number;
};

const nowIso = (): string => new Date().toISOString();

/**
 * Rebuilds an interview from the current question bank without inventing any
 * answers. Stored progress is intentionally only a location bookmark.
 */
export function restoreInterviewProgress(
  progress: StoredInterviewProgress,
  now = nowIso(),
): RestoredInterview | null {
  const storedQuestionTotal =
    progress.fixedQuestionIds.length + progress.followUpCount;

  // A completed interview belongs to the review/result flow. Since those
  // documents are never stored in Web Storage, reopening /interview starts
  // safely instead of pretending a completed answer set can be recovered.
  if (
    storedQuestionTotal === 0 ||
    progress.completedQuestionCount >= storedQuestionTotal
  ) {
    return null;
  }

  const interview = createInterviewState({
    schoolLevel: progress.schoolLevel,
    role: progress.role,
    teachingSubject: progress.teachingSubject,
    privacyNoticeAccepted: progress.privacyNoticeAccepted,
    now: progress.startedAt,
  });
  const currentQuestionIndex = interview.questions.findIndex(
    (question) => question.id === progress.currentQuestionId,
  );

  // Follow-up questions and removed/renamed bank questions cannot be rebuilt
  // without their text. Falling back to question one is safer than mapping an
  // old numeric index to a different question.
  const safeQuestionIndex =
    currentQuestionIndex >= 0 ? currentQuestionIndex : 0;

  return {
    interview: {
      ...interview,
      currentQuestionIndex: safeQuestionIndex,
      answers: {},
      followUps: [],
      followUpCount: 0,
      updatedAt: now,
    },
    previousCompletedQuestionCount: progress.completedQuestionCount,
    restoredQuestionNumber: safeQuestionIndex + 1,
  };
}
