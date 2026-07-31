import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생 이름, 학교·반 이름, 상담·건강 정보, 개별 점수는 적지 말고 여러 학급에서 보이는 경향과 지원만 적어 주세요.";

export const MIDDLE_QUESTIONS: InterviewQuestion[] = [
  {
    id: "middle-role-across-classes",
    moduleId: "identity_and_role",
    source: "school_level",
    schoolLevels: ["middle"],
    prompt:
      "담임과 교과교사의 역할이 다르거나 여러 학급을 만나는 상황에서, 학생과의 관계를 어떻게 이어 가나요?",
    intent: "중학교의 분업 구조 속 관계 형성과 역할 범위를 파악합니다.",
    example:
      "매 차시 짧은 안부 질문과 예측 가능한 수업 루틴을 유지하고, 필요한 사항은 담임과 사실 중심으로 공유합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "middle-autonomy-participation",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["middle"],
    prompt:
      "관계와 자율성이 중요해지는 시기에 참여 격차를 줄이면서 학생의 선택을 어떻게 보장하나요?",
    intent: "사춘기 학생의 자율성과 안전한 참여 지원을 확인합니다.",
    example:
      "과제의 핵심 목표는 같게 두되 주제와 표현 방식을 고르게 하고, 공개 발표 전 소규모 공유 기회를 줍니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
  {
    id: "middle-performance-assessment",
    moduleId: "materials_assessment_feedback",
    source: "school_level",
    schoolLevels: ["middle"],
    prompt:
      "제한된 교과 시간 안에서 수행평가의 과정과 개별 학습을 어떻게 확인하나요?",
    intent: "실행 가능한 수행평가와 피드백 방식을 파악합니다.",
    example:
      "한 번의 결과보다 계획 메모, 중간 점검, 수정 이유를 짧게 남기게 하고 수업 중 관찰 기록을 함께 봅니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
];
