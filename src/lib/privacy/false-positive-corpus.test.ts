import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  KINDERGARTEN_COMMON_QUESTION_OVERRIDES,
  KINDERGARTEN_QUESTIONS,
} from "@/content/questions";
import { detectPrivacyRisks } from "./detector";

function blockedParts(text: string) {
  return detectPrivacyRisks(text).matches.map(
    (match) => `${match.type}:${match.matchedText}`,
  );
}

const CONNECTIVE_VERB_SENTENCES = [
  "설명하면",
  "안내하면",
  "제시하면",
  "정리하면",
  "공유하면",
  "연결하면",
  "조정하면",
  "선택하면",
  "도와주면",
  "나누면",
  "기다리면",
].map((verb) => `활동 순서를 ${verb} 학생이 더 쉽게 참여한다.`);

const SURNAME_INITIAL_EDUCATIONAL_TERMS = [
  "이주배경 학생이 처음 온 교실에서도 흐름을 알 수 있게 한다.",
  "고학년 학생은 토론 규칙을 함께 정한다.",
  "소극적 학생이 부담 없이 참여할 수 있는 통로를 둔다.",
  "모범적 학생이라는 표현 대신 관찰 가능한 행동을 적는다.",
  "기초학력 학생이 단계별로 따라올 수 있게 예시를 준다.",
  "한부모 학생이 있는 가정에도 안내문이 닿도록 한다.",
  "유아나 보호자와 함께 놀이 기록을 살펴본다.",
  "한국사 교사로 근무합니다.",
  "지구과학 교사로서 탐구 활동을 설계합니다.",
  "전문상담 교사로 일하고 있습니다.",
  "공통국어 교사는 읽기 전략을 함께 정합니다.",
  "기술가정 교사가 실습 안전을 안내합니다.",
  "방과후 선생님과 활동 시간을 조율합니다.",
  "공동담임 선생님과 학급 규칙을 정합니다.",
  "정보부장 교사로서 기기 사용 기준을 만듭니다.",
];

const STUDENT_COMPOUND_NOUNS = [
  "학생 이해도를 확인하는 짧은 질문을 넣는다.",
  "학생 선택권을 넓히는 과제를 준비한다.",
  "학생 성취도가 다양한 학급이다.",
  "학생 진로탐색을 돕는 활동을 한다.",
  "학생 안전교육을 먼저 진행한다.",
  "유아 주도놀이를 존중한다.",
];

const GENERIC_SCHOOL_TYPES = [
  "병설유치원에서 근무합니다.",
  "단설유치원에서 근무합니다.",
  "남자중학교에서 근무합니다.",
  "여자고등학교에서 근무합니다.",
  "시골초등학교에서 근무합니다.",
  "혁신초등학교에서 근무합니다.",
  "시도교육청 지침을 따릅니다.",
];

const GENERIC_CLASS_TYPES = [
  "종일반 유아가 오후에도 놀이를 이어 간다.",
  "돌봄반 학생과 함께 간식을 나눈다.",
  "담임반 학생에게 안내문을 나눠 준다.",
  "다른반 학생과 함께 활동한다.",
  "문과반 학생에게 자료를 제공한다.",
  "취업반 학생의 실습 일정을 고려한다.",
  "도움반 학생과 통합 수업을 한다.",
  "영재반 수업을 함께 맡는다.",
  "반 이름을 학생들이 직접 정하게 합니다.",
  "학급 명렬표 대신 번호표를 사용한다.",
];

// Neighbors of the reported cases that the same structural rules cover.
const RELATED_WORDING = [
  "활동 순서를 설명하면서 학생이 질문할 시간을 준다.",
  "이어서 학생이 자신의 생각을 정리한다.",
  "기준을 안내하도록 교사가 먼저 시범을 보인다.",
  "원아나 보호자에게 안내문을 보낸다.",
  "조부모 보호자와 상담 시간을 맞춘다.",
  "유아 주도놀이 시간을 늘린다.",
  "학생 표현력이 자라는 과정을 기록한다.",
  "공립병설유치원에서 근무합니다.",
  "오후돌봄반 유아와 함께 지낸다.",
  "반 이름이나 학교 이름은 적지 않는다.",
  "학생 이름, 반 이름 등은 적지 마세요.",
  "사람 이름이나 정확한 학교와 반 이름은 적지 마세요.",
  "반 이름은 빼고 적어 주세요.",
  "반 이름 짓기 활동을 한다.",
  "학급 명단은 사용하지 않는다.",
];

const MUST_PASS = [
  ...CONNECTIVE_VERB_SENTENCES,
  ...SURNAME_INITIAL_EDUCATIONAL_TERMS,
  ...STUDENT_COMPOUND_NOUNS,
  ...GENERIC_SCHOOL_TYPES,
  ...GENERIC_CLASS_TYPES,
  ...RELATED_WORDING,
];

const MUST_BLOCK = [
  "김민수 학생이 수업 중 자주 잡니다.",
  "학생 이름은 박지훈입니다.",
  "3학년 2반 담임입니다.",
  "한빛초등학교에서 근무합니다.",
  "연락처는 010-1234-5678입니다.",
  "한 학생이 ADHD 진단을 받았습니다.",
];

// Common given names, several of which end in syllables or start with stems
// that the generic-wording exceptions reason about.
const PLAUSIBLE_NAMES = [
  "김민수",
  "박지훈",
  "이서준",
  "최예준",
  "정시우",
  "강하준",
  "조주원",
  "윤지호",
  "장지후",
  "임준우",
  "한서연",
  "오서윤",
  "서지우",
  "신서현",
  "권민서",
  "황하은",
  "안하윤",
  "송윤서",
  "전지민",
  "홍채원",
  "유지원",
  "유나",
  "김유나",
  "이하나",
  "고수아",
  "문지아",
  "양다은",
  "손은서",
  "배예은",
  "주도윤",
  "공유진",
  "이해진",
  "선우진",
  "이은해",
  "김서율",
  "이성민",
  "한결",
  "김한결",
  "기보배",
  "남궁민수",
];

const EXAMPLE_PROFILE_DIRECTORY = path.resolve(
  process.cwd(),
  "docs/examples/teacher-profiles",
);

function exampleProfileLines() {
  return readdirSync(EXAMPLE_PROFILE_DIRECTORY)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .flatMap((file) =>
      readFileSync(path.join(EXAMPLE_PROFILE_DIRECTORY, file), "utf8")
        .split(/\r?\n/u)
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(({ text }) => text.trim().length > 0),
    );
}

describe("privacy detector false-positive corpus", () => {
  it.each(MUST_PASS)("keeps ordinary teacher wording clear: %s", (text) => {
    expect(blockedParts(text)).toEqual([]);
  });

  it("keeps every line of the fictional example profiles clear", () => {
    const lines = exampleProfileLines();
    expect(lines.length).toBeGreaterThan(100);

    const blocked = lines.flatMap(({ file, line, text }) => {
      const parts = blockedParts(text);
      return parts.length > 0 ? [`${file}:${line} ${parts.join(" | ")}`] : [];
    });
    expect(blocked).toEqual([]);
  });

  it("keeps the kindergarten privacy guidance clear", () => {
    const hints = [
      ...KINDERGARTEN_QUESTIONS.map((question) => question.privacyHint),
      ...Object.values(KINDERGARTEN_COMMON_QUESTION_OVERRIDES).map(
        (question) => question.privacyHint,
      ),
    ];
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.flatMap(blockedParts)).toEqual([]);
  });

  it.each(MUST_BLOCK)("still blocks direct identifiers: %s", (text) => {
    expect(detectPrivacyRisks(text).status).toBe("blocked");
  });

  it.each(PLAUSIBLE_NAMES.filter((name) => name.length >= 3))(
    "still blocks a plausible name next to a role: %s",
    (name) => {
      for (const text of [
        `${name} 학생이 발표를 준비한다.`,
        `${name} 학생은 토론을 선호한다.`,
        `학생 ${name}의 선택을 존중한다.`,
        `학생 ${name}은 토론을 선호한다.`,
        `${name} 교사와 협의한다.`,
        `${name} 선생님께 자료를 보낸다.`,
        `${name} 유아가 놀이를 이어 간다.`,
      ]) {
        expect(detectPrivacyRisks(text).status, text).toBe("blocked");
      }
    },
  );

  it.each([
    "김부장 선생님과 협의한다.",
    "박담임 선생님께 연락한다.",
    "학생의 이름은 김민수입니다.",
    "보호자의 성명은 박은영입니다.",
    "반 이름을 '햇살'로 정했다.",
    "반 이름을 햇살반으로 정했다.",
    "학급명: 햇살",
    "반 이름: 등대",
    "학급 명칭은 무지개반이다.",
    "공립한빛유치원에서 근무합니다.",
    "서울여자고등학교에서 근무합니다.",
    "한빛병설유치원에서 근무합니다.",
    "무지개반 유아가 놀이를 이어 간다.",
  ])(
    "still blocks a surname title, labeled name, school, or class: %s",
    (text) => {
      expect(detectPrivacyRisks(text).status).toBe("blocked");
    },
  );
});
