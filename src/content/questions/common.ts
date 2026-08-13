import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생·교사 이름, 학교명, 반 이름, 연락처, 진단명, 개별 성적은 적지 마세요. 학생에 관한 질문은 개인 사례 대신 집단 수준의 맥락과 필요한 지원만 적어 주세요.";

export const COMMON_QUESTIONS: InterviewQuestion[] = [
  {
    id: "common-role-focus",
    moduleId: "identity_and_role",
    source: "common",
    prompt: "요즘 수업에서 더 잘하고 싶거나 더 알아보고 싶은 것은 무엇인가요?",
    intent: "선생님이 지금 중요하게 여기는 교육 관심사 하나를 확인합니다.",
    example:
      "학생들이 서로의 생각을 이어 말하게 돕는 질문법을 더 알아보고 싶습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-good-lesson",
    moduleId: "educational_philosophy",
    source: "common",
    prompt:
      "최근 수업에서 학생들의 참여나 이해가 좋아졌을 때, 선생님이 한 행동 하나는 무엇이었나요?",
    intent: "학습에 좋은 영향을 준 선생님의 실제 행동 하나를 확인합니다.",
    example: "바로 답을 알려 주지 않고, 두 생각을 비교해 보라고 말했습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-educational-principle",
    moduleId: "educational_philosophy",
    source: "common",
    prompt:
      "수업의 나침반처럼, 어떤 상황에서도 지키려는 원칙 하나는 무엇인가요?",
    intent: "수업에서 선택해야 할 때 기준이 되는 원칙 하나를 확인합니다.",
    example: "학생이 먼저 생각하고 말할 시간을 꼭 줍니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-lesson-flow",
    moduleId: "preferred_teaching",
    source: "common",
    prompt: "새 수업을 준비할 때 가장 먼저 정하는 것은 무엇인가요?",
    intent: "선생님이 수업 설계를 시작하는 지점 하나를 확인합니다.",
    example: "먼저 학습 목표를 정한 뒤 질문과 활동을 고릅니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-adaptive-tendency",
    moduleId: "preferred_teaching",
    source: "common",
    prompt:
      "수업이 예상과 달라졌을 때, 선생님의 ‘운전 습관’은 계획을 고쳐 이어 가는 쪽과 흐름에 맞춰 새 방향을 잡는 쪽 중 어디에 가깝나요?",
    intent:
      "고정된 성격 유형이 아니라 예상 밖 상황에서 드러나는 수업 운영 성향을 확인합니다. 둘 사이이거나 상황마다 다르다고 답해도 괜찮습니다.",
    example: "학생 반응을 먼저 보고 활동 순서를 바꾸는 편입니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-class-support",
    moduleId: "class_context",
    source: "common",
    prompt:
      "반 전체가 수업에 잘 참여하려면 꼭 갖춰져야 하는 조건 하나는 무엇인가요?",
    intent: "학급 전체의 참여를 돕는 핵심 조건 하나를 확인합니다.",
    example: "무엇을 어떤 순서로 할지 분명할 때 참여가 안정됩니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-assessment-feedback",
    moduleId: "materials_assessment_feedback",
    source: "common",
    prompt: "다음 피드백을 줄 때 학생들의 무엇을 먼저 살펴보나요?",
    intent: "피드백을 정할 때 먼저 보는 학습 정보 하나를 확인합니다.",
    example: "정답보다 설명이 어떻게 달라졌는지를 먼저 봅니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-environment",
    moduleId: "environment_and_ai",
    source: "common",
    prompt:
      "하고 싶은 수업을 실제로 하기 어렵게 만드는 가장 큰 현실 문제는 무엇인가요?",
    intent: "수업 설계에서 먼저 고려할 현실 제약 하나를 확인합니다.",
    example: "수업 시간이 짧아 긴 탐구 활동을 하기 어렵습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-ai-boundaries",
    moduleId: "environment_and_ai",
    source: "common",
    prompt:
      "AI에게 도움을 받아도 선생님이 마지막까지 직접 확인하고 결정할 일은 무엇인가요?",
    intent: "AI에 맡기지 않을 교사의 판단 영역 하나를 확인합니다.",
    example: "학생들에게 줄 최종 피드백은 제가 직접 확인하고 결정합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
];
