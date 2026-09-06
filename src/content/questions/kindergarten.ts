import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "유아나 보호자의 이름, 전화번호, 이메일, 식별번호, 생년월일, 상세 주소, 정확한 기관이나 반 이름, 개인과 연결되는 건강, 발달, 가정 정보는 적지 마세요. 대략적인 인원, 활동 환경, 집단의 반응과 필요한 지원은 적어도 됩니다.";

type KindergartenCommonQuestionCopy = Pick<
  InterviewQuestion,
  "prompt" | "intent" | "example" | "privacyHint"
>;

/**
 * Common questions keep stable IDs and modules, while their wording is
 * adapted to the play, daily-routine, and observation context of kindergarten.
 */
export const KINDERGARTEN_COMMON_QUESTION_OVERRIDES: Record<
  string,
  KindergartenCommonQuestionCopy
> = {
  "common-role-focus": {
    prompt:
      "요즘 유아의 놀이와 배움을 지원하면서 더 잘하고 싶거나 알아보고 싶은 것은 무엇인가요?",
    intent: "선생님이 지금 중요하게 여기는 교육 관심사 하나를 확인합니다.",
    example:
      "유아가 놀이를 스스로 이어 가도록 돕는 방법을 더 알아보고 싶습니다. 도움을 주는 때와 기다리는 때를 살펴보는 중입니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-personal-value": {
    prompt:
      "사람으로서 중요하게 여기는 가치 하나가 유아와 함께 지낼 때 어떤 선택으로 드러나나요?",
    intent:
      "성격을 유형화하지 않고, 선생님이 중요하게 여기는 개인적 가치 하나를 확인합니다.",
    example:
      "저는 서로의 말을 끝까지 듣는 것을 중요하게 여깁니다. 유아가 표현을 마칠 때까지 기다리려고 합니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-good-lesson": {
    prompt:
      "최근 놀이 또는 일과에서 유아의 참여나 표현이 풍부해졌을 때, 선생님이 한 행동 하나는 무엇이었나요?",
    intent: "놀이와 배움에 좋은 영향을 준 실제 행동 하나를 확인합니다.",
    example:
      "유아가 만든 길 옆에 크기가 다른 블록을 놓아 두었습니다. 새로운 재료를 본 유아들이 놀이를 더 이어 갔습니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-educational-principle": {
    prompt:
      "놀이와 일과에서 지키려는 원칙이 다른 요구와 부딪힐 때, 무엇을 기준으로 결정하나요?",
    intent: "유아와 함께할 때 선택의 기준이 되는 원칙 하나를 확인합니다.",
    example:
      "유아가 스스로 해 볼 시간을 먼저 주려고 합니다. 일과가 바쁠 때도 바로 대신해 주지 않습니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-lesson-flow": {
    prompt:
      "새로운 놀이 환경이나 활동을 준비할 때 가장 먼저 정하는 것은 무엇인가요?",
    intent: "놀이와 활동 준비를 시작하는 지점 하나를 확인합니다.",
    example:
      "유아가 무엇을 탐색할 수 있을지부터 생각합니다. 그다음에 공간과 재료를 준비합니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-adaptive-tendency": {
    prompt:
      "계획한 활동과 다른 놀이가 이어질 때, 계획을 유지하거나 바꾸기로 판단하는 신호는 무엇인가요?",
    intent:
      "고정된 유형 대신 상황마다 계획을 유지하거나 조정하는 기준을 확인합니다.",
    example:
      "안전과 관련된 기준은 유지하는 편입니다. 놀이 재료와 활동 시간은 유아의 관심에 따라 바꿉니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-class-support": {
    prompt:
      "놀이와 일과를 준비할 때 가장 먼저 고려하는 유아 집단의 상황 하나는 무엇인가요?",
    intent: "놀이와 일과에 영향을 주는 집단의 상황 하나를 확인합니다.",
    example:
      "오전에 몸을 움직이는 놀이에 관심이 많은 편입니다. 넓은 공간과 조용한 공간을 함께 준비합니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-assessment-feedback": {
    prompt:
      "유아의 놀이와 활동을 관찰할 때 가장 먼저 살펴보는 것은 무엇인가요?",
    intent: "관찰을 시작할 때 먼저 보는 배움의 모습 하나를 확인합니다.",
    example:
      "유아가 어떤 재료를 반복해서 사용하는지 먼저 봅니다. 그 모습이 이어지도록 다음 재료를 고릅니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-environment": {
    prompt:
      "놀이와 일과를 준비할 때 꼭 고려해야 하는 유치원의 현실 조건 하나는 무엇인가요?",
    intent:
      "놀이와 일과에 영향을 주는 시간, 공간, 자료 조건 중 하나를 확인합니다.",
    example:
      "같은 공간에서 여러 놀이가 함께 이루어집니다. 움직임이 큰 놀이와 조용한 놀이의 자리를 나눕니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-ai-boundaries": {
    prompt:
      "AI에게 도움을 받아도 유아의 놀이와 배움을 이해할 때 선생님이 직접 확인하고 결정할 일은 무엇인가요?",
    intent: "AI에 맡기지 않을 교사의 판단 영역 하나를 확인합니다.",
    example:
      "유아의 놀이가 가진 의미는 제가 관찰한 내용을 바탕으로 판단합니다. AI가 제안한 해석은 참고만 합니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-ai-task": {
    prompt:
      "유아의 놀이와 일과를 지원하는 일 중 AI의 도움을 가장 먼저 받고 싶은 작업 하나는 무엇인가요?",
    intent:
      "AI에게 실제로 맡길 작업을 확인합니다. 사용 경험이 없어도 바라는 도움을 말할 수 있습니다.",
    example:
      "놀이 환경을 바꿀 아이디어를 얻고 싶습니다. 준비 시간이 적게 드는 제안부터 검토하겠습니다.",
    privacyHint: PRIVACY_HINT,
  },
  "common-ai-response": {
    prompt:
      "유아의 놀이와 배움을 지원할 때 AI가 어떤 방식으로 답해 주면 검토하고 활용하기 편한가요?",
    intent:
      "답변 형식이나 대안 비교 등 본인에게 중요한 협업 방식 하나를 확인합니다. 아직 모르면 건너뛰어도 됩니다.",
    example:
      "준비물과 놀이 방법을 짧게 나누어 보여 주면 좋겠습니다. 제안의 한계도 함께 알려 주면 좋겠습니다.",
    privacyHint: PRIVACY_HINT,
  },
};

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
