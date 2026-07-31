import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "유아 이름, 기관명, 건강·발달 진단이나 가정환경은 적지 말고 관찰 가능한 집단 경향과 지원 방법만 적어 주세요.";

export const KINDERGARTEN_QUESTIONS: InterviewQuestion[] = [
  {
    id: "kindergarten-play-intervention",
    moduleId: "preferred_teaching",
    source: "school_level",
    schoolLevels: ["kindergarten"],
    prompt:
      "교사가 놀이에 들어가야겠다고 판단하는 신호는 무엇인가요? 최근 놀이 장면 한 가지에서 어떻게 관찰하고 개입했는지 알려 주세요.",
    intent: "놀이 중심 교육에서 선택과 교사 개입의 균형을 파악합니다.",
    example:
      "놀이가 같은 방식으로 오래 반복되고 새로운 참여가 이어지지 않는 것을 신호로 봅니다. 최근에는 다른 용도의 재료를 놓고 질문 하나만 건넨 뒤 다시 관찰했습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "kindergarten-transition",
    moduleId: "class_context",
    source: "school_level",
    schoolLevels: ["kindergarten"],
    prompt:
      "놀이와 일과가 바뀌는 전환 시간에 주로 쓰는 신호 한 가지는 무엇인가요? 그 신호만으로 어려울 때 더하는 지원도 알려 주세요.",
    intent: "발달 특성을 고려한 전환 지원과 환경 구성을 확인합니다.",
    example:
      "그림 순서표와 익숙한 노래로 미리 알리고, 정리를 작은 역할로 나누어 선택하게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
  {
    id: "kindergarten-observation-family",
    moduleId: "materials_assessment_feedback",
    source: "school_level",
    schoolLevels: ["kindergarten"],
    prompt:
      "놀이와 발달을 관찰할 때 가장 먼저 무엇을 기록하나요? 보호자에게는 관찰한 사실과 교사의 해석을 어떻게 구분해 전하나요?",
    intent: "관찰 기록과 보호자 소통의 원칙을 파악합니다.",
    example:
      "해석보다 관찰한 행동과 맥락을 짧게 기록하고, 강점과 다음 지원 방향을 함께 설명합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
