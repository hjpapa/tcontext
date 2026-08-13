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
      "모둠이나 전체 활동에서 모두에게 말하거나 해 볼 기회를 주는 방법 하나는 무엇인가요?",
    intent: "모두에게 참여 기회를 주는 방법 하나를 확인합니다.",
    example: "모둠 안에서 말하는 순서를 돌아가며 정합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
