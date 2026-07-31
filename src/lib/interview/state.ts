import { buildInterviewQuestions } from "@/lib/interview/router";
import {
  followUpQuestionSchema,
  MAX_FOLLOW_UPS,
  type AnswerDisposition,
  type FollowUpQuestion,
  type InterviewAnswer,
  type InterviewState,
  type TeacherRole,
} from "@/types/interview";
import type { SchoolLevel } from "@/types/profile";

const nowIso = (): string => new Date().toISOString();

export type CreateInterviewStateInput = {
  schoolLevel: SchoolLevel;
  role: TeacherRole;
  privacyNoticeAccepted: boolean;
  now?: string;
};

export function createInterviewState({
  schoolLevel,
  role,
  privacyNoticeAccepted,
  now = nowIso(),
}: CreateInterviewStateInput): InterviewState {
  return {
    version: "1.0",
    schoolLevel,
    role,
    questions: buildInterviewQuestions({ schoolLevel, role }),
    currentQuestionIndex: 0,
    answers: {},
    followUps: [],
    followUpCount: 0,
    privacyNoticeAccepted,
    startedAt: now,
    updatedAt: now,
  };
}

export function setInterviewAnswer(
  state: InterviewState,
  questionId: string,
  text: string,
  disposition: AnswerDisposition = "answered",
  now = nowIso(),
): InterviewState {
  if (!state.questions.some((question) => question.id === questionId)) {
    throw new Error(`알 수 없는 질문입니다: ${questionId}`);
  }

  const answer: InterviewAnswer = {
    questionId,
    disposition,
    text: disposition === "answered" ? text.trim() : "",
  };

  if (disposition === "answered" && answer.text.length === 0) {
    throw new Error("answered 응답에는 내용이 필요합니다.");
  }

  return {
    ...state,
    answers: { ...state.answers, [questionId]: answer },
    updatedAt: now,
  };
}

export function markQuestionSkipped(
  state: InterviewState,
  questionId: string,
  now?: string,
): InterviewState {
  return setInterviewAnswer(state, questionId, "", "skipped", now);
}

export function markQuestionUnsure(
  state: InterviewState,
  questionId: string,
  now?: string,
): InterviewState {
  return setInterviewAnswer(state, questionId, "", "unsure", now);
}

export function canAddFollowUp(state: InterviewState): boolean {
  return state.followUpCount < MAX_FOLLOW_UPS;
}

/**
 * Inserts one AI-generated follow-up immediately after its source question.
 * The hard limit is enforced here as well as at the API boundary.
 */
export function addFollowUpQuestion(
  state: InterviewState,
  followUpInput: FollowUpQuestion,
  now = nowIso(),
): InterviewState {
  if (!canAddFollowUp(state)) {
    throw new Error(`후속 질문은 최대 ${MAX_FOLLOW_UPS}개까지 가능합니다.`);
  }

  const followUp = followUpQuestionSchema.parse(followUpInput);
  if (
    !state.questions.some(
      (question) => question.id === followUp.basedOnQuestionId,
    )
  ) {
    throw new Error("후속 질문의 근거 질문을 찾을 수 없습니다.");
  }
  if (state.questions.some((question) => question.id === followUp.id)) {
    throw new Error("같은 id의 질문이 이미 존재합니다.");
  }

  const sourceIndex = state.questions.findIndex(
    (question) => question.id === followUp.basedOnQuestionId,
  );
  const insertionIndex = Math.max(
    sourceIndex + 1,
    state.currentQuestionIndex + 1,
  );
  const questions = [...state.questions];
  questions.splice(insertionIndex, 0, followUp);

  return {
    ...state,
    questions,
    followUps: [...state.followUps, followUp],
    followUpCount: state.followUpCount + 1,
    updatedAt: now,
  };
}

export function goToQuestion(
  state: InterviewState,
  index: number,
  now = nowIso(),
): InterviewState {
  const lastIndex = Math.max(0, state.questions.length - 1);
  return {
    ...state,
    currentQuestionIndex: Math.min(Math.max(0, index), lastIndex),
    updatedAt: now,
  };
}

export function goToNextQuestion(
  state: InterviewState,
  now?: string,
): InterviewState {
  return goToQuestion(state, state.currentQuestionIndex + 1, now);
}

export function goToPreviousQuestion(
  state: InterviewState,
  now?: string,
): InterviewState {
  return goToQuestion(state, state.currentQuestionIndex - 1, now);
}

export function isInterviewComplete(state: InterviewState): boolean {
  return state.questions.every((question) =>
    Boolean(state.answers[question.id]),
  );
}
