import { runStructuredResponse } from "@/lib/ai/client";
import {
  OPENAI_MODELS,
  OPENAI_REASONING_EFFORT,
  OPENAI_TIMEOUT_MS,
} from "@/lib/ai/models";
import { PRIVACY_REVIEW_INSTRUCTIONS } from "@/lib/ai/prompts/privacy";
import {
  privacyReviewCandidatesOutputSchema,
  type PrivacyReviewCandidate,
} from "@/lib/ai/schemas/privacy";
import {
  collectProfileAuthoredTextFields,
  localAuthoredProfilePrivacyReview,
  type TextField,
} from "@/lib/security/privacy-guard";
import {
  privacyReviewSchema,
  type PrivacyReview,
  type TeacherContextProfile,
} from "@/types/profile";

const KOREAN_SURNAMES =
  "김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민류나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용";
const LIKELY_KOREAN_NAME = new RegExp(
  `^[${KOREAN_SURNAMES}][가-힣]{2,3}$`,
  "u",
);
const GENERIC_EDUCATIONAL_MODIFIER =
  /^(?:(?:선택|이해|지원|질문|발표|설명|참여|응답|도전|시도|수정|작성|제출|관찰|기록|준비|신청|희망|요청|학습|활동|토론|탐구|협력|공유|완료|정리|구성|고민|조사|정돈|구별|비교|분석|결정|해결|계획|실행|검토|확인|연습|복습|제안|선정|분류)(?:한|하는|했던|할)|고른|마친|고친|배운)$/u;

const GENERIC_PERSON_DESCRIPTORS = new Set([
  "학생",
  "학생들",
  "학급",
  "우리반",
  "교실",
  "수업",
  "우리",
  "저희",
  "일부",
  "여러",
  "모든",
  "모두",
  "전체",
  "어떤",
  "많은",
  "해당",
  "특정",
  "개별",
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
  "진로",
  "상담",
  "보건",
  "사서",
  "특수",
  "영양",
  "담임",
  "교과",
  "전담",
  "유치원",
  "초등학교",
  "중학교",
  "고등학교",
  "특수학교",
  "보조",
  "협력",
  "지원",
  "원어민",
  "기간제",
  "신규",
  "초임",
  "현직",
  "현재",
  "전입",
  "동료",
]);
const GENERIC_SCHOOL_OR_INSTITUTION_PREFIXES = new Set([
  "우리",
  "저희",
  "해당",
  "특정",
  "현재",
  "지역",
  "관할",
  "일반",
  "특성화",
  "자율형",
  "공립",
  "사립",
  "교육",
  "근무하는",
  "다니는",
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

function hasPotentialPersonName(text: string) {
  if (
    /(?:이름|성명)\s*(?:은|는|이|가|:|：)?\s*["'“”]?(?!(?:입력|기록|저장|공유|수집|포함|제공|삭제|제외|쓰지|없는|익명|표시|밝히|언급))(?:[가-힣]{2,4}|[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/u.test(
      text,
    ) ||
    /[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+\s*(?:학생|교사|선생님|보호자)/u.test(
      text,
    ) ||
    /(?:학생|유아|아동|교사|선생님|보호자)\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+(?:$|[은이는의에게을를과와도가로,.;:!?])/u.test(
      text,
    )
  ) {
    return true;
  }

  const implicitNameMatches = [
    ...text.matchAll(
      /([가-힣]{3,4})\s+(?:학생|유아|아동|교사|선생님|보호자)/gu,
    ),
    ...text.matchAll(
      /(?:학생|유아|아동|교사|선생님|보호자)\s+([가-힣]{3,4}?)(?=[은는이가의])/gu,
    ),
    ...text.matchAll(
      /(?:학생|유아|아동|교사|선생님|보호자)\s+([가-힣]{3,4})(?=$|[,.;:!?])/gu,
    ),
  ];
  for (const match of implicitNameMatches) {
    const descriptor = match[1];
    if (
      descriptor &&
      LIKELY_KOREAN_NAME.test(descriptor) &&
      !GENERIC_PERSON_DESCRIPTORS.has(descriptor) &&
      !GENERIC_EDUCATIONAL_MODIFIER.test(descriptor) &&
      !/(?:에서|에게|으로|하고|하며|보다|마다|처럼|까지|부터|와|과|의|내|중|별|반|한|된|운|는|인|할|했던|로운|스러운)$/u.test(
        descriptor,
      )
    ) {
      return true;
    }
  }

  return false;
}

function hasGovernmentIdentifier(text: string) {
  return /(?:주민등록번호|외국인등록번호|여권번호|운전면허번호)\s*(?:은|는|이|가|:|：)?\s*[A-Z0-9-]{6,}/iu.test(
    text,
  );
}

function hasContactDetail(text: string) {
  return (
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(text) ||
    /(?<!\d)(?:01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4})(?!\d)/u.test(
      text,
    ) ||
    /(?:연락처|전화번호|이메일)\s*(?:은|는|이|가|:|：)?\s*(?:[\w.+-]+@|\d{2,4}[-\s.]?\d{3,4})/iu.test(
      text,
    )
  );
}

function hasPreciseLocation(text: string) {
  return (
    /(?:주소|거주지)\s*(?:은|는|이|가|:|：)?\s*[^.!?\n]{2,60}(?:로|길|동|읍|면|번지)\s*\d+/u.test(
      text,
    ) ||
    /(?:서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원(?:특별자치)?도|충청[남북]도|전라[남북]도|경상[남북]도|제주특별자치도)\s+[가-힣0-9]+(?:시|군|구)\s+[^.!?\n]{1,50}(?:로|길|동|읍|면)/u.test(
      text,
    )
  );
}

function hasSpecificSchoolOrClass(text: string) {
  for (const match of text.matchAll(
    /([가-힣A-Za-z0-9·-]{2,30}?)(초등학교|중학교|고등학교|유치원|특수학교|교육지원청|교육청|교육대학교|대학교)/gu,
  )) {
    const prefix = match[1];
    if (prefix && !GENERIC_SCHOOL_OR_INSTITUTION_PREFIXES.has(prefix)) {
      return true;
    }
  }

  if (
    /(?<![가-힣\d])(?:\d{1,2}\s*학년\s*)?\d{1,2}\s*반(?=$|[\s은는이가의에서을를과와도만로으부터까지처럼,.;:!?])/u.test(
      text,
    ) ||
    /(?:반|학급)\s*(?:이름|명|명칭)(?!(?:은|는|이|가|:|：)?\s*["'“”]?(?:입력|기록|저장|공유|수집|포함|제공|삭제|제외|쓰지|없는|익명|표시|밝히|언급))(?:은|는|이|가|:|：)?\s*["'“”]?[가-힣A-Za-z0-9·-]{1,20}(?:반)?/u.test(
      text,
    )
  ) {
    return true;
  }

  for (const match of text.matchAll(
    /(?<![가-힣])([가-힣]{2,12})반(?=$|[\s은는이가의에서을를과와도만로으부터까지처럼,.;:!?])/gu,
  )) {
    const prefix = match[1];
    if (prefix && !GENERIC_CLASS_PREFIXES.has(prefix)) return true;
  }

  return false;
}

function hasDirectPersonalIdentifier(text: string) {
  return (
    hasPotentialPersonName(text) ||
    hasGovernmentIdentifier(text) ||
    hasContactDetail(text) ||
    hasPreciseLocation(text)
  );
}

function hasIdentifiableSensitiveContext(text: string) {
  const hasSensitiveDetail =
    /(?:개별\s*)?(?:점수|성적|석차|등수|순위)|ADHD|주의력결핍(?:과잉행동)?장애|자폐(?:스펙트럼)?|우울증|불안장애|틱장애|난독증|지적장애|진단(?:명|받)|치료\s*중|약\s*복용|상담\s*(?:기록|내용)|건강\s*정보|병력|가정환경|생활기록부/iu.test(
      text,
    );
  return hasSensitiveDetail && hasDirectPersonalIdentifier(text);
}

function hasCombinationRisk(text: string) {
  if (!hasDirectPersonalIdentifier(text)) return false;

  const contextualClues = [
    hasSpecificSchoolOrClass(text),
    hasIdentifiableSensitiveContext(text),
    /(?:20\d{2}[년./-]\s*)?\d{1,2}(?:월|[./-])\s*\d{1,2}일?/u.test(text),
    /(?<!\d)\d{1,2}\s*(?:학년|세)(?!\d)/u.test(text),
    /(?:단독|유일|수상|대회|전학|입학|졸업|사고|징계)/u.test(text),
  ].filter(Boolean).length;

  return contextualClues >= 2;
}

/**
 * Treats the model as a candidate generator, not the final privacy authority.
 * Generic educational nouns such as 학생, 학급, 우리 학급, and 우리 반 are
 * never concrete evidence by themselves, regardless of the model category.
 */
function candidateHasConcreteEvidence(candidate: PrivacyReviewCandidate) {
  switch (candidate.category) {
    case "person_name":
      return hasPotentialPersonName(candidate.text);
    case "government_id":
      return hasGovernmentIdentifier(candidate.text);
    case "contact":
      return hasContactDetail(candidate.text);
    case "precise_location":
      return hasPreciseLocation(candidate.text);
    case "specific_school_or_class":
      return hasSpecificSchoolOrClass(candidate.text);
    case "identifiable_sensitive_context":
      return hasIdentifiableSensitiveContext(candidate.text);
    case "combination_risk":
      return hasCombinationRisk(candidate.text);
  }
}

function validatedPublicReview(
  fields: readonly TextField[],
  candidates: Awaited<ReturnType<typeof runPrivacyReviewCandidates>>["items"],
): PrivacyReview {
  const allowedTextByPath = new Map(
    fields.map((field) => [field.path, field.value] as const),
  );
  const candidatesByPath = new Map<string, typeof candidates>();

  for (const candidate of candidates) {
    if (allowedTextByPath.get(candidate.path) !== candidate.text) continue;
    if (!candidateHasConcreteEvidence(candidate)) continue;

    const existing = candidatesByPath.get(candidate.path) ?? [];
    if (
      !existing.some(
        (item) =>
          item.category === candidate.category &&
          item.reason === candidate.reason &&
          item.suggestedRewrite === candidate.suggestedRewrite,
      )
    ) {
      existing.push(candidate);
      candidatesByPath.set(candidate.path, existing);
    }
  }

  const items: PrivacyReview["items"] = [];
  for (const [path, pathCandidates] of candidatesByPath) {
    const first = pathCandidates[0];
    const text = allowedTextByPath.get(path);
    if (!first || text === undefined) continue;

    items.push({
      text,
      reason: [...new Set(pathCandidates.map((item) => item.reason))].join(" "),
      suggestedRewrite: first.suggestedRewrite,
    });
  }

  return privacyReviewSchema.parse({
    status: items.length > 0 ? "needs_review" : "clear",
    items,
  });
}

async function runPrivacyReviewCandidates(fields: readonly TextField[]) {
  return runStructuredResponse({
    operation: "privacy_review",
    model: OPENAI_MODELS.privacy,
    effort: OPENAI_REASONING_EFFORT.privacy,
    instructions: PRIVACY_REVIEW_INSTRUCTIONS,
    input: JSON.stringify({
      fields: fields.map(({ path, value }) => ({ path, text: value })),
    }),
    schema: privacyReviewCandidatesOutputSchema,
    schemaName: "tcontext_privacy_review_candidates",
    maxOutputTokens: 2_000,
    timeoutMs: OPENAI_TIMEOUT_MS.privacy,
  });
}

export async function reviewProfileWithAI(
  profile: TeacherContextProfile,
): Promise<{ source: "local" | "openai"; review: PrivacyReview }> {
  const fields = collectProfileAuthoredTextFields(profile);
  const localReview = localAuthoredProfilePrivacyReview(profile);
  if (localReview.status === "needs_review") {
    return { source: "local", review: localReview };
  }

  const output = await runPrivacyReviewCandidates(fields);

  return {
    source: "openai",
    review: validatedPublicReview(fields, output.items),
  };
}
