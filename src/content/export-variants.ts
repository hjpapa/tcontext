export const VARIANT_FORMAT_VERSION = "1.0";

export const CORE_USAGE_RULES = [
  "이 문서는 반복해서 사용하는 교사의 핵심 맥락이다. 교과·단원·성취기준·시간처럼 수업마다 달라지는 정보는 요청에 따로 적는다.",
  "현재 요청의 정보가 이 문서와 다르면 현재 요청을 우선한다.",
  "AI 해석으로 표시된 내용은 교사가 승인한 해석이며, 교사가 직접 말한 사실처럼 단정하지 않는다.",
  "학생 개인을 추정하거나 분류하지 않고, 개인정보를 만들거나 요구하지 않는다.",
  "AI의 제안은 초안이며 최종 판단과 선택은 교사가 한다.",
] as const;

export const CORE_CLAIM_LABELS = {
  direct: "[직접]",
  inferred: "[AI 해석·교사 승인]",
} as const;

export const MODULE_SCOPE_NOTICE = (titles: string) =>
  `이 문서는 교사 프로파일 중 다음 영역만 담고 있습니다: ${titles}. 담기지 않은 영역에 대한 교사의 선호나 조건을 추측하지 말고, 필요하면 사용자에게 먼저 물어보세요.`;

export const AS_OF_NOTICE = (
  date: string,
  source: "confirmed" | "generated",
) =>
  source === "confirmed"
    ? `이 내용은 ${date}에 확정한 기준입니다. 학기나 수업 집단이 바뀌면 다시 확인하세요.`
    : `이 내용은 ${date}에 작성한 기준입니다. 학기나 수업 집단이 바뀌면 다시 확인하세요.`;

export const CORE_EXCLUDED_NOTICE = (
  count: number,
  emptyModuleTitles: readonly string[],
) =>
  `> **확인되지 않은 문장 제외:** 확인되지 않은 문장 ${count}개는 이 핵심본에서 제외했습니다. 전체본에서 확인하고 검토를 마쳐 주세요.${emptyModuleTitles.length ? ` 확인된 문장이 없는 영역: ${emptyModuleTitles.join("·")}.` : ""}`;

export const EMPTY_SECTION_LINE = "- 확인된 내용이 없습니다.";
export const VARIANT_PICKER_HINT =
  "반복해서 쓸 때는 핵심본이 가볍습니다. 특정 작업에는 모듈 선택본을 쓰세요.";

// Copied verbatim from the canonical document; tests guard against drift.
export const EVIDENCE_GUIDE_LINES = [
  "- **교사가 직접 말한 내용**은 인터뷰 답변에 명시된 사실이나 선택이다.",
  "- **AI가 답변을 종합해 해석한 내용**은 여러 답변의 단서를 연결한 설계 가설이며 교사가 수정하거나 삭제할 수 있다.",
  "- **확인하거나 수정할 내용**과 **[검토 전]** 표시는 AI에 사용하기 전에 교사가 먼저 확인해야 한다.",
] as const;
export const PRIVACY_UNVERIFIED_WARNING =
  "> **개인정보 확인 안 됨:** AI 개인정보 최종 검사를 마치지 못한 상태에서 만든 문서입니다. 공유하거나 다른 AI에 입력하기 전에 식별 가능한 정보가 없는지 직접 확인해 주세요. 이 상태의 문서는 서버에 선택 저장할 수 없습니다.";
export const PRIVACY_REVIEW_WARNING =
  "> **개인정보 경고:** 자동 검사에서 확인이 필요한 표현이 남아 있습니다. 공유하거나 다른 AI에 입력하기 전에 식별 가능한 정보가 없는지 직접 다시 확인해 주세요. 이 상태의 문서는 서버에 선택 저장할 수 없습니다.";
export const CLAIM_REVIEW_WARNING =
  "> **검토 필요:** 아직 확인되지 않은 문장이 있습니다. AI에 사용하기 전에 **[검토 전]** 문장을 수정·삭제하거나 확인해 주세요.";

export const VARIANT_SECTION_TITLES = {
  teachingDesignPrinciples: "수업 설계 원칙",
  classSupportConsiderations: "학급 지원 고려사항",
  realisticConstraints: "현실적인 제약과 대체안",
  aiCollaborationInstructions: "AI 협업 지침과 판단 경계",
} as const;

export const CLAIM_GROUPS = [
  { basis: "direct", title: "교사가 직접 말한 내용" },
  { basis: "inferred", title: "AI가 답변을 종합해 해석한 내용" },
  { basis: "needs_confirmation", title: "확인하거나 수정할 내용" },
] as const;
