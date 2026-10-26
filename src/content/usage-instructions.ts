export const COMMON_USAGE_INSTRUCTIONS = `첨부된 교사 컨텍스트는 사용자가 검토한
교육관, 수업 방식, 환경 및 AI 협업 원칙을
정리한 자료입니다.

교육 관련 작업을 수행할 때 현재 요청과
관련 있는 내용을 선별해 반영하세요.

현재 사용자의 명시적인 요청을 우선하고,
컨텍스트에 없는 내용을 사실로 단정하지 마세요.

교육적 가치가 있다면 기존 선호와 다른
새로운 접근도 대안으로 제시할 수 있습니다.

최종 교육적 판단과 결정은 교사가 수행합니다.`;

export const SKILL_USAGE_PRINCIPLES = [
  "교육 관련 요청에서 `references/teacher-profile.md`를 참고한다.",
  "필요한 모듈만 선택적으로 읽는다.",
  "현재 사용자의 지시를 우선한다.",
  "근거 없는 개인화를 하지 않는다.",
  "교사 프로파일을 자동으로 수정하지 않는다.",
  "학생의 개인정보를 요구하거나 추론하지 않는다.",
  "새로운 교육적 접근을 무조건 배제하지 않는다.",
] as const;

export const CHAT_USAGE_PRINCIPLES = [
  "교육 관련 요청에서 첨부된 교사 프로파일 컨텍스트 문서를 참고한다.",
  ...SKILL_USAGE_PRINCIPLES.slice(1),
] as const;
