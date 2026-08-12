import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생·교사 이름, 학교명, 반 이름, 연락처, 진단명, 개별 성적은 적지 마세요. 학생에 관한 질문은 개인 사례 대신 집단 수준의 맥락과 필요한 지원만 적어 주세요.";

export const COMMON_QUESTIONS: InterviewQuestion[] = [
  {
    id: "common-role-focus",
    moduleId: "identity_and_role",
    source: "common",
    prompt:
      "요즘 수업이나 교육 활동에서 가장 깊이 탐구하고 싶은 주제는 무엇인가요?",
    intent: "교사가 현재 중요하게 여기는 교육 관심사를 파악합니다.",
    example:
      "탐구 질문을 활용해 학생의 생각을 이어 가는 수업을 더 알아보고 싶습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-good-lesson",
    moduleId: "educational_philosophy",
    source: "common",
    prompt:
      "최근 수업에서 ‘배움이 움직이기 시작했다’고 느낀 순간에, 선생님이 한 가장 중요한 행동은 무엇이었나요?",
    intent: "교사의 강점을 관찰 가능한 행동을 통해 확인합니다.",
    example:
      "학생의 설명을 바로 고치기보다 서로 다른 생각을 비교하도록 질문했습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-educational-principle",
    moduleId: "educational_philosophy",
    source: "common",
    prompt:
      "수업에서 여러 선택이 충돌할 때도 나침반처럼 끝까지 지키려는 원칙 하나는 무엇인가요?",
    intent: "수업 의사결정의 바탕이 되는 교육 원칙을 확인합니다.",
    example:
      "학습자가 자신의 생각을 먼저 표현할 시간을 확보하는 원칙을 지킵니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-lesson-flow",
    moduleId: "preferred_teaching",
    source: "common",
    prompt:
      "수업을 설계할 때 목표·질문·활동·자료 중 가장 먼저 중심에 놓는 것은 무엇인가요?",
    intent: "교사가 선호하는 수업 설계의 출발점을 확인합니다.",
    example: "먼저 수업 목표를 정하고, 목표에 맞춰 질문과 활동을 고릅니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-adaptive-tendency",
    moduleId: "preferred_teaching",
    source: "common",
    prompt:
      "수업이 계획과 다르게 흘러간 최근 장면에서, 가장 먼저 한 행동은 무엇이었나요?",
    intent:
      "예상 밖 상황에서 드러나는 수업 운영의 판단 경향을 관찰 가능한 행동으로 확인합니다.",
    example:
      "학생의 이해 상태를 짧게 확인한 뒤 활동 순서와 시간을 조정했습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-class-support",
    moduleId: "class_context",
    source: "common",
    prompt:
      "현재 수업 집단의 참여와 학습을 가장 크게 좌우하는 조건은 무엇인가요?",
    intent: "수업 집단의 참여와 학습에 영향을 주는 핵심 맥락을 찾습니다.",
    example: "활동 순서와 기대 결과가 분명할 때 참여가 안정적으로 이어집니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-assessment-feedback",
    moduleId: "materials_assessment_feedback",
    source: "common",
    prompt:
      "다음 피드백을 결정할 때 가장 먼저 확인하는 학습의 근거는 무엇인가요?",
    intent: "평가와 피드백의 판단에 사용하는 핵심 근거를 확인합니다.",
    example: "학생의 설명에서 생각이 어떻게 바뀌었는지를 먼저 확인합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-environment",
    moduleId: "environment_and_ai",
    source: "common",
    prompt:
      "좋은 수업 아이디어에 가장 자주 제동을 거는 현실 조건은 무엇인가요?",
    intent: "수업 설계에 반영해야 할 가장 큰 현실 제약을 확인합니다.",
    example: "수업 시간이 짧아 충분한 탐구 활동을 운영하기 어렵습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-ai-boundaries",
    moduleId: "environment_and_ai",
    source: "common",
    prompt: "AI를 수업 준비 동료로 활용해도 직접 판단할 일은 무엇인가요?",
    intent: "AI 활용에서도 교사가 유지할 판단 권한의 경계를 확인합니다.",
    example: "학생에게 제공할 최종 피드백은 교사가 직접 판단합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
];
