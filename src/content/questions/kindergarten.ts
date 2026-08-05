import type { InterviewQuestion } from "@/types/interview";

const PRIVACY_HINT =
  "유아 이름, 기관명, 건강·발달 진단이나 가정환경은 적지 말고 관찰 가능한 집단 경향과 지원 방법만 적어 주세요.";

export const KINDERGARTEN_QUESTIONS: InterviewQuestion[] = [
  {
    id: "kindergarten-play-intervention",
    moduleId: "preferred_teaching",
    source: "school_level",
    schoolLevels: ["kindergarten"],
    prompt:
      "놀이가 교사에게 ‘같이 도와주세요’라는 신호를 보내는 순간은 언제인가요? 최근 장면에서 한 발 들어가거나 기다리기로 한 기준을 알려 주세요.",
    intent: "놀이 중심 교육에서 관찰, 선택과 교사 개입의 균형을 파악합니다.",
    example:
      "같은 놀이가 오래 반복되고 새 참여가 이어지지 않을 때를 신호로 봅니다. 다른 재료와 질문 하나만 건넨 뒤 다시 기다렸습니다.",
    privacyHint: PRIVACY_HINT,
    required: true,
  },
  {
    id: "kindergarten-transition",
    moduleId: "participation_and_emotion",
    source: "school_level",
    schoolLevels: ["kindergarten"],
    prompt:
      "놀이에서 다음 일과로 건너가는 ‘다리’로 어떤 신호를 쓰나요? 전환이 쉽지 않을 때 더하는 선택지나 지원도 알려 주세요.",
    intent:
      "발달 특성을 고려한 정서적으로 안전한 전환과 참여 지원을 확인합니다.",
    example:
      "그림 순서표와 익숙한 노래로 미리 알립니다. 정리는 작은 역할로 나누어 고르게 하고 조금 더 준비할 시간도 보여 줍니다.",
    privacyHint: PRIVACY_HINT,
    required: false,
  },
];
