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
      "평가 부담이 큰 시기에도 다시 시도할 수 있게 만드는 수업 장치 하나는 무엇인가요?",
    intent: "평가 부담 속에서도 재시도를 돕는 핵심 수업 장치를 확인합니다.",
    example: "초안을 제출한 뒤 한 번 수정할 기회를 줍니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
