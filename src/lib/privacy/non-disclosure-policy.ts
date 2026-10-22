// A list of field categories is not a disclosed value. Only complete, narrowly
// shaped non-disclosure instructions qualify; names, diagnoses, values,
// parentheses, and extra prose make the sentence fail this grammar.
const PRIVATE_FIELD =
  "(?:이름|성명|실명|연락처|개별\\s*기록|성적|점수|건강\\s*정보|상담\\s*(?:기록|내용|이력)|가정\\s*환경|생활기록부)";
const FIELD_LIST = `${PRIVATE_FIELD}(?:\\s*(?:[,·/]|및|또는|이나|나|과|와)\\s*${PRIVATE_FIELD})*`;
const NON_DISCLOSURE_ACTION =
  "(?:(?:입력|기록|공유|제공|저장|포함|전달|수집|사용)하지|(?:넣|적|남기|보내)지)\\s*않";
const SAFE_SUPPORT_TAIL =
  "고\\s*(?:집단|학급)\\s*수준의\\s*(?:지원\\s*요구|수업\\s*맥락)만\\s*(?:전달|공유|기록|설명)(?:한다|합니다)";
const GENERIC_POLICY = new RegExp(
  `^(?:개별|특정)\\s*(?:학생|유아|아동)(?:의)?\\s*${FIELD_LIST}(?:\\s*등)?(?:은|는|을|를)?\\s*(?:(?:AI|외부|서버|문서)(?:에|에게|로)\\s*)?${NON_DISCLOSURE_ACTION}(?:는다|습니다|겠습니다|${SAFE_SUPPORT_TAIL})[.!?]?$`,
  "u",
);

function policySentences(text: string) {
  return [...text.matchAll(/[^.!?\n]+[.!?]?/gu)].filter((match) =>
    GENERIC_POLICY.test(match[0].trim()),
  );
}

export function isGenericNonDisclosurePolicy(
  match: string,
  text: string,
  start: number,
) {
  return policySentences(text).some(
    (sentence) =>
      start >= sentence.index &&
      start + match.length <= sentence.index + sentence[0].length,
  );
}

/** Used only when checking sensitive-context evidence; never rewrites a profile. */
export function withoutGenericNonDisclosurePolicies(text: string) {
  let result = text;
  for (const sentence of policySentences(text).reverse()) {
    result =
      result.slice(0, sentence.index) +
      " " +
      result.slice(sentence.index + sentence[0].length);
  }
  return result;
}
