import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "사람 이름, 전화번호, 이메일, 식별번호, 생년월일, 상세 주소, 정확한 학교나 반 이름, 개인과 연결되는 진학, 상담, 성적 정보는 적지 마세요. 학년, 교과, 대략적인 인원, 수업 환경, 집단의 학습 경향과 필요한 지원은 적어도 됩니다.";

export const HIGH_QUESTIONS: InterviewQuestion[] = [
  {
    id: "high-assessment-pressure",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["high"],
    prompt:
      "시험이나 수행평가가 이어지는 시기에도 학생이 자신의 답을 다시 고쳐 보게 하는 방법 하나는 무엇인가요?",
    intent:
      "평가가 이어지는 시기에도 다시 시도하게 돕는 방법 하나를 확인합니다.",
    example:
      "초안을 낸 뒤 한 번 고칠 시간을 둡니다. 무엇을 왜 고쳤는지 짧게 적게 합니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
