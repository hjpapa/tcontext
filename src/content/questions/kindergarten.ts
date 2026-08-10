import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "유아 이름, 기관명, 건강·발달 진단이나 가정환경은 적지 말고 관찰 가능한 집단 경향과 지원 방법만 적어 주세요.";

export const KINDERGARTEN_QUESTIONS: InterviewQuestion[] = [
  {
    id: "kindergarten-transition",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["kindergarten"],
    prompt:
      "놀이에서 다음 일과로 넘어갈 때 유아의 안정적인 참여를 돕는 가장 효과적인 신호는 무엇인가요?",
    intent: "유아의 안정적인 전환과 참여를 돕는 핵심 신호를 확인합니다.",
    example: "짧은 전환 노래를 일관된 신호로 사용합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
