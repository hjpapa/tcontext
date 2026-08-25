import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "사람 이름, 전화번호, 이메일, 식별번호, 생년월일, 상세 주소, 정확한 학교나 반 이름, 개인과 연결되는 건강, 상담, 성적 정보는 적지 마세요. 학년, 교과, 대략적인 인원, 수업 환경, 여러 학급에서 보이는 경향과 필요한 지원은 적어도 됩니다.";

export const MIDDLE_QUESTIONS: InterviewQuestion[] = [
  {
    id: "middle-autonomy-participation",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["middle"],
    prompt:
      "중학생이 활동 방법을 고를 수 있게 할 때, 함께 지켜야 할 규칙 하나는 무엇인가요?",
    intent: "활동 방법을 고를 때 함께 지키는 규칙 하나를 확인합니다.",
    example:
      "표현 방법은 각자 고르게 합니다. 다만 다른 사람을 비난하는 말은 쓰지 않도록 모두에게 같은 규칙을 안내합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
