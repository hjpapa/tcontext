import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "사람 이름, 전화번호, 이메일, 주민등록번호나 학생번호 같은 식별번호, 생년월일, 상세 주소, 정확한 학교나 반 이름, 개인과 연결되는 건강, 상담, 성적 정보는 적지 마세요. 학교급, 교과, 대략적인 인원, 수업 환경, 집단의 참여 경향과 필요한 지원은 적어도 됩니다.";

export const COMMON_QUESTIONS: InterviewQuestion[] = [
  {
    id: "common-role-focus",
    moduleId: "identity_and_role",
    source: "common",
    prompt: "요즘 수업에서 더 잘하고 싶거나 더 알아보고 싶은 것은 무엇인가요?",
    intent: "선생님이 지금 중요하게 여기는 교육 관심사 하나를 확인합니다.",
    example:
      "요즘은 학생의 이해를 수업 중에 확인하는 방법을 더 알아보고 싶습니다. 긴 활동보다 짧게 확인할 수 있는 질문을 찾아보는 중입니다.",
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
    example:
      "활동 순서를 칠판에 짧게 적어 두었습니다. 학생들이 해야 할 일을 알고 바로 시작했습니다.",
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
    example:
      "학생이 먼저 생각할 시간을 주려고 합니다. 수업이 급할 때도 짧게라도 기다립니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-lesson-flow",
    moduleId: "preferred_teaching",
    source: "common",
    prompt: "새 수업을 준비할 때 가장 먼저 정하는 것은 무엇인가요?",
    intent: "선생님이 수업 설계를 시작하는 지점 하나를 확인합니다.",
    example:
      "수업이 끝날 때 학생이 무엇을 할 수 있어야 하는지부터 정합니다. 그다음에 필요한 질문과 활동을 고릅니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-adaptive-tendency",
    moduleId: "preferred_teaching",
    source: "common",
    prompt:
      "수업이 예상과 다르게 흘러갈 때, 보통 처음 계획을 이어 가는 편인가요, 학생 반응에 맞춰 계획을 바꾸는 편인가요?",
    intent:
      "예상 밖 상황에서 계획을 유지하거나 조정하는 수업 운영 경향을 확인합니다. 둘 사이이거나 상황마다 다르다고 답해도 괜찮습니다.",
    example:
      "처음 세운 목표는 유지하는 편입니다. 학생들이 막히면 설명 방식이나 활동 순서는 바꿉니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-class-support",
    moduleId: "class_context",
    source: "common",
    prompt:
      "수업을 준비할 때 가장 먼저 고려하는 학급의 상황 하나는 무엇인가요?",
    intent: "수업 설계에 영향을 주는 학급의 상황 하나를 확인합니다.",
    example:
      "설명을 오래 들으면 참여가 줄어드는 편입니다. 그래서 짧은 활동을 중간에 넣습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-assessment-feedback",
    moduleId: "materials_assessment_feedback",
    source: "common",
    prompt: "학생의 과제나 활동에 피드백을 줄 때, 가장 먼저 무엇을 살펴보나요?",
    intent: "피드백을 정할 때 먼저 보는 학습 정보 하나를 확인합니다.",
    example:
      "결과만 보기보다 답을 만든 과정을 먼저 살펴봅니다. 어디에서 생각이 달라졌는지 확인한 뒤 피드백을 정합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-environment",
    moduleId: "environment_and_ai",
    source: "common",
    prompt:
      "수업을 준비할 때 꼭 고려해야 하는 학교의 현실 조건 하나는 무엇인가요?",
    intent:
      "수업 운영에 영향을 주는 학교의 시간, 공간, 자료 조건 중 하나를 확인합니다.",
    example:
      "한 차시 안에 준비와 정리까지 해야 합니다. 긴 탐구 활동은 두 차시로 나누어 진행합니다.",
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
    example:
      "학생에게 줄 최종 피드백은 제가 직접 결정합니다. AI가 만든 문장은 참고만 하고 그대로 사용하지 않습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
];
