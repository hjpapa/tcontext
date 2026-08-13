import { rewriteStudentDescription, suggestionForRisk } from "./rewrite";
import { isGenericEducationalRoleDescriptor } from "./name-context";

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

const KOREAN_SURNAMES =
  "김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민류나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용";

const LIKELY_KOREAN_FULL_NAME_PATTERN = `[${KOREAN_SURNAMES}][가-힣]{2,3}`;
const EXPLICIT_KOREAN_NAME_PATTERN = "[가-힣]{2,4}";
const EXPLICIT_ENGLISH_NAME_PATTERN =
  "[A-Z][A-Za-z'-]+(?:\\s+[A-Z][A-Za-z'-]+){0,2}";
const LABELED_NAME_CORE_PATTERN = `(?:${EXPLICIT_KOREAN_NAME_PATTERN}|${EXPLICIT_ENGLISH_NAME_PATTERN})(?:\\s*(?:씨|님))?`;
const LABELED_NAME_ENDING_PATTERN =
  "(?:입니다|이다|이며|이고|예요|이에요|라고\\s*(?:합니다|해요))";
const LABELED_NAME_VALUE_PATTERN = `(?!(?:["'“‘「]\\s*)?(?:익명|미상|없음|없다|비공개|가명)(?:\\s*["'”’」])?(?=$|[,.;:!?]))(?:"\\s*${LABELED_NAME_CORE_PATTERN}\\s*"|'\\s*${LABELED_NAME_CORE_PATTERN}\\s*'|“\\s*${LABELED_NAME_CORE_PATTERN}\\s*”|‘\\s*${LABELED_NAME_CORE_PATTERN}\\s*’|「\\s*${LABELED_NAME_CORE_PATTERN}\\s*」|${LABELED_NAME_CORE_PATTERN})(?:\\s*${LABELED_NAME_ENDING_PATTERN})?(?=$|[,.;:!?])`;
const ENGLISH_FULL_NAME_PATTERN =
  "[A-Z][A-Za-z'-]+(?:\\s+[A-Z][A-Za-z'-]+){1,2}";
const STUDENT_ROLE_PATTERN = "(?:학생|유아|아동)";
const ADULT_ROLE_PATTERN = "(?:교사|선생님|보호자)";
const NAME_TRAILING_CONTEXT_PATTERN =
  "(?=$|[은이는의에게을를과와도가로,.;:!?])";
const NAMED_STUDENT_CONTEXT_PATTERN = `(?:${LIKELY_KOREAN_FULL_NAME_PATTERN}\\s+${STUDENT_ROLE_PATTERN}(?!들)|${ENGLISH_FULL_NAME_PATTERN}\\s+${STUDENT_ROLE_PATTERN}(?!들)|${STUDENT_ROLE_PATTERN}(?!들)\\s+(?:${LIKELY_KOREAN_FULL_NAME_PATTERN}?|${ENGLISH_FULL_NAME_PATTERN})(?=(?:은|는|이|가|의|에게|을|를|과|와|도|만|로))|${STUDENT_ROLE_PATTERN}(?!들)\\s+(?:${LIKELY_KOREAN_FULL_NAME_PATTERN}|${ENGLISH_FULL_NAME_PATTERN})(?=$|[,.;:!?])|${STUDENT_ROLE_PATTERN}\\s*(?:이름|성명|실명)\\s*(?:은|는|이|가|:|：)?\\s*${LABELED_NAME_VALUE_PATTERN})${NAME_TRAILING_CONTEXT_PATTERN}`;
const NAMED_ADULT_CONTEXT_PATTERN = `(?:${LIKELY_KOREAN_FULL_NAME_PATTERN}\\s+${ADULT_ROLE_PATTERN}|${ENGLISH_FULL_NAME_PATTERN}\\s+${ADULT_ROLE_PATTERN}|${ADULT_ROLE_PATTERN}\\s+(?:${LIKELY_KOREAN_FULL_NAME_PATTERN}?|${ENGLISH_FULL_NAME_PATTERN})(?=(?:은|는|이|가|의|에게|을|를|과|와|도|만|로))|${ADULT_ROLE_PATTERN}\\s+(?:${LIKELY_KOREAN_FULL_NAME_PATTERN}|${ENGLISH_FULL_NAME_PATTERN})(?=$|[,.;:!?])|${ADULT_ROLE_PATTERN}\\s*(?:이름|성명|실명)\\s*(?:은|는|이|가|:|：)?\\s*${LABELED_NAME_VALUE_PATTERN}|(?:제|내|본인(?:의)?)\\s*(?:이름|성명|실명)\\s*(?:은|는|이|가|:|：)?\\s*${LABELED_NAME_VALUE_PATTERN}|(?:성명|실명)\\s*(?:은|는|이|가|:|：)\\s*${LABELED_NAME_VALUE_PATTERN})${NAME_TRAILING_CONTEXT_PATTERN}`;
const SAFE_ROLE_DESCRIPTORS = new Set([
  "일부",
  "여러",
  "모든",
  "모두",
  "전체",
  "우리",
  "해당",
  "특정",
  "개별",
  "몇몇",
  "대부분",
  "어떤",
  "이런",
  "저런",
  "많은",
  "하는",
  "있는",
  "없는",
  "필요한",
  "부담스러운",
  "어려운",
  "산만한",
  "느린",
  "국어",
  "수학",
  "영어",
  "과학",
  "사회",
  "도덕",
  "음악",
  "미술",
  "체육",
  "정보",
  "한문",
  "진로",
  "상담",
  "보건",
  "사서",
  "특수",
  "영양",
  "담임",
  "교과",
  "전담",
  "보조",
  "협력",
  "지원",
  "담당",
  "원어민",
  "기간제",
  "계약직",
  "신규",
  "초임",
  "현직",
  "현재",
  "전입",
  "동료",
  "수석",
  "파견",
  "대체",
  "유치원",
  "어린이집",
  "초등",
  "초등학교",
  "중등",
  "고등",
  "중학교",
  "고등학교",
  "특수학교",
  "원아",
]);
const GENERIC_SCHOOL_PREFIXES = new Set([
  "우리",
  "저희",
  "해당",
  "현재",
  "근무하는",
  "다니는",
  "일반",
  "특성화",
  "자율형",
  "공립",
  "사립",
]);
const GENERIC_INSTITUTION_PREFIXES = new Set([
  "우리",
  "저희",
  "해당",
  "특정",
  "지역",
  "관할",
  "현재",
  "교육",
]);
const GENERIC_CLASS_PREFIXES = new Set([
  "우리",
  "저희",
  "해당",
  "전체",
  "개별",
  "일부",
  "여러",
  "모든",
  "일반",
  "전반",
  "후반",
  "초반",
  "중반",
  "절반",
  "기반",
  "과반",
  "특별",
  "통합",
  "지원",
  "기초",
  "심화",
  "방과후",
  "소규모",
  "대규모",
  "혼합",
  "복식",
  "다문화",
  "특수",
  "학습지원",
  "나침",
]);
const MEDICAL_TERM_PATTERN =
  "(?:ADHD|주의력결핍(?:과잉행동)?장애|자폐(?:스펙트럼)?|우울증|불안장애|틱장애|난독증|지적장애|진단받|치료\\s*중|약(?:을|을\\s*)?\\s*복용|상담을\\s*받)";
const GENERIC_EDUCATIONAL_MODIFIER =
  /^(?:(?:선택|이해|지원|질문|발표|설명|참여|응답|도전|시도|수정|작성|제출|관찰|기록|준비|신청|희망|요청|학습|활동|토론|탐구|협력|공유|완료|정리|구성|고민|조사|정돈|구별|비교|분석|결정|해결|계획|실행|검토|확인|연습|복습|제안|선정|분류)(?:한|하는|했던|할)|고른|마친|고친|배운)$/u;

const KOREAN_SYLLABLE_START = 0xac00;
const KOREAN_SYLLABLE_END = 0xd7a3;
const KOREAN_JONGSEONG_COUNT = 28;

function hasFinalConsonant(text: string) {
  const lastSyllable = text.codePointAt(text.length - 1);
  if (
    lastSyllable === undefined ||
    lastSyllable < KOREAN_SYLLABLE_START ||
    lastSyllable > KOREAN_SYLLABLE_END
  ) {
    return null;
  }

  return (lastSyllable - KOREAN_SYLLABLE_START) % KOREAN_JONGSEONG_COUNT !== 0;
}

/**
 * Distinguishes a case-marked noun before a role (`배움은 학생이`) from an
 * unmarked name (`김민수 학생이`). Particle agreement is structural, so this
 * does not require an ever-growing vocabulary of educational nouns. Names such as
 * `김다은` and `김가을` remain blocked because removing their final syllable
 * does not produce a stem that agrees with that syllable as a particle.
 */
function isCaseMarkedRolePhrase(descriptor: string) {
  const particle = descriptor.at(-1);
  if (!particle || !/[은는이가을를과와]/u.test(particle)) return false;

  const stem = descriptor.slice(0, -1);
  const finalConsonant = hasFinalConsonant(stem);
  if (finalConsonant === null) return false;

  return finalConsonant
    ? /[은이을과]/u.test(particle)
    : /[는가를와]/u.test(particle);
}

function isValidCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isStructurallyValidResidentNumber(match: string) {
  const digits = match.replace(/[-\s]/gu, "");
  if (!/^\d{13}$/u.test(digits)) return false;

  const yearPart = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const centuryCode = Number(digits[6]);
  const century = [1, 2, 5, 6].includes(centuryCode) ? 1900 : 2000;

  return isValidCalendarDate(century + yearPart, month, day);
}

function containsValidLabeledDate(match: string) {
  const date = match.match(
    /((?:19|20)\d{2})(?:년|[-/.])\s*(0?[1-9]|1[0-2])(?:월|[-/.])\s*(0?[1-9]|[12]\d|3[01])/u,
  );
  if (!date) return false;

  return isValidCalendarDate(Number(date[1]), Number(date[2]), Number(date[3]));
}

function isGenericPrivacyPolicyStatement(match: string) {
  return /(?:없이|없음|없다|익명|미상|입력하지|공유하지|저장하지|남기지|기록하지|수집하지|포함하지|제공하지)/u.test(
    match,
  );
}

function isGenericRoleDescription(match: string) {
  if (
    /(?:이름|성명|실명)\s*(?:은|는|이|가|:|：)?\s*(?:익명|미상|없음|없다|비공개|가명)/u.test(
      match,
    )
  ) {
    return true;
  }
  if (
    /(?:성명|실명)\s*(?:은|는|이|가)\s*(?:입력|기록|저장|공유|수집|포함|제공|삭제|제외|표기)/u.test(
      match,
    )
  ) {
    return true;
  }
  // A labeled value is stronger evidence than the coincidental particle-like
  // ending in `이름은`; do not route it through the generic noun filter.
  if (/(?:이름|성명|실명)/u.test(match)) return false;

  const descriptor =
    match.match(
      /^([가-힣]{2,4})\s*(?:학생|유아|아동|교사|선생님|보호자)/u,
    )?.[1] ??
    match.match(
      /^(?:학생|유아|아동|교사|선생님|보호자)\s+([가-힣]{2,6})/u,
    )?.[1];
  return descriptor
    ? SAFE_ROLE_DESCRIPTORS.has(descriptor) ||
        isGenericEducationalRoleDescriptor(descriptor) ||
        GENERIC_EDUCATIONAL_MODIFIER.test(descriptor) ||
        isCaseMarkedRolePhrase(descriptor) ||
        /(?:에서|에게|으로|하고|하며|보다|마다|처럼|까지|부터|와|과|의|내|중|별|반|한|된|운|는|인|할|했던|로운|스러운)$/u.test(
          descriptor,
        )
    : false;
}

function isGenericSchoolReference(match: string) {
  const prefix = match.match(
    /^([가-힣]+?)(?:초등학교|중학교|고등학교|유치원|특수학교)$/u,
  )?.[1];
  return prefix ? GENERIC_SCHOOL_PREFIXES.has(prefix) : false;
}

function isGenericInstitutionReference(match: string) {
  const prefix = match.match(
    /^([가-힣]+?)(?:교육지원청|교육청|교육대학교|대학교)$/u,
  )?.[1];
  return prefix ? GENERIC_INSTITUTION_PREFIXES.has(prefix) : false;
}

function isGenericNamedClassReference(match: string) {
  const prefix = match.match(/^([가-힣]+)반$/u)?.[1];
  return prefix ? GENERIC_CLASS_PREFIXES.has(prefix) : false;
}

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
    regex: /(?<!\d)\d{6}[-\s]?[1-8]\d{6}(?!\d)/gu,
    reason: "주민등록번호 형식의 민감한 식별정보가 포함되어 있습니다.",
    ignore: (match) => !isStructurallyValidResidentNumber(match),
  },
  {
    type: "birth_date",
    severity: "high",
    regex:
      /(?:생년월일|생일|출생(?:일자)?)(?:은|이|:|：)?\s*(?:19|20)\d{2}(?:년|[-/.])\s*(?:0?[1-9]|1[0-2])(?:월|[-/.])\s*(?:0?[1-9]|[12]\d|3[01])일?/gu,
    reason: "구체적인 생년월일은 개인 식별 가능성을 높입니다.",
    ignore: (match) => !containsValidLabeledDate(match),
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
    regex: new RegExp(`(?<![가-힣])${NAMED_STUDENT_CONTEXT_PATTERN}`, "gu"),
    reason: "학생 이름으로 보이는 표현이 포함되어 있습니다.",
    ignore: isGenericRoleDescription,
  },
  {
    type: "person_name",
    severity: "high",
    regex: new RegExp(`(?<![가-힣])${NAMED_ADULT_CONTEXT_PATTERN}`, "gu"),
    reason: "교사 또는 개인의 실명으로 보이는 표현이 포함되어 있습니다.",
    ignore: isGenericRoleDescription,
  },
  {
    type: "person_name",
    severity: "high",
    regex: new RegExp(
      `(?<![가-힣])(?:성명|실명)\\s*(?:은|는|이|가|:|：)\\s*${LABELED_NAME_VALUE_PATTERN}`,
      "gu",
    ),
    reason: "개인의 성명 또는 실명으로 보이는 표현이 포함되어 있습니다.",
    ignore: isGenericRoleDescription,
  },
  {
    type: "individual_score",
    severity: "high",
    regex: new RegExp(
      `(?<![가-힣])${NAMED_STUDENT_CONTEXT_PATTERN}(?:의|은|는|이|가)?[^.!?\\n]{0,30}?(?:(?:개별\\s*)?점수(?:는|가|:|：)?\\s*)?\\d{1,3}(?:\\.\\d+)?\\s*점(?!검|\\s*만점)`,
      "gu",
    ),
    reason: "실명과 결합된 개별 점수로 보이는 정보가 포함되어 있습니다.",
  },
  {
    type: "rank",
    severity: "high",
    regex: new RegExp(
      `(?<![가-힣])${NAMED_STUDENT_CONTEXT_PATTERN}(?:의|은|는|이|가)?[^.!?\\n]{0,30}?(?:(?:석차|순위)(?:는|가|:|：)?\\s*\\d{1,4}(?:\\s*\\/\\s*\\d{1,4})?|\\d{1,4}\\s*(?:등|위)(?:\\s*\\/\\s*\\d{1,4})?)`,
      "gu",
    ),
    reason: "실명과 결합된 개별 석차나 등수로 보이는 정보가 포함되어 있습니다.",
  },
  {
    type: "medical_or_counseling",
    severity: "high",
    regex: new RegExp(
      `(?:${NAMED_STUDENT_CONTEXT_PATTERN})[^.!?\\n]{0,50}${MEDICAL_TERM_PATTERN}|${MEDICAL_TERM_PATTERN}[^.!?\\n]{0,30}(?:${NAMED_STUDENT_CONTEXT_PATTERN})`,
      "giu",
    ),
    reason: "실명과 결합된 의료·진단·상담 정보가 포함되어 있습니다.",
  },
  {
    type: "school_name",
    severity: "high",
    regex: /[가-힣]{2,20}(?:초등학교|중학교|고등학교|유치원|특수학교)(?!급)/gu,
    reason: "구체적인 학교명으로 보이는 표현이 포함되어 있습니다.",
    ignore: isGenericSchoolReference,
  },
  {
    type: "school_name",
    severity: "high",
    regex: /[가-힣A-Za-z0-9·-]{2,30}(?:교육지원청|교육청|교육대학교|대학교)/gu,
    reason:
      "구체적인 학교 또는 교육기관명으로 보이는 표현이 포함되어 있습니다.",
    ignore: isGenericInstitutionReference,
  },
  {
    type: "school_name",
    severity: "high",
    regex:
      /(?<![가-힣\d])(?:\d{1,2}\s*학년\s*)?\d{1,2}\s*반(?=$|[\s은는이가의에서을를과와도만로으부터까지처럼,.;:!?])/gu,
    reason: "구체적인 학년·반 식별정보로 보이는 표현이 포함되어 있습니다.",
  },
  {
    type: "school_name",
    severity: "high",
    regex:
      /(?:반|학급)\s*(?:이름|명|명칭)(?!(?:은|는|이|가|:|：)?\s*["'“”]?(?:입력|기록|저장|공유|수집|포함|제공|삭제|제외|쓰지|없는|익명|표시|밝히|언급))(?:은|는|이|가|:|：)?\s*["'“”]?[가-힣A-Za-z0-9·-]{1,20}(?:반)?/gu,
    reason: "구체적인 반 또는 학급명으로 보이는 표현이 포함되어 있습니다.",
    ignore: isGenericPrivacyPolicyStatement,
  },
  {
    type: "school_name",
    severity: "high",
    regex:
      /(?<![가-힣])([가-힣]{2,12})반(?=$|[\s은는이가의에서을를과와도만로으부터까지처럼,.;:!?])/gu,
    reason: "구체적인 반 또는 학급명으로 보이는 표현이 포함되어 있습니다.",
    ignore: isGenericNamedClassReference,
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
