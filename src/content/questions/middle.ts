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
      "짧은 시간에 여러 학급을 만나도 꾸준히 유지하는 관계 형성 루틴은 무엇인가요? 최근 수업에서 사용한 예시 한 가지를 알려 주세요.",
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
      "학생이 선택할 수 있는 것과 교사가 공통으로 정하는 것은 각각 무엇인가요? 참여 기회를 넓히는 방법도 한 가지 알려 주세요.",
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
      "제한된 교과 시간 안에서 수행 과정을 확인할 때 가장 먼저 보는 증거는 무엇인가요? 짧게 피드백하는 방법도 알려 주세요.",
    intent: "실행 가능한 수행평가와 피드백 방식을 파악합니다.",
    example:
      "한 번의 결과보다 계획 메모, 중간 점검, 수정 이유를 짧게 남기게 하고 수업 중 관찰 기록을 함께 봅니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
];
