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
      "유아의 놀이 선택을 존중하면서 교사가 개입하거나 놀이를 확장하는 기준은 무엇인가요?",
    intent: "놀이 중심 교육에서 선택과 교사 개입의 균형을 파악합니다.",
    example:
      "먼저 충분히 관찰하고, 놀이가 반복되거나 또래 참여가 막힐 때 질문이나 새로운 재료로 가능성을 엽니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "kindergarten-transition",
    moduleId: "class_context",
    source: "school_level",
    schoolLevels: ["kindergarten"],
    prompt:
      "놀이와 일과가 바뀌는 전환 시간에 유아가 안정적으로 참여하도록 어떤 신호와 지원을 사용하나요?",
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
      "놀이와 발달을 어떻게 관찰·기록하고, 보호자에게 어떤 방식으로 공유하나요?",
    intent: "관찰 기록과 보호자 소통의 원칙을 파악합니다.",
    example:
      "해석보다 관찰한 행동과 맥락을 짧게 기록하고, 강점과 다음 지원 방향을 함께 설명합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
