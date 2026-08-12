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
]);

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
 * Korean name heuristics can consume a case particle as part of a putative
 * name (for example, `방식은 학생` -> `방식은`). Only explicitly known
 * educational descriptors are normalized this way so real names ending in
 * `은`, such as `김다은`, remain protected.
 */
export function isGenericEducationalRoleDescriptor(descriptor: string) {
  if (GENERIC_ROLE_DESCRIPTOR_STEMS.has(descriptor)) return true;

  // `주제를 학생의 경험과 연결한다`처럼 목적어 뒤에 학생 문맥이
  // 이어지는 문장을 이름으로 오해하지 않는다. 목적격 표현은 이름과
  // 일반 명사를 형태만으로 확정할 수 없으므로 직접 식별로 차단하지 않는다.
  // `김민수 학생`, `학생 김민수`, `이름: 김민수`처럼 역할·이름 관계가
  // 명확한 표현은 detector의 별도 분기가 계속 차단한다.
  if (isGenericObjectPhrase(descriptor)) return true;

  const stem = descriptor.replace(KOREAN_CASE_PARTICLE, "");
  return stem !== descriptor && GENERIC_ROLE_DESCRIPTOR_STEMS.has(stem);
}
