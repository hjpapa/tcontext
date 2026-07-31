import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생·교사 이름, 학교명, 반 이름, 연락처, 진단명, 개별 성적은 적지 마세요. 학생에 관한 질문은 개인 사례 대신 집단 수준의 맥락과 필요한 지원만 적어 주세요.";

export const COMMON_QUESTIONS: InterviewQuestion[] = [
  {
    id: "common-role-focus",
    moduleId: "identity_and_role",
    source: "common",
    prompt:
      "현재 맡은 교육 역할과 요즘 자주 찾아보거나 더 알아보고 싶은 관심사 한 가지를 알려 주세요. 수업과 직접 관련이 없어도 괜찮습니다.",
    intent: "현재 역할과 교사의 실제 관심사를 함께 파악합니다.",
    example:
      "담임으로 학급 운영과 여러 교과를 맡고 있습니다. 요즘에는 학생의 질문이 살아 있는 수업을 더 알아보는 데 관심이 있습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-teacher-role",
    moduleId: "identity_and_role",
    source: "common",
    prompt:
      "최근 수업이나 학급 운영에서 ‘이건 내가 비교적 잘한다’고 느낀 장면 한 가지를 알려 주세요. 그때 실제로 무엇을 했나요?",
    intent:
      "교사의 강점을 추상적 특성이 아닌 관찰 가능한 행동과 맥락으로 확인합니다.",
    example:
      "학생의 말을 짧게 정리해 다시 질문으로 돌려주는 편입니다. 최근 토론 수업에서도 서로 다른 의견이 이어지도록 연결 질문을 했습니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
  {
    id: "common-good-lesson",
    moduleId: "educational_philosophy",
    source: "common",
    prompt:
      "최근 ‘학생의 배움이 움직였다’고 느낀 수업 장면 한 가지를 떠올려 주세요. 학생들은 무엇을 했고, 선생님은 어떤 선택을 했나요?",
    intent: "추상적인 교육관을 실제 수업 경험과 연결합니다.",
    example:
      "학생들이 서로 다른 풀이를 비교하며 자기 설명을 고쳐 갔습니다. 저는 정답을 바로 말하지 않고 두 풀이의 차이를 묻는 질문을 선택했습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-mistakes-growth",
    moduleId: "educational_philosophy",
    source: "common",
    prompt:
      "최근 수업이나 학급 운영에서 예상대로 풀리지 않아 에너지가 많이 들었던 장면 한 가지를 알려 주세요. 다음에 같은 상황을 만난다면 무엇을 바꾸거나 어떤 지원을 받고 싶나요?",
    intent:
      "교사를 평가하지 않고 어려움이 생기는 조건, 경험에서 얻은 판단과 필요한 지원을 확인합니다.",
    example:
      "활동을 마친 뒤 여러 기록을 한꺼번에 정리할 때 에너지가 많이 듭니다. 수업 중 바로 표시할 수 있는 간단한 기록 틀이 있으면 도움이 됩니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
  {
    id: "common-lesson-flow",
    moduleId: "preferred_teaching",
    source: "common",
    prompt:
      "자주 사용하는 수업 흐름을 시작→활동→마무리 순서로 알려 주세요. 그 안에서 학생이 선택할 수 있는 것은 무엇인가요?",
    intent: "선호하는 교수·학습 방식과 선택권의 범위를 구조화합니다.",
    example:
      "짧게 목표를 안내한 뒤 개인 탐색, 짝 대화, 전체 공유 순으로 진행하고 표현 방식은 두세 가지 중 고르게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-class-support",
    moduleId: "class_context",
    source: "common",
    prompt:
      "현재 수업 집단이 잘 참여하는 때와 참여가 어려워지는 때는 언제인가요? 집단 전체에 도움이 되는 지원 한 가지도 알려 주세요.",
    intent: "학생을 규정하지 않고 수업 설계에 필요한 지원 조건을 찾습니다.",
    example:
      "활동 순서가 눈에 보이고 과제가 짧게 나뉘면 참여가 안정적입니다. 긴 설명 전에는 핵심 질문을 먼저 제시하는 편이 좋습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-safe-participation",
    moduleId: "participation_and_emotion",
    source: "common",
    prompt:
      "말로 발표하는 일이 부담스러운 학생도 참여할 수 있도록 어떤 다른 방법을 제공하나요? 자주 쓰는 방법 한 가지만 알려 주세요.",
    intent: "참여 방식, 심리적 안전감, 도전의 균형을 파악합니다.",
    example:
      "먼저 글이나 메모로 생각을 정리하고, 짝에게 말한 뒤 원하는 경우 전체 공유로 이어가게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-assessment-feedback",
    moduleId: "materials_assessment_feedback",
    source: "common",
    prompt:
      "학생이 배우고 있는지 확인할 때 가장 먼저 보는 증거는 무엇인가요? 그 증거를 바탕으로 어떤 피드백을 주나요?",
    intent: "평가와 피드백의 기준, 말투, 증거를 확인합니다.",
    example:
      "완성 결과뿐 아니라 질문, 초안, 수정 과정을 관찰하고 다음 시도에서 바꿀 한 가지를 구체적으로 말해 줍니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-environment",
    moduleId: "environment_and_ai",
    source: "common",
    prompt:
      "좋은 아이디어가 있어도 교실 현실이 먼저 손드는 날이 있죠. 시간, 인원, 공간, 기기, 인터넷, 준비 시간 중 가장 큰 제약 한두 가지와 가능한 대안을 알려 주세요.",
    intent: "실행 가능한 제안을 만들기 위한 현실 조건을 확인합니다.",
    example:
      "한 차시는 45분이고 공용 기기가 제한적이어서, 기기 없이도 가능한 대안과 15분 안에 준비할 수 있는 자료가 필요합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-ai-boundaries",
    moduleId: "environment_and_ai",
    source: "common",
    prompt:
      "AI에게 맡기고 싶은 일 한 가지, 교사가 직접 판단해야 하는 일 한 가지, AI 결과를 확인할 기준 한 가지를 알려 주세요.",
    intent: "교사 주도권을 지키는 AI 협업 원칙을 명시합니다.",
    example:
      "활동 아이디어와 수준별 발문 초안은 도움받되, 학생에 대한 판단과 최종 평가는 직접 합니다. 사실과 저작권도 확인합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
];
