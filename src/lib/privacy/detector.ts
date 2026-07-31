import { rewriteStudentDescription, suggestionForRisk } from "./rewrite";

import type {
  PrivacyMatch,
  PrivacyRiskSeverity,
  PrivacyRiskType,
  PrivacyScanResult,
} from "@/types/privacy";
import type { TeacherContextProfile } from "@/types/profile";
import type { PrivacyReview } from "@/types/profile";

type PatternDefinition = {
  type: PrivacyRiskType;
  severity: PrivacyRiskSeverity;
  regex: RegExp;
  reason: string;
  ignore?: (match: string) => boolean;
};

const SAFE_COLLECTIVE_PREFIXES = new Set([
  "일부",
  "여러",
  "모든",
  "전체",
  "우리",
  "해당",
  "몇몇",
  "대부분",
  "이런",
  "저런",
  "어떤",
  "하는",
  "있는",
  "없는",
  "필요한",
  "부담스러운",
  "어려운",
  "산만한",
  "느린",
  "안내와",
]);

const KOREAN_SURNAMES =
  "김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민류나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용";

const PATTERNS: PatternDefinition[] = [
  {
    type: "email",
    severity: "high",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    reason: "이메일 주소는 개인을 직접 식별할 수 있습니다.",
  },
  {
    type: "phone",
    severity: "high",
    regex:
      /(?<!\d)(?:01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4})(?!\d)/gu,
    reason: "전화번호는 개인을 직접 식별할 수 있습니다.",
  },
  {
    type: "resident_registration_number",
    severity: "high",
    regex: /(?<!\d)\d{6}[-\s]?[1-4]\d{6}(?!\d)/gu,
    reason: "주민등록번호 형식의 민감한 식별정보가 포함되어 있습니다.",
  },
  {
    type: "birth_date",
    severity: "high",
    regex:
      /(?:생년월일(?:은|이|:)?\s*)?(?:19|20)\d{2}(?:년|[-/.])\s*(?:0?[1-9]|1[0-2])(?:월|[-/.])\s*(?:0?[1-9]|[12]\d|3[01])일?/gu,
    reason: "구체적인 생년월일은 개인 식별 가능성을 높입니다.",
  },
  {
    type: "address",
    severity: "high",
    regex:
      /(?:서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원(?:특별자치)?도|충청[남북]도|전라[남북]도|경상[남북]도|제주특별자치도)\s+[가-힣0-9]+(?:시|군|구)\s+[가-힣0-9·.-]+(?:로|길|동|읍|면)(?:\s+\d+(?:-\d+)?)?/gu,
    reason: "구체적인 주소는 개인 또는 학교를 특정할 수 있습니다.",
  },
  {
    type: "student_name",
    severity: "high",
    regex: new RegExp(
      `(?<![가-힣])(?:[${KOREAN_SURNAMES}][가-힣]{1,2}|[○◯O]{2,4})\\s*학생`,
      "gu",
    ),
    reason: "학생 이름으로 보이는 표현이 포함되어 있습니다.",
    ignore: (match) =>
      SAFE_COLLECTIVE_PREFIXES.has(match.replace(/\s*학생$/u, "")),
  },
  {
    type: "person_name",
    severity: "high",
    regex: new RegExp(
      `(?:이름(?:은|이|:|：)\\s*(?:[${KOREAN_SURNAMES}][가-힣]{1,2}|[○◯O]{2,4})|(?:교사|선생님)\\s*(?:이름(?:은|이|:|：)|[:：])\\s*(?:[${KOREAN_SURNAMES}][가-힣]{2}|[○◯O]{2,4}))(?![가-힣])`,
      "gu",
    ),
    reason: "교사 또는 개인의 실명으로 보이는 표현이 포함되어 있습니다.",
  },
  {
    type: "individual_score",
    severity: "high",
    regex:
      /(?:[가-힣]{2,4}|[○◯O]{2,4}|그\s*학생|해당\s*학생)?\s*(?:점수(?:는|가|:)?\s*)?\d{1,3}(?:\.\d+)?\s*점(?!검)/gu,
    reason: "개별 점수로 보이는 정보가 포함되어 있습니다.",
  },
  {
    type: "rank",
    severity: "high",
    regex: /(?:석차(?:는|가|:)?\s*\d+|\d+\s*(?:등|위))(?:\s*\/\s*\d+)?/gu,
    reason: "개별 석차나 등수로 보이는 정보가 포함되어 있습니다.",
  },
  {
    type: "medical_or_counseling",
    severity: "high",
    regex:
      /(?:ADHD|주의력결핍(?:과잉행동)?장애|자폐(?:스펙트럼)?|우울증|불안장애|틱장애|난독증|지적장애|진단명|진단받|상담\s*기록|상담\s*내용|치료\s*중|약\s*복용|건강\s*정보|병력)/giu,
    reason:
      "의료·진단·상담 정보는 매우 민감하며 수업 지원 설명에 필요하지 않습니다.",
  },
  {
    type: "school_name",
    severity: "high",
    regex: /[가-힣]{2,20}(?:초등학교|중학교|고등학교|유치원|특수학교)(?!급)/gu,
    reason: "구체적인 학교명으로 보이는 표현이 포함되어 있습니다.",
  },
  {
    type: "stigmatizing_description",
    severity: "medium",
    regex:
      /(?:산만한|문제(?:가\s*많은)?|게으른|말썽(?:꾸러기)?|공부를\s*못하는|수학을\s*못하는|느린)\s*학생/gu,
    reason:
      "학생을 고정된 특성으로 규정할 수 있어 관찰 상황과 필요한 지원으로 바꾸어야 합니다.",
  },
];

const NOTICE =
  "자동 감지는 보조 수단이며 모든 개인정보를 찾아내지는 못합니다. 전송 전 이름, 학교명, 연락처, 개별 성적, 건강·상담 정보를 직접 다시 확인해 주세요.";

export function detectPrivacyRisks(text: string): PrivacyScanResult {
  const matches: PrivacyMatch[] = [];
  const supportRewrite = rewriteStudentDescription(text);

  for (const definition of PATTERNS) {
    const regex = new RegExp(definition.regex.source, definition.regex.flags);
    for (const match of text.matchAll(regex)) {
      const matchedText = match[0];
      const start = match.index;
      if (
        start === undefined ||
        (definition.ignore && definition.ignore(matchedText))
      ) {
        continue;
      }

      matches.push({
        type: definition.type,
        severity: definition.severity,
        start,
        end: start + matchedText.length,
        matchedText,
        reason: definition.reason,
        suggestedRewrite: supportRewrite.changed
          ? supportRewrite.rewritten
          : suggestionForRisk(definition.type),
      });
    }
  }

  const deduplicated = matches
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (other) =>
            other.type === candidate.type &&
            other.start === candidate.start &&
            other.end === candidate.end,
        ) === index,
    );

  return {
    status: deduplicated.length === 0 ? "clear" : "blocked",
    matches: deduplicated,
    notice: NOTICE,
  };
}

export const scanForSensitiveInformation = detectPrivacyRisks;

export function containsPrivacyRisk(text: string): boolean {
  return detectPrivacyRisks(text).status === "blocked";
}

export function reviewProfilePrivacy(
  profile: TeacherContextProfile,
): PrivacyReview {
  const texts = [
    profile.profileTitle,
    profile.shortSummary,
    ...profile.modules.flatMap((module) => [
      module.summary,
      ...module.claims.map((claim) => claim.text),
    ]),
    ...profile.teachingDesignPrinciples,
    ...profile.classSupportConsiderations,
    ...profile.realisticConstraints,
    ...profile.aiCollaborationInstructions,
  ];

  const items = texts.flatMap((text) => {
    const scan = detectPrivacyRisks(text);
    if (scan.matches.length === 0) return [];
    return [
      {
        text,
        reason: [...new Set(scan.matches.map((match) => match.reason))].join(
          " ",
        ),
        suggestedRewrite:
          scan.matches[0]?.suggestedRewrite ??
          "개인을 특정하지 않는 지원 중심 표현으로 수정해 주세요.",
      },
    ];
  });

  return items.length > 0
    ? { status: "needs_review", items }
    : { status: "clear", items: [] };
}
