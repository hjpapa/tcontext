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

function wordSet(words: string) {
  return new Set(words.trim().split(/\s+/u));
}

/**
 * Two-syllable stems whose `한` form describes a person or a completed action
 * (`조용한`, `신중한`, `성장한`, `함께한`). A surname plus a given name ending in
 * `한` (`김지한`, `이서한`) has the same shape, so only these stems are read as
 * modifiers. When a common modifier also spells a plausible name (`진지한`,
 * `이상한`), the modifier reading wins; a stem whose modifier is rare before a
 * role but whose name is plausible, such as `고요` (고요한) or `강요` (강요한),
 * is left out. Action stems already in detector.ts's
 * GENERIC_EDUCATIONAL_MODIFIER are not repeated, and only stems starting with a
 * surname-like syllable can reach this check.
 */
const HAN_MODIFIER_STEMS = wordSet(`
  강력 강인 강직 고독 공손 공정 공평 기묘 기발 기특 나약 노련 마땅 명랑 명석
  명확 모호 민감 민첩 박식 서먹 서운 성급 성숙 성실 소란 소박 소심 소중 소탈
  소홀 신기 신비 신선 신속 신중 심각 심심 안락 안전 양호 어눌 어떠 어색 엄격
  엄밀 엄숙 연약 오만 왕성 용감 우수 우울 원만 원숙 원활 위험 유능 유리 유사
  유순 유약 유연 유용 유익 유일 유창 유쾌 이러 이상 인색 인자 정당 정중 정직
  정확 조급 조숙 조용 지루 진솔 진실 진정 진중 진지 차분 천진 최대 최소 탁월
  편리 편안 한가 허약 현명 황당

  강의 강화 고려 고생 공감 공부 공헌 권장 기억 기여 기획 노력 도달 도입 모방
  문의 반대 반복 반성 반응 방문 방해 배려 변화 선발 설계 설득 성공 성장 성찰
  성취 소통 신고 신뢰 안심 안착 양보 연구 연락 염려 오해 우려 위반 은퇴 이동
  이사 이수 이용 이직 이탈 인솔 인식 인정 장려 전공 전념 전달 전담 전입 전출
  전학 정착 제외 제작 조언 조율 조직 조퇴 주관 주도 주목 주장 주저 지각 지속
  지적 지향 진급 진입 진출 진학 채점 추가 추구 추천 편입 표현 하교 함께 허락
`);

/**
 * Stems of the closed class of `ㅂ`-irregular adjectives (`어렵다` -> `어려운`)
 * plus `지새우다`. Given names ending in `운` (`지운`, `태운`, `로운`) stay
 * blocked. `정다운` is left out because it is also a common full name, and
 * `이로운` (이롭다) because it is rare right before a role while 이 + 로운 is a
 * plausible name. Longer `-롭다` forms (`지혜로운`, `조화로운`) have a
 * three-syllable stem and need no entry.
 */
const UN_MODIFIER_STEMS = wordSet(`
  고마 노여 마려 반가 서러 손쉬 어두 어려 우스 정겨 지겨 지새 차가
`);

/**
 * Status nouns that take the copula `인` before a role (`신규인 교사`,
 * `듣기가 강점인 학생`). Given names ending in `인` (`해인`, `서인`, `다인`)
 * are common, so other two-syllable stems stay blocked. This list replaces
 * isEducationalCompoundNoun here because its stem `정서` would clear `정서인`.
 */
const COPULA_STATUS_NOUNS = wordSet(`
  강사 강점 남성 남자 노인 선배 성인 신규 신입 어른 엄마 여성 여자 원감 원장
  장남 장녀 장애 전담 주임 차남 차녀 한국 현직
`);

/**
 * Classification nouns that take `별` ("by") before a role (`성적별 학생`,
 * `연령별 유아`, `전공별 교사`). Given names ending in `별` (`한별`, `은별`,
 * `샛별`) are common, so other two-syllable stems stay blocked.
 */
const BYEOL_CLASSIFIER_STEMS = wordSet(`
  공간 구역 국가 국적 권역 기간 기관 기능 기준 나이 남녀 도구 모둠 문제 문항
  반응 방법 방식 선택 선호 성격 성과 성적 성취 성향 신청 여부 연도 연령 연차
  유무 유형 인원 전공 정도 조건 주간 주제 주차 지역 진도 진로 차시
`);

/**
 * Activity nouns that take the progressive `중` before a role (`연수중
 * 교사`, `공부중 학생`). Given names ending in `중` (`재중`, `태중`, `성중`)
 * stay blocked. A stem whose `중` form is rare before a role but also spells
 * a plausible name, such as `이용` (이 + 용중), `조정` (조 + 정중), `지원`,
 * `추진`, or `하원`, is left out.
 */
const JUNG_PROGRESSIVE_STEMS = wordSet(`
  강의 고려 고민 공부 공사 구직 기록 기획 노력 도전 모집 반성 방문 방학 변화
  선택 설명 성장 소통 신청 심사 안내 양육 여행 연가 연결 연구 연수 연습 유예
  유학 육아 이동 이수 임신 전환 정리 정비 정학 제작 조사 조율 조퇴 지각 지도
  진단 진료 진행 채점 하교
`);

const GROUPING_OR_PROGRESSIVE_STEMS = new Map([
  ["별", BYEOL_CLASSIFIER_STEMS],
  ["중", JUNG_PROGRESSIVE_STEMS],
]);

/** Two-syllable surnames that start a four-syllable full name (`남궁지한`). */
const COMPOUND_SURNAME = /^(?:남궁|황보|제갈|선우|서문|독고|사공|동방)/u;

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

/**
 * Recognizes an adnominal `한` (`조용한`, `성장한`), `운` (`어려운`), or copula
 * `인` (`신규인`, `지적인`) before a role. Most full names are a surname plus a
 * two-syllable given name, so a three-syllable word is a modifier only when
 * its stem is listed above; `김지한`, `이지운`, `김로운`, and `정해인` stay
 * blocked. A four-syllable word has a three-syllable stem (`고학년인`,
 * `구체화한`, `안타까운`, `지혜로운`), which a name matches only after a
 * compound surname.
 */
export function isAdnominalPredicate(descriptor: string) {
  const ending = descriptor.at(-1);
  if (ending !== "한" && ending !== "운" && ending !== "인") return false;

  const stem = descriptor.slice(0, -1);
  if (stem.length >= 3) return !COMPOUND_SURNAME.test(stem);
  if (ending === "한") return HAN_MODIFIER_STEMS.has(stem);
  if (ending === "운") return UN_MODIFIER_STEMS.has(stem);
  return COPULA_STATUS_NOUNS.has(stem) || stem.endsWith("적");
}

/**
 * Recognizes the grouping suffix `별` (`성적별`) and the progressive `중`
 * (`연수중`) before a role. As in isAdnominalPredicate, a three-syllable word
 * needs a listed stem, so `김한별` and `이재중` stay blocked, and a
 * four-syllable word (`이해도별`, `소그룹별`) is generic unless it starts with
 * a compound surname. Only stems starting with a surname-like syllable reach
 * this check, so `수준별` and `수업중` need no entry.
 */
export function isGroupingOrProgressiveNoun(descriptor: string) {
  const stems = GROUPING_OR_PROGRESSIVE_STEMS.get(descriptor.at(-1) ?? "");
  if (!stems) return false;

  const stem = descriptor.slice(0, -1);
  if (stem.length >= 3) return !COMPOUND_SURNAME.test(stem);
  return stems.has(stem);
}
