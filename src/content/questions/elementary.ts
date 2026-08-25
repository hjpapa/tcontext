import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "사람 이름, 전화번호, 이메일, 식별번호, 생년월일, 상세 주소, 정확한 학교나 반 이름, 개인과 연결되는 건강, 상담, 성적 정보는 적지 마세요. 학년, 교과, 대략적인 인원, 수업 환경, 학급 전체의 경향과 필요한 지원은 적어도 됩니다.";

export const ELEMENTARY_QUESTIONS: InterviewQuestion[] = [
  {
    id: "elementary-group-sharing",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["elementary"],
    prompt:
      "모둠이나 전체 활동에서 모두가 한 번씩 참여하도록 어떤 방법을 사용하나요?",
    intent: "모두에게 참여 기회를 주는 방법 하나를 확인합니다.",
    example:
      "모둠 안에서 역할 카드를 돌아가며 맡게 합니다. 말하기 외에도 기록이나 자료 정리 역할을 고를 수 있게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
