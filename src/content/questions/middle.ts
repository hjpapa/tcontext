import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생 이름, 학교·반 이름, 상담·건강 정보, 개별 점수는 적지 말고 여러 학급에서 보이는 경향과 지원만 적어 주세요.";

export const MIDDLE_QUESTIONS: InterviewQuestion[] = [
  {
    id: "middle-autonomy-participation",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["middle"],
    prompt:
      "중학생에게 선택권을 줄 때, 모두가 안전하게 참여하도록 꼭 지키게 하는 규칙 하나는 무엇인가요?",
    intent: "선택권을 주면서도 안전한 참여를 지키는 규칙 하나를 확인합니다.",
    example:
      "표현 방법은 고르게 하되 다른 사람을 평가하는 말은 쓰지 않게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
