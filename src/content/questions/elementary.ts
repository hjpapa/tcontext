import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "학생 이름, 학교·반 이름, 진단명, 개별 점수는 적지 말고 학급 수준의 경향과 필요한 지원만 적어 주세요.";

export const ELEMENTARY_QUESTIONS: InterviewQuestion[] = [
  {
    id: "elementary-group-sharing",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["elementary"],
    prompt:
      "모둠이나 전체 활동에서 참여 기회가 고르게 돌아가도록 만드는 가장 효과적인 장치는 무엇인가요?",
    intent: "참여 기회를 고르게 만드는 핵심 수업 장치를 확인합니다.",
    example: "모둠마다 돌아가며 말하는 순서를 정합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
