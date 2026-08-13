import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생 이름, 학교·반 이름, 구체적인 진학 희망, 개별 점수·등수는 적지 말고 집단 수준의 학습 지원만 적어 주세요.";

export const HIGH_QUESTIONS: InterviewQuestion[] = [
  {
    id: "high-assessment-pressure",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["high"],
    prompt:
      "시험이나 평가가 많은 때에도 학생들이 다시 고쳐 보게 하는 방법 하나는 무엇인가요?",
    intent: "평가가 많은 때에도 다시 시도하게 돕는 방법 하나를 확인합니다.",
    example: "초안을 낸 뒤 한 번 고칠 시간을 줍니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
