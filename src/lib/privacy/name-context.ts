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
  "지원",
  "지원적",
  "지도력",
  "지향점",
  "도전적",
  "민주적",
  "현장중심",
]);

const KOREAN_CASE_PARTICLE = /(?:은|는|이|가|을|를|도|만)$/u;

/**
 * Korean name heuristics can consume a case particle as part of a putative
 * name (for example, `방식은 학생` -> `방식은`). Only explicitly known
 * educational descriptors are normalized this way so real names ending in
 * `은`, such as `김다은`, remain protected.
 */
export function isGenericEducationalRoleDescriptor(descriptor: string) {
  if (GENERIC_ROLE_DESCRIPTOR_STEMS.has(descriptor)) return true;

  const stem = descriptor.replace(KOREAN_CASE_PARTICLE, "");
  return stem !== descriptor && GENERIC_ROLE_DESCRIPTOR_STEMS.has(stem);
}
