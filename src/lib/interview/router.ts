import {
  COMMON_QUESTIONS,
  ELEMENTARY_QUESTIONS,
  HIGH_QUESTIONS,
  KINDERGARTEN_QUESTIONS,
  MIDDLE_QUESTIONS,
  ROLE_QUESTIONS,
} from "@/content/questions";
import {
  interviewQuestionSchema,
  type InterviewQuestion,
  type TeacherRole,
} from "@/types/interview";
import type { SchoolLevel } from "@/types/profile";

const SCHOOL_QUESTIONS: Record<SchoolLevel, InterviewQuestion[]> = {
  kindergarten: KINDERGARTEN_QUESTIONS,
  elementary: ELEMENTARY_QUESTIONS,
  middle: MIDDLE_QUESTIONS,
  high: HIGH_QUESTIONS,
};

export type InterviewContext = {
  schoolLevel: SchoolLevel;
  role: TeacherRole;
};

/**
 * Returns the deterministic, semi-structured interview. The bank is always
 * 10 fixed questions: 8 common, 1 school-level, and 1 role question.
 */
export function buildInterviewQuestions({
  schoolLevel,
  role,
}: InterviewContext): InterviewQuestion[] {
  const questions = [
    ...COMMON_QUESTIONS,
    ...SCHOOL_QUESTIONS[schoolLevel],
    ROLE_QUESTIONS[role],
  ].map((question) => interviewQuestionSchema.parse(question));

  const ids = questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("인터뷰 질문 id는 고유해야 합니다.");
  }
  if (questions.length !== 10) {
    throw new Error("고정 인터뷰는 10개 질문으로 구성되어야 합니다.");
  }
  if (
    questions.filter((question) => question.source === "common").length !== 8 ||
    questions.filter((question) => question.source === "school_level")
      .length !== 1 ||
    questions.filter((question) => question.source === "role").length !== 1
  ) {
    throw new Error(
      "고정 인터뷰는 공통 8개, 학교급 1개, 역할 1개로 구성되어야 합니다.",
    );
  }

  return questions;
}

export function getQuestionById(
  questions: readonly InterviewQuestion[],
  questionId: string,
): InterviewQuestion | undefined {
  return questions.find((question) => question.id === questionId);
}

export function getQuestionIndex(
  questions: readonly InterviewQuestion[],
  questionId: string,
): number {
  return questions.findIndex((question) => question.id === questionId);
}

export function isQuestionForContext(
  question: InterviewQuestion,
  context: InterviewContext,
): boolean {
  const schoolMatches =
    !question.schoolLevels ||
    question.schoolLevels.includes(context.schoolLevel);
  const roleMatches = !question.roles || question.roles.includes(context.role);
  return schoolMatches && roleMatches;
}
