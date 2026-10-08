const GENERIC_ROLE_DESCRIPTOR_STEMS = new Set([
  "강점",
  "기준",
  "문제의식",
  "반성적",
  "방식",
  "설명",
  "선택",
  "성장",
  "성장관",
  "성찰적",
  "성향",
  "성과",
  "신념",
  "원리",
  "원칙",
  "우선순위",
  "전략",
  "전문성",
  "전문적",
  "정서",
  "정체성",
  "제약",
  "주도성",
  "주도적",
  "주제",
  "지원",
  "지원적",
  "지도력",
  "지향점",
  "도전적",
  "민주적",
  "현장중심",
  "한국사",
  "세계사",
  "방과후",
]);

/**
 * Heads that turn any preceding modifier into a learner group or activity
 * (`고학년`, `한부모`, `진로탐색`, `주도놀이`). Korean given names do not end
 * in these syllable pairs, so `surname-like syllable + head` is a compound
 * noun rather than a full name.
 */
const EDUCATIONAL_COMPOUND_HEADS = [
  "학년",
  "학력",
  "배경",
  "부모",
  "교육",
  "탐색",
  "놀이",
  "활동",
  "수업",
  "학습",
  "과제",
  "평가",
  "실습",
  "실험",
  "체험",
];

/**
 * Subject and staff-title heads count as compounds only after a modifier of
 * two or more syllables (`지구과학`, `공통국어`, `정보부장`). One leading
 * syllable may be a surname attached to a title (`김부장`), which still
 * points to a real person.
 */
const SUBJECT_OR_TITLE_HEADS = [
  "국어",
  "수학",
  "영어",
  "과학",
  "사회",
  "국사",
  "역사",
  "도덕",
  "윤리",
  "음악",
  "미술",
  "체육",
  "기술",
  "가정",
  "한문",
  "정보",
  "진로",
  "상담",
  "보건",
  "사서",
  "영양",
  "특수",
  "담임",
  "교과",
  "전담",
  "부장",
];

/** Measures and rights such as `이해도`, `선택권`, `성취감`, `표현력`. */
const EDUCATIONAL_MEASURE_NOUN =
  /^(?:이해|성취|선택|참여|집중|만족|자율|주도|공감|소통|표현|문해|인지|선호|안정|안전|몰입|발언|결정|효능|사고)(?:도|권|감|력)$/u;

/** A role noun joined to another role (`유아나 보호자`, `원아랑 교사`). */
const ROLE_NOUN_CONJUNCTION =
  /^(?:학생|유아|아동|원아|교사|보호자|학부모|부모)(?:이나|나|이랑|랑|하고|및)$/u;

/**
 * Connective verb endings (`설명하면`, `도와주면`, `정리하면서`,
 * `안내하도록`, `정리해서`) and the adjectival `-적` (`소극적`). These end a
 * clause before the role noun; Korean given names do not end this way.
 */
const CLAUSE_ENDING = /(?:면|면서|도록|는데|려고|어서|해서|하여|하게|적)$/u;

const KOREAN_CASE_PARTICLE = /(?:은|는|이|가|을|를|도|만)$/u;
const KOREAN_OBJECT_PARTICLE = /(?<particle>을|를)$/u;
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

function isGenericObjectPhrase(descriptor: string) {
  const match = descriptor.match(KOREAN_OBJECT_PARTICLE);
  const particle = match?.groups?.particle;
  if (!particle) return false;

  const stem = descriptor.slice(0, -particle.length);
  const finalConsonant = hasFinalConsonant(stem);
  if (finalConsonant === null) return false;

  const agreesWithStem = finalConsonant ? particle === "을" : particle === "를";
  return agreesWithStem;
}

/**
 * Recognizes a compound educational noun on either side of a role
 * (`이주배경 학생`, `학생 진로탐색`, `지구과학 교사`). Only lexical heads and
 * measure nouns are used, so case-marked names such as `김민수는` are not
 * normalized here.
 */
export function isEducationalCompoundNoun(word: string) {
  if (GENERIC_ROLE_DESCRIPTOR_STEMS.has(word)) return true;
  if (EDUCATIONAL_MEASURE_NOUN.test(word)) return true;
  if (
    EDUCATIONAL_COMPOUND_HEADS.some(
      (head) => word.length > head.length && word.endsWith(head),
    )
  ) {
    return true;
  }
  return SUBJECT_OR_TITLE_HEADS.some(
    (head) => word.length >= head.length + 2 && word.endsWith(head),
  );
}

/**
 * Korean name heuristics can consume a case particle as part of a putative
 * name (for example, `방식은 학생` -> `방식은`). Only explicitly known
 * educational descriptors are normalized this way so real names ending in
 * `은`, such as `김다은`, remain protected.
 */
export function isGenericEducationalRoleDescriptor(descriptor: string) {
  if (isEducationalCompoundNoun(descriptor)) return true;
  if (ROLE_NOUN_CONJUNCTION.test(descriptor)) return true;
  if (CLAUSE_ENDING.test(descriptor)) return true;

  // `주제를 학생의 경험과 연결한다`처럼 목적어 뒤에 학생 문맥이
  // 이어지는 문장을 이름으로 오해하지 않는다. 목적격 표현은 이름과
  // 일반 명사를 형태만으로 확정할 수 없으므로 직접 식별로 차단하지 않는다.
  // `김민수 학생`, `학생 김민수`, `이름: 김민수`처럼 역할·이름 관계가
  // 명확한 표현은 detector의 별도 분기가 계속 차단한다.
  if (isGenericObjectPhrase(descriptor)) return true;

  const stem = descriptor.replace(KOREAN_CASE_PARTICLE, "");
  return stem !== descriptor && isEducationalCompoundNoun(stem);
}
