import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생 이름, 학교·반 이름, 진단명, 개별 점수는 적지 말고 학급 수준의 경향과 필요한 지원만 적어 주세요.";

export const ELEMENTARY_QUESTIONS: InterviewQuestion[] = [
  {
    id: "elementary-foundation-support",
    moduleId: "class_context",
    source: "school_level",
    schoolLevels: ["elementary"],
    prompt:
      "한 교실에서 서로 다른 속도로 배울 때, 모두가 함께 도전할 핵심과 필요할 때 고르는 도움은 어떻게 나누나요? 최근 장면 하나를 알려 주세요.",
    intent: "학생을 낙인찍지 않는 기초학습 지원과 과제 설계 방식을 찾습니다.",
    example:
      "핵심 과제는 함께 두고 구체물, 단계 카드, 추가 도전 중 필요한 것을 고르게 했습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "elementary-group-sharing",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["elementary"],
    prompt:
      "모둠의 ‘마이크’가 몇 사람에게만 가지 않게 하는 운영 비결이 있나요? 말하기 외에 참여할 통로도 하나 알려 주세요.",
    intent:
      "공정하고 심리적으로 안전한 참여 구조와 다양한 표현 방법을 파악합니다.",
    example:
      "생각 쓰기 시간을 먼저 주고 역할을 순환합니다. 말하기가 부담스러우면 기록, 그림, 질문으로도 기여하게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
