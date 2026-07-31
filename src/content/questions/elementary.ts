import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생 이름, 학교·반 이름, 진단명, 개별 점수는 적지 말고 학급 수준의 경향과 필요한 지원만 적어 주세요.";

export const ELEMENTARY_QUESTIONS: InterviewQuestion[] = [
  {
    id: "elementary-class-culture",
    moduleId: "identity_and_role",
    source: "school_level",
    schoolLevels: ["elementary"],
    prompt:
      "담임 중심의 생활과 교과 학습이 이어지는 하루에서 어떤 학급 문화를 만들고 싶나요?",
    intent: "학급 운영과 수업을 연결하는 핵심 원칙을 확인합니다.",
    example:
      "질문과 실수를 자연스럽게 공유하고, 서로의 학습 속도를 비교하지 않는 문화를 만들고 싶습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "elementary-foundation-support",
    moduleId: "class_context",
    source: "school_level",
    schoolLevels: ["elementary"],
    prompt:
      "기초학습 수준의 차이가 있는 학급에서 모두가 참여하도록 과제와 안내를 어떻게 조정하나요?",
    intent: "학생을 낙인찍지 않는 기초학습 지원 방식을 찾습니다.",
    example:
      "핵심 과제는 공통으로 두고 구체물, 단계 카드, 추가 도전 과제를 선택할 수 있게 준비합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "elementary-group-sharing",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["elementary"],
    prompt:
      "모둠 활동과 발표에서 말이 빠른 학생에게만 기회가 쏠리지 않도록 어떻게 운영하나요?",
    intent: "공정하고 안전한 참여 구조를 파악합니다.",
    example:
      "생각 쓰기 시간을 먼저 주고 역할을 순환하며, 말하기 외에도 기록·그림·질문으로 기여하게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
