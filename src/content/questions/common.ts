import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생·교사 이름, 학교명, 반 이름, 연락처, 진단명, 개별 성적은 적지 말고 집단 수준의 맥락과 필요한 지원만 적어 주세요.";

export const COMMON_QUESTIONS: InterviewQuestion[] = [
  {
    id: "common-role-focus",
    moduleId: "identity_and_role",
    source: "common",
    prompt:
      "지금 맡고 있는 교육 역할과 최근 가장 관심을 두고 있는 수업 또는 교육 과제를 알려 주세요.",
    intent: "현재 역할과 프로파일을 사용할 실제 맥락을 파악합니다.",
    example:
      "담임으로 학급 운영과 여러 교과를 맡고 있으며, 학생이 스스로 질문하는 수업을 고민하고 있습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-teacher-role",
    moduleId: "identity_and_role",
    source: "common",
    prompt:
      "교사로서 내가 꼭 해야 한다고 생각하는 역할은 무엇인가요? 실제 행동의 예와 함께 적어 주세요.",
    intent: "교사가 중요하게 여기는 책임과 판단 기준을 확인합니다.",
    example:
      "정답을 먼저 알려 주기보다 학생이 시도할 수 있는 발판을 마련하고, 과정에서 필요한 피드백을 줍니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
  {
    id: "common-good-lesson",
    moduleId: "educational_philosophy",
    source: "common",
    prompt:
      "최근 '좋은 수업이었다'고 느낀 순간은 언제였나요? 그때 학생들은 무엇을 하고 있었나요?",
    intent: "추상적인 교육관을 실제 수업 경험과 연결합니다.",
    example:
      "학생들이 서로 다른 풀이를 비교하고 자기 설명을 고쳐 가는 모습을 보았을 때입니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-mistakes-growth",
    moduleId: "educational_philosophy",
    source: "common",
    prompt:
      "학생의 실수나 오답을 수업에서 어떻게 다루며, 성장을 무엇으로 확인하나요?",
    intent: "학습과 성장, 실수에 대한 교사의 관점을 파악합니다.",
    example:
      "오답의 이유를 말이나 그림으로 설명하게 하고, 처음 생각과 수정한 생각의 차이를 성장의 증거로 봅니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
  {
    id: "common-lesson-flow",
    moduleId: "preferred_teaching",
    source: "common",
    prompt:
      "자주 사용하는 수업 흐름을 설명해 주세요. 교사 설명, 학생 활동, 선택권은 어떻게 배치하나요?",
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
      "현재 수업 집단이 잘 참여하고 집중하는 조건과, 추가 지원이 필요한 상황을 집단 수준에서 설명해 주세요.",
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
      "발표나 실패가 부담스러운 학생도 안전하게 참여하도록 어떤 선택지와 지원을 제공하나요?",
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
      "학생의 학습을 어떻게 확인하고 피드백하나요? 결과와 과정 중 무엇을 어떤 방식으로 살피나요?",
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
      "수업 시간, 인원, 공간, 기기, 인터넷, 준비 시간 중 수업 설계에 실제로 영향을 주는 제약은 무엇인가요?",
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
      "AI에게 도움받고 싶은 일과 AI가 대신해서는 안 되는 일을 각각 알려 주세요. 결과를 검토하는 기준도 적어 주세요.",
    intent: "교사 주도권을 지키는 AI 협업 원칙을 명시합니다.",
    example:
      "활동 아이디어와 수준별 발문 초안은 도움받되, 학생에 대한 판단과 최종 평가는 직접 합니다. 사실과 저작권도 확인합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
];
