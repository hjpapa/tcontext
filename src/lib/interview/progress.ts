import { PROFILE_MODULE_IDS, type ProfileModuleId } from "@/types/profile";
import type {
  InterviewProgress,
  InterviewQuestion,
  InterviewState,
} from "@/types/interview";

export function calculateInterviewProgress(
  state: Pick<InterviewState, "questions" | "currentQuestionIndex">,
): InterviewProgress {
  const total = Math.max(1, state.questions.length);
  const currentIndex = Math.min(
    Math.max(0, state.currentQuestionIndex),
    total - 1,
  );
  const currentQuestion = state.questions[currentIndex];
  const moduleId = currentQuestion?.moduleId ?? PROFILE_MODULE_IDS[0];
  const moduleQuestions = state.questions.filter(
    (question) => question.moduleId === moduleId,
  );
  const moduleQuestionIndex = moduleQuestions.findIndex(
    (question) => question.id === currentQuestion?.id,
  );

  return {
    current: currentIndex + 1,
    total,
    percent: Math.round(((currentIndex + 1) / total) * 100),
    moduleId,
    moduleCurrent: Math.max(1, moduleQuestionIndex + 1),
    moduleTotal: Math.max(1, moduleQuestions.length),
  };
}

export function getModuleQuestionCounts(
  questions: readonly InterviewQuestion[],
): Record<ProfileModuleId, number> {
  const counts = Object.fromEntries(
    PROFILE_MODULE_IDS.map((id) => [id, 0]),
  ) as Record<ProfileModuleId, number>;
  for (const question of questions) {
    counts[question.moduleId] += 1;
  }
  return counts;
}
