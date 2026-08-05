import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생 이름, 학교·반 이름, 진학 희망의 구체 정보, 개별 점수·등수는 적지 말고 집단 수준의 학습 지원만 적어 주세요.";

export const HIGH_QUESTIONS: InterviewQuestion[] = [
  {
    id: "high-depth-pace",
    moduleId: "preferred_teaching",
    source: "school_level",
    schoolLevels: ["high"],
    prompt:
      "진도표가 앞에 있어도 ‘여기는 깊게 파볼 만하다’고 멈추는 기준은 무엇인가요? 최근 단원에서 고른 장면 하나를 알려 주세요.",
    intent: "교과의 깊이와 시간 제약을 함께 반영하는 수업 판단을 확인합니다.",
    example:
      "핵심 개념은 공통으로 다룬 뒤 대표 쟁점 하나에서 멈춰 자료를 비교하고 서로 다른 해석을 토론했습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "high-assessment-pressure",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["high"],
    prompt:
      "시험과 진로 부담이 큰 시기에도 ‘틀려도 고쳐 볼 수 있다’는 여유를 만드는 수업 장치가 있나요? 자주 쓰는 것 하나를 알려 주세요.",
    intent:
      "평가 부담 속 심리적 안전과 학습 주도성을 지원하는 원칙을 확인합니다.",
    example:
      "정답 확인 전에 익명 질문을 받고 초안을 한 번 수정하게 합니다. 평가와 바로 연결하지 않는 짧은 탐구 시간도 둡니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
