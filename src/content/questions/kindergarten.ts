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
      "놀이가 끝나고 다음 활동으로 넘어갈 때, 유아가 편안하게 따라오도록 쓰는 신호 하나는 무엇인가요?",
    intent: "활동을 바꿀 때 유아의 편안한 참여를 돕는 신호 하나를 확인합니다.",
    example: "같은 짧은 노래를 매번 전환 신호로 사용합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
