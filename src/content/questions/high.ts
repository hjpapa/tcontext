import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생 이름, 학교·반 이름, 진학 희망의 구체 정보, 개별 점수·등수는 적지 말고 집단 수준의 학습 지원만 적어 주세요.";

export const HIGH_QUESTIONS: InterviewQuestion[] = [
  {
    id: "high-depth-pace",
    moduleId: "preferred_teaching",
    source: "school_level",
    schoolLevels: ["high"],
    prompt: "교과의 깊이 있는 탐구와 진도 운영 사이의 균형을 어떻게 정하나요?",
    intent: "교과 전문성과 시간 제약을 함께 반영한 수업 원칙을 확인합니다.",
    example:
      "핵심 개념은 공통으로 확실히 다루고, 한 단원의 대표 쟁점은 자료 분석과 토론으로 깊게 탐구합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "high-level-choice",
    moduleId: "class_context",
    source: "school_level",
    schoolLevels: ["high"],
    prompt:
      "선택과목이나 학업 수준 차이가 있는 수업에서 과제의 난이도와 자기주도성을 어떻게 지원하나요?",
    intent: "다양한 준비도에 대응하는 과제 설계와 학습 지원을 파악합니다.",
    example:
      "필수 문제와 선택 도전 문제를 구분하고, 계획표와 중간 점검 질문으로 스스로 속도를 조절하게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "high-assessment-pressure",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["high"],
    prompt:
      "시험과 진로·진학 부담이 큰 상황에서도 질문, 수정, 탐구가 가능한 분위기를 어떻게 만드나요?",
    intent: "평가 부담 속 심리적 안전과 학습 주도성 지원 원칙을 확인합니다.",
    example:
      "정답 확인 전 익명 질문을 받고 초안 수정 기회를 주며, 평가와 무관한 짧은 탐구 시간을 확보합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
