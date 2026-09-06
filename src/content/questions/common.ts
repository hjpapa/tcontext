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
    id: "common-personal-value",
    moduleId: "identity_and_role",
    source: "common",
    prompt:
      "사람으로서 중요하게 여기는 가치 하나가 수업에서 어떤 선택으로 드러나나요?",
    intent:
      "성격을 유형화하지 않고, 선생님이 중요하게 여기는 개인적 가치 하나를 확인합니다.",
    example:
      "저는 약속을 지키는 것을 중요하게 여깁니다. 수업에서도 안내한 기준과 시간을 지키려고 합니다.",
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
      "수업의 나침반처럼 지키려는 원칙이 다른 요구와 부딪힐 때, 무엇을 기준으로 결정하나요?",
    intent: "수업에서 선택해야 할 때 기준이 되는 원칙 하나를 확인합니다.",
    example:
      "진도보다 학생이 먼저 생각할 시간을 지키려고 합니다. 시간이 부족하면 생각하는 시간 대신 문제 수를 줄입니다.",
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
      "수업이 예상과 다르게 흘러갈 때, 계획을 유지하거나 바꾸기로 판단하는 신호는 무엇인가요?",
    intent:
      "고정된 유형 대신 상황마다 계획을 유지하거나 조정하는 기준을 확인합니다.",
    example:
      "짧은 확인 질문에 이유를 설명하기 어려워하면 다음 활동으로 넘어가지 않습니다. 목표는 유지하고 예시를 바꿔 다시 설명합니다.",
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
    id: "common-ai-task",
    moduleId: "environment_and_ai",
    source: "common",
    prompt:
      "교사로서 반복하는 일 중 AI의 도움을 가장 먼저 받고 싶은 작업 하나는 무엇인가요?",
    intent:
      "교사의 현재 관심사와 구분하여 AI에게 실제로 맡길 작업을 확인합니다. 사용 경험이 없어도 바라는 도움을 말할 수 있습니다.",
    example:
      "수업 뒤 제 설명을 돌아볼 질문을 만드는 데 도움받고 싶습니다. AI가 대안을 제안하면 다음 수업에서 시도할 것을 고르겠습니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
  {
    id: "common-ai-response",
    moduleId: "environment_and_ai",
    source: "common",
    prompt: "AI가 어떤 방식으로 답해 주면 선생님이 검토하고 활용하기 편한가요?",
    intent:
      "답변의 형식·길이·말투·대안 비교·되묻기 중 본인에게 중요한 협업 방식 하나를 확인합니다. 아직 모르면 건너뛰어도 됩니다.",
    example:
      "긴 완성본보다 대안 두 가지의 장단점을 짧게 비교해 주면 좋겠습니다. 제 생각과 다른 의견도 이유와 함께 알려 주면 좋겠습니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
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
