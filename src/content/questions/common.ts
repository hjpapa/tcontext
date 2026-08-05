import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생·교사 이름, 학교명, 반 이름, 연락처, 진단명, 개별 성적은 적지 마세요. 학생에 관한 질문은 개인 사례 대신 집단 수준의 맥락과 필요한 지원만 적어 주세요.";

export const COMMON_QUESTIONS: InterviewQuestion[] = [
  {
    id: "common-role-focus",
    moduleId: "identity_and_role",
    source: "common",
    prompt:
      "요즘 나의 ‘교실 검색창’에 자주 뜨는 것은 무엇인가요? 현재 맡은 역할과 더 알아보고 싶은 교육 관심사 한 가지를 함께 적어 주세요.",
    intent: "현재 역할과 교사가 스스로 선택한 관심사를 함께 파악합니다.",
    example:
      "담임으로 학급 운영과 여러 교과를 맡고 있습니다. 요즘에는 학생의 질문이 이어지는 수업을 더 알아보고 싶습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-good-lesson",
    moduleId: "educational_philosophy",
    source: "common",
    prompt:
      "최근 수업에서 30초만 되감아 다시 보고 싶은 순간은 언제인가요? 그때 학습자들은 무엇을 했고, 선생님은 어떤 행동을 했나요?",
    intent:
      "교사의 강점과 교육관을 평가 표현이 아닌 관찰 가능한 행동과 장면으로 확인합니다.",
    example:
      "서로 다른 풀이를 비교하며 설명을 고쳐 가던 순간입니다. 저는 정답을 바로 말하지 않고 두 풀이의 차이를 묻는 질문을 건넸습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-lesson-flow",
    moduleId: "preferred_teaching",
    source: "common",
    prompt:
      "평소 수업을 세 컷으로 그린다면 ‘문 열기→배움 활동→마무리’는 각각 어떤 모습인가요? 그중 학습자가 고를 수 있는 것도 알려 주세요.",
    intent: "선호하는 교수·학습 흐름과 학습자 선택권의 범위를 구조화합니다.",
    example:
      "짧은 질문으로 문을 열고 개인 탐색과 짝 대화를 거쳐 전체로 정리합니다. 탐색 자료와 표현 방식은 두세 가지 중 고르게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-class-support",
    moduleId: "class_context",
    source: "common",
    prompt:
      "교실의 ‘참여 온도’가 올라가는 조건과 뚝 떨어지는 조건은 각각 무엇인가요? 집단 전체에 도움이 되는 지원도 한 가지만 적어 주세요.",
    intent:
      "학생을 규정하지 않고 수업 참여에 영향을 주는 맥락과 지원 조건을 찾습니다.",
    example:
      "활동 순서가 보이고 과제가 짧게 나뉘면 참여가 안정적입니다. 긴 설명이 이어지면 어려워져서 핵심 질문을 먼저 보여 줍니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-assessment-feedback",
    moduleId: "materials_assessment_feedback",
    source: "common",
    prompt:
      "수업 중 ‘지금 배우고 있구나’를 알려 주는 첫 신호는 무엇인가요? 그 신호를 본 뒤 어떤 피드백을 건네나요?",
    intent: "평가와 피드백에 쓰는 관찰 증거와 다음 지원 방식을 확인합니다.",
    example:
      "초안에서 설명이 바뀐 흔적을 먼저 봅니다. 잘잘못을 말하기보다 다음 시도에서 바꿔 볼 한 가지를 구체적으로 짚어 줍니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-environment",
    moduleId: "environment_and_ai",
    source: "common",
    prompt:
      "좋은 수업 아이디어에 가장 먼저 ‘잠깐!’을 거는 현실 조건은 무엇인가요? 시간·인원·공간·기기·준비 중 큰 제약 하나와 가능한 우회로를 알려 주세요.",
    intent: "실행 가능한 제안을 만들기 위한 현실 제약과 대안을 확인합니다.",
    example:
      "공용 기기가 부족해서 모두가 동시에 쓰기 어렵습니다. 기기 없이 먼저 생각을 정리하고 모둠별로 한 대씩 쓰는 대안이 필요합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "common-ai-boundaries",
    moduleId: "environment_and_ai",
    source: "common",
    prompt:
      "AI를 수업 준비 동료로 하루 빌린다면 무엇을 맡기고 싶나요? 직접 판단해야 할 일과 결과를 확인할 기준도 하나씩 알려 주세요.",
    intent: "교사 주도권을 지키는 AI 협업 범위와 검토 기준을 명시합니다.",
    example:
      "활동 아이디어 초안은 맡기되 학생에 대한 판단과 최종 평가는 직접 합니다. 결과의 사실 여부와 저작권을 확인합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
];
