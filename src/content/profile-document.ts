import type { SchoolLevel } from "@/types/profile";

export const CONTEXT_DOCUMENT_TITLE = "수업 설계를 위한 교사 프로파일 컨텍스트";

export const CONTEXT_DOCUMENT_FORMAT_VERSION = "2.0";

export const SCHOOL_LEVEL_DISPLAY_LABELS: Record<SchoolLevel, string> = {
  kindergarten: "유치원",
  elementary: "초등학교",
  middle: "중학교",
  high: "고등학교",
};

export const AI_CONTEXT_PRIORITIES = [
  "개인정보와 학생의 안전",
  "성취기준과 학습목표",
  "이 문서에서 교사가 확인한 수업 원칙과 학습 증거",
  "접근성과 정서적 안전",
  "교실에서의 실행 가능성",
  "교사의 준비 부담과 자료 재사용성",
] as const;

export const PROFILE_INTERPRETATION_RULES = [
  "개인적 가치와 판단 기준은 교사가 밝힌 조건과 예외를 함께 적용한다. 현재 요청이 그 원칙과 충돌하면 임의로 덮어쓰지 말고 충돌과 대안을 설명해 확인한다.",
  "교사가 밝힌 AI 작업·답변 형식·말투·대안 비교 선호를 반영한다. 말하지 않은 선호를 만들지 않는다.",
  "AI 해석과 확인 필요 문장, 미검토 문장 및 그로부터 만든 요약·실행 지침은 확정된 개인 특성으로 취급하지 않는다. 근거가 없는 영역은 미상으로 남긴다.",
  "현재 수업의 교과·단원·성취기준·시간 정보가 이 프로필과 다르면 현재 작업 정보를 우선한다.",
  "문서에 없는 사실을 만들지 말고, 수업 설계에 꼭 필요한 정보만 최대 세 가지까지 먼저 질문한다.",
  "학생의 필요는 개인을 규정하는 특성이 아니라 교사가 제공할 수 있는 집단 수준의 지원으로 해석한다.",
  "AI의 제안은 초안이며 수업에 대한 최종 판단과 선택은 교사가 한다.",
] as const;

export const LESSON_DESIGN_SELF_CHECKS = [
  "학습목표와 활동·평가가 서로 맞물리는가?",
  "학습목표와 교사 프로필에 맞는 참여 기회가 학생의 실제 행동으로 설계되었는가?",
  "다양한 참여 방식과 정서적으로 안전한 진입점이 있는가?",
  "주어진 시간·자료·기기와 준비 여건에서 실행 가능한가?",
  "개인정보·저작권·사실 검증·AI 의존 위험을 확인했는가?",
] as const;

export const LESSON_TASK_CONTEXT_ITEMS = [
  "작업 유형과 원하는 결과물",
  "학년·교과·단원 또는 주제",
  "성취기준·학습목표·핵심 질문",
  "수업 시간과 차시 수",
  "학생이 수행할 핵심 활동",
  "사용 가능한 기기·도구·자료",
  "집단 수준의 학습·참여·정서 지원",
  "학생의 AI 사용 범위와 현실적인 제약",
] as const;

export const AI_EXECUTION_INSTRUCTIONS = [
  "현재 작업 정보가 교사 프로필과 다르면 현재 작업 정보를 우선한다.",
  "결과에 큰 영향을 주는 정보가 부족하면 질문을 최대 세 개만 한다.",
  "교사의 설명과 학생이 실제로 수행할 행동을 함께 분명히 설계한다.",
  "교사 프로필에서 확인된 참여 방식과 집단 수준 지원을 반영한다.",
  "AI가 필요하지 않으면 억지로 넣지 않고 개인정보를 추정하거나 요구하지 않는다.",
  "가정과 교사가 최종 선택할 지점을 결과 끝에 명확히 표시한다.",
] as const;

export const RESULT_USAGE_STEPS = [
  {
    title: "교사 컨텍스트를 함께 전달",
    description:
      "다운로드한 Markdown을 수업 설계 요청의 기본 배경으로 첨부합니다.",
  },
  {
    title: "이번 수업 정보만 추가",
    description:
      "문서 끝의 작업 양식에 교과·단원·목표·시간·자료·원하는 결과물을 채웁니다.",
  },
  {
    title: "제안은 교사가 최종 판단",
    description:
      "목표 정합성, 학생 참여, 지원, 실행 가능성, 개인정보를 확인하고 필요한 부분을 고칩니다.",
  },
] as const;
