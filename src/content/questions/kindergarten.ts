import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "유아나 보호자의 이름, 전화번호, 이메일, 식별번호, 생년월일, 상세 주소, 정확한 기관이나 반 이름, 개인과 연결되는 건강, 발달, 가정 정보는 적지 마세요. 대략적인 인원, 활동 환경, 집단의 반응과 필요한 지원은 적어도 됩니다.";

export const KINDERGARTEN_QUESTIONS: InterviewQuestion[] = [
  {
    id: "kindergarten-transition",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["kindergarten"],
    prompt:
      "놀이가 끝난 뒤 유아가 다음 활동을 알아차리고 편안하게 이동하도록 어떤 신호를 사용하나요?",
    intent:
      "활동이 바뀌는 것을 유아가 알아차리도록 돕는 신호 하나를 확인합니다.",
    example:
      "매번 같은 짧은 정리 노래를 들려줍니다. 노래가 끝나면 다음 활동으로 이동한다는 뜻으로 사용합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
