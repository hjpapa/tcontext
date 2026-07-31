import type { PrivacyRiskType, SupportCenteredRewrite } from "@/types/privacy";

const SUPPORT_REWRITES: Partial<Record<PrivacyRiskType, string>> = {
  email: "연락처를 제외하고 수업 지원에 필요한 맥락만 적어 주세요.",
  phone: "연락처를 제외하고 수업 지원에 필요한 맥락만 적어 주세요.",
  resident_registration_number:
    "개인 식별번호를 삭제하고 집단 수준의 수업 맥락만 적어 주세요.",
  birth_date: "생년월일을 삭제하고 발달 단계에 필요한 지원만 적어 주세요.",
  address: "주소를 삭제하고 수업 환경에 필요한 조건만 적어 주세요.",
  student_name:
    "이름 대신 '일부 학생'처럼 집단 수준으로 표현하고 필요한 지원을 설명해 주세요.",
  person_name:
    "실명 대신 역할 또는 '일부 학생'처럼 개인을 특정하지 않는 표현을 사용해 주세요.",
  individual_score:
    "개별 점수 대신 학습 지원이 필요한 영역과 도움이 되는 교수 방법을 적어 주세요.",
  rank: "등수 대신 학습 지원이 필요한 영역과 도움이 되는 교수 방법을 적어 주세요.",
  medical_or_counseling:
    "진단·상담 정보 대신 관찰 가능한 학습 상황과 필요한 수업 지원을 적어 주세요.",
  school_name:
    "학교명은 삭제하고 학교급과 수업 환경처럼 필요한 범위만 적어 주세요.",
  stigmatizing_description:
    "학생을 특성으로 규정하지 말고, 관찰되는 상황과 효과적인 지원을 적어 주세요.",
};

export function suggestionForRisk(type: PrivacyRiskType): string {
  return (
    SUPPORT_REWRITES[type] ??
    "개인을 특정할 수 있는 표현을 삭제하고 필요한 수업 지원 중심으로 적어 주세요."
  );
}

const DIRECT_REWRITES: Array<{
  pattern: RegExp;
  replacement: string;
  reason: string;
}> = [
  {
    pattern:
      /수학(?:을|이)\s*(?:못하(?:는|고)|부족한)\s*학생(?:이|은|들이)?\s*(?:\d+\s*명)?\s*(?:있다|있음|많다)?[.!]?/giu,
    replacement:
      "수학 기초학습 지원이 필요한 학생이 일부 있으며, 구체물과 단계별 안내가 도움이 된다.",
    reason: "학습 수준의 낙인 표현을 지원이 필요한 영역과 방법으로 바꿨습니다.",
  },
  {
    pattern: /산만한\s*학생(?:이|은|들이)?\s*(?:많다|있다|있음)?[.!]?/giu,
    replacement:
      "설명이 길어질 때 일부 학생의 집중이 흐트러질 수 있어 짧은 안내와 활동 단계 표시가 필요하다.",
    reason: "학생을 규정하는 표현을 집중을 돕는 수업 조건으로 바꿨습니다.",
  },
  {
    pattern:
      /(?:[가-힣]{2,4}|[○◯O]{2,4})\s*학생(?:은|이|에게는?)?\s*(?:ADHD|주의력결핍(?:과잉행동)?장애)(?:가|이)?\s*(?:있다|있음|이다)?[.!]?/giu,
    replacement:
      "집중과 활동 전환을 지원하기 위해 시각적 순서 안내와 짧은 과제 단위가 필요하다.",
    reason: "개인과 진단을 삭제하고 수업에서 제공할 지원으로 바꿨습니다.",
  },
  {
    pattern:
      /(?:[가-힣]{2,4}|[○◯O]{2,4})\s*학생(?:은|이)?[^.!?\n]{0,20}?\d{1,3}\s*점(?:이다|을\s*받았다|임)?[.!]?/giu,
    replacement:
      "해당 학습 영역에서 단계별 지원이 필요한 학생이 일부 있어, 기초 개념 확인과 다양한 예시를 제공한다.",
    reason: "개인 식별 표현과 점수를 삭제하고 학습 지원 방식으로 바꿨습니다.",
  },
  {
    pattern: /(?:문제|게으른|느린|말썽(?:꾸러기)?|공부를\s*못하는)\s*학생/giu,
    replacement: "추가적인 참여 지원이 필요한 학생",
    reason: "학생을 낙인찍는 표현을 지원 중심 표현으로 바꿨습니다.",
  },
];

/**
 * Produces a suggestion only. The teacher remains responsible for reviewing
 * and accepting every rewrite.
 */
export function rewriteStudentDescription(
  input: string,
): SupportCenteredRewrite {
  let rewritten = input.trim();
  const reasons: string[] = [];

  for (const rule of DIRECT_REWRITES) {
    const next = rewritten.replace(rule.pattern, rule.replacement);
    if (next !== rewritten) {
      rewritten = next;
      reasons.push(rule.reason);
    }
  }

  return {
    original: input,
    rewritten,
    changed: rewritten !== input.trim(),
    reasons: [...new Set(reasons)],
  };
}

export const rewriteToSupportCentered = rewriteStudentDescription;
