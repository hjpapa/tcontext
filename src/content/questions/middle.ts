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
      "짧게 만나거나 여러 집단을 오가도 ‘여기는 안전하게 배울 수 있다’고 느끼게 하는 관계 루틴은 무엇인가요? 최근에 쓴 방법 하나를 알려 주세요.",
    intent:
      "중학교의 분업 구조에서 이어지는 관계 형성과 예측 가능한 지원을 파악합니다.",
    example:
      "시작할 때 짧은 안부 질문과 오늘의 순서를 같은 방식으로 보여 줍니다. 필요한 협업은 개인을 평가하지 않고 관찰한 사실 중심으로 나눕니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "middle-autonomy-participation",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["middle"],
    prompt:
      "중학생에게 건네는 선택권 한 가지와 함께 지키는 경계 한 가지는 무엇인가요? 공개 발표 말고 참여할 통로도 알려 주세요.",
    intent:
      "사춘기 학습자의 자율성과 안전한 참여를 함께 지원하는 원칙을 확인합니다.",
    example:
      "핵심 목표와 존중 규칙은 함께 지키고 주제와 표현 방식은 고르게 합니다. 전체 공유 전 메모나 소규모 대화로 참여할 수 있습니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
