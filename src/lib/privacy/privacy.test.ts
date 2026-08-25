import { describe, expect, it } from "vitest";

import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  COMMON_QUESTIONS,
  ELEMENTARY_QUESTIONS,
  HIGH_QUESTIONS,
  KINDERGARTEN_QUESTIONS,
  MIDDLE_QUESTIONS,
  ROLE_QUESTIONS,
} from "@/content/questions";
import {
  containsPrivacyRisk,
  detectPrivacyRisks,
  reviewProfilePrivacy,
} from "./detector";
import { rewriteStudentDescription } from "./rewrite";

function fictionalProfile() {
  const profile = FICTIONAL_PROFILES[0];
  if (!profile) throw new Error("Missing fictional profile");
  return structuredClone(profile);
}

describe("detectPrivacyRisks", () => {
  it.each([
    ["teacher@example.com", "email"],
    ["010-1234-5678", "phone"],
    ["120101-3123456", "resident_registration_number"],
    ["여권번호 M12345678", "resident_registration_number"],
    ["운전면허번호: 11-12-123456-78", "resident_registration_number"],
    ["학번: 20261234", "resident_registration_number"],
    ["생년월일은 2012년 3월 4일", "birth_date"],
    ["서울특별시 종로구 세종대로 1", "address"],
    ["김소영 학생은 발표를 어려워한다", "student_name"],
    ["교사 이름: 박은영", "person_name"],
    ["박은영 교사는 토론을 선호한다", "person_name"],
    ["김가람 선생님은 토론을 선호한다", "person_name"],
    ["학생 김민수는 토론을 선호한다", "student_name"],
    ["Alex Kim 학생은 토론을 선호한다", "student_name"],
    ["학생 Alex Kim은 토론을 선호한다", "student_name"],
    ["김가람 학생의 점수는 43점이다", "individual_score"],
    ["한 학생의 점수는 85점이다", "individual_score"],
    ["85점을 받은 한 학생이다", "individual_score"],
    ["김소영 학생의 석차는 3이다", "rank"],
    ["학생 한 명의 석차는 3등이다", "rank"],
    ["3등인 학생 한 명이다", "rank"],
    ["박은영 학생은 ADHD 진단을 받았다", "medical_or_counseling"],
    ["한 학생이 ADHD 진단을 받았다", "medical_or_counseling"],
    ["그 학생의 상담 내용은 외부에 공유되었다", "medical_or_counseling"],
    ["푸른하늘초등학교에서 근무한다", "school_name"],
    ["한빛교육지원청에서 근무한다", "school_name"],
    ["3학년 2반 학생들과 토론한다", "school_name"],
    ["3학년 2반을 대상으로 토론한다", "school_name"],
    ["3학년 2반으로 이동한다", "school_name"],
    ["2반과 함께 프로젝트를 진행한다", "school_name"],
    ["반 이름은 햇살반이다", "school_name"],
    ["햇살반 학생들과 토론한다", "school_name"],
    ["햇살반에서 토론한다", "school_name"],
    ["햇살반을 맡았다", "school_name"],
  ])("detects %s as %s", (text, type) => {
    expect(
      detectPrivacyRisks(text).matches.some((item) => item.type === type),
    ).toBe(true);
  });

  it("does not treat collective support language as a student name", () => {
    const text =
      "일부 학생의 집중을 돕기 위해 짧은 안내와 시각적 순서를 제공한다.";
    expect(containsPrivacyRisk(text)).toBe(false);
  });

  it.each([
    "OO 학생은 발표 대신 글쓰기를 선택할 수 있다.",
    "○○ 학생에게 짧은 안내를 제공한다.",
    "A 학생은 익명 예시다.",
    "한 학생이 질문을 남겼다.",
    "일부 학생에게 시각적 순서를 제공한다.",
  ])("keeps anonymous student references clear: %s", (text) => {
    expect(containsPrivacyRisk(text)).toBe(false);
  });

  it.each([
    "김소영 학생",
    "박은영 학생",
    "김가람 학생",
    "학생 김소영",
    "학생 박은영",
    "학생 김가람",
  ])(
    "detects a plausible Korean name on either side of a student role: %s",
    (text) => {
      expect(
        detectPrivacyRisks(text).matches.some(
          (match) => match.type === "student_name",
        ),
      ).toBe(true);
    },
  );

  it.each([
    "학생",
    "학생들",
    "학급",
    "우리 학급",
    "우리 반",
    "학생들은 자신의 생각을 설명할 시간이 필요하다.",
    "학급 전체에 시각적 순서를 제공한다.",
    "우리 학급은 토론과 수정 기회를 중요하게 여긴다.",
    "우리 반 학생들이 안전하게 질문하도록 지원한다.",
    "선택한 학생은 발표하고 이해한 학생은 다음 활동으로 이동한다.",
    "지원한 학생에게도 다시 선택할 기회를 준다.",
    "고른 학생은 발표하고 정리한 학생은 다음 활동으로 이동한다.",
    "구성한 학생에게 발표 순서를 선택하게 한다.",
    "고민한 학생과 조사한 학생이 서로 방법을 비교한다.",
    "정돈한 학생과 구별한 학생에게 설명할 시간을 준다.",
    "수업일은 2026년 7월 31일이다.",
    "수업일은 2026-07-31이다.",
    "학급 평균은 80점이다.",
    "점수는 43점이다.",
    "100점 만점 기준을 먼저 설명한다.",
    "석차 3은 예시 문구다.",
    "1등 수업 아이디어를 함께 고른다.",
    "우리 반은 대회에서 1위를 했다.",
    "ADHD 학생 지원 전략으로 짧은 단계 안내를 활용한다.",
    "진단명 없이 관찰 가능한 지원 요구만 기록한다.",
    "건강 정보는 입력하지 않는다.",
    "상담 기록은 외부에 공유하지 않는다.",
    "학생 건강을 위한 일반적인 보건교육 원칙을 세운다.",
    "반 이름은 기록하거나 공유하지 않는다.",
    "우리 학교에서는 학생의 선택권을 중요하게 생각한다.",
    "일반고등학교에서도 학생의 선택권을 보장한다.",
    "공립초등학교의 일반적인 수업 환경을 고려한다.",
    "교육대학교 예비교사에게 자료를 제공한다.",
    "소규모반 학생에게도 다양한 참여 통로를 제공한다.",
    "프로젝트 이름은 질문나무다.",
    "활동 이름은 생각나무다.",
    "학생 이름: 익명",
    "교사 이름: 없음",
    "보호자 성명: 비공개",
    "성명: 없음",
    "실명: 비공개",
    "실명제를 도입하지 않습니다.",
    "실명제는 개인정보 보호와 관련됩니다.",
    "성명서를 발표합니다.",
    "성명은 기록하지 않습니다.",
    "실명 표기를 피합니다.",
    "실명은 공개하지 않습니다.",
    "성명은 쓰지 않습니다.",
    "실명은 밝히지 않습니다.",
    "성명은 언급하지 않습니다.",
    "실명은 노출하지 않습니다.",
    "성명은 필요하지 않습니다.",
    "성명은 무엇인가요?",
    "교사 이름은 무엇인가요?",
    "학생 이름은 무엇인가요?",
    "본인 이름은 무엇인가요?",
    "교사 성명은 무엇인가요?",
    "위기 학생에게 예측 가능한 순서를 안내합니다.",
    "장애 학생을 위한 접근 가능한 자료를 준비합니다.",
    "편입 학생에게 교실 흐름을 안내합니다.",
    "신입 교사는 동료와 수업을 함께 검토합니다.",
    "어떤 학생도 안전하게 참여할 수 있어야 한다.",
    "어떤 교사에게나 준비 시간이 필요하다.",
    "국어 교사로 근무합니다.",
    "기간제 교사입니다.",
    "원어민 교사와 협업합니다.",
    "진로 교사에게 자료를 제공합니다.",
    "현직 교사의 관심사를 묻습니다.",
    "현재 교사는 토론 수업을 준비합니다.",
    "전입 학생은 새 환경을 익히는 중입니다.",
    "조용한 학생에게 생각할 시간을 줍니다.",
    "이상한 학생이라는 표현은 사용하지 않습니다.",
    "이러한 교사는 질문을 기다려 줍니다.",
    "최대한 학생 참여를 지원합니다.",
    "이전의 학생 반응을 다음 수업에 반영합니다.",
    "성적별 학생 지원 자료를 준비합니다.",
    "원아 보호자와 관찰 기록을 공유합니다.",
    "국어 교사는 평균 80점 기준을 설명합니다.",
    "교사의 수업 운영 방식은 학생의 선택과 참여를 존중하는 데 초점을 둡니다.",
    "교사는 보드게임과 사회정서적 주제를 학생의 자발적 학습력으로 연결하는 수업 가능성을 탐색하고 있다. 활동 자체의 재미뿐 아니라 학생들이 편안하고 즐겁게 참여하는 분위기 조성이 중요한 역할로 나타난다.",
    "전략을 학생과 함께 정합니다.",
    "원리를 학생에게 설명합니다.",
    "자료를 학생의 선택에 맞춰 제공합니다.",
    "과제를 학생의 경험과 연결합니다.",
    "기회를 학생에게 제공합니다.",
    "문제를 학생과 함께 해결합니다.",
    "반응을 학생의 다음 활동에 반영합니다.",
    "설명은 학생의 질문 뒤에 제공합니다.",
    "선택은 학생에게 맡깁니다.",
    "성장은 학생의 수정 과정에서 확인합니다.",
    "기준은 학생과 함께 정합니다.",
    "교사 정체성은 학생의 성장을 지원하는 역할에 가깝습니다.",
    "성찰적 교사는 학생의 반응을 다음 수업에 반영합니다.",
    "교육관과 학생관 요약",
    "배움은 학생이 스스로 의미를 구성하는 과정입니다.",
    "기다림은 학생의 속도를 존중하는 태도입니다.",
    "선택권은 학생과 함께 정합니다.",
    "주도권은 학생에게 넘깁니다.",
    "수업은 학생이 질문하는 시간입니다.",
    "교실은 학생이 실수해도 안전한 곳입니다.",
    "관계는 학생과 함께 만듭니다.",
    "평가는 학생의 성장을 돕습니다.",
    "상담 내용은 보호자에게 제공하거나 교내에 기록한다.",
    "산만한 학생에게 짧은 활동 순서를 안내한다.",
    "수학을 못하는 학생에게 단계별 예시를 제공한다.",
  ])("keeps generic dates, metrics, and support guidance clear: %s", (text) => {
    expect(containsPrivacyRisk(text)).toBe(false);
  });

  it.each([
    "중학교 2학년 국어 수업을 담당합니다.",
    "학급 인원은 20명대이고 기기는 모둠별로 공유합니다.",
    "농산어촌 학교에서 네트워크가 불안정한 경우를 대비합니다.",
    "여러 학급에서 읽기 속도와 발표 부담의 차이가 크게 나타납니다.",
    "집중과 활동 전환 지원이 필요한 학생이 일부 있습니다.",
  ])("keeps useful anonymous school and class context clear: %s", (text) => {
    expect(containsPrivacyRisk(text)).toBe(false);
  });

  it.each([
    "지난 4월 12일 시청 과학대회에서 단독 수상한 5학년 학생의 참여를 지원한다.",
    "6학년 한 학생이 전학한 후 수업 참여를 돕는다.",
    "A 학생이 2026년 4월 12일 대회에서 수상했다.",
  ])("blocks a strong combination of quasi-identifying clues: %s", (text) => {
    expect(containsPrivacyRisk(text)).toBe(true);
  });

  it.each([
    "4월 12일 5학년 학생들이 과학대회에 참여했다.",
    "4월 12일 한 학생이 탐구 활동에 참여했다.",
    "5학년 한 학생이 수업에 참여했다.",
  ])(
    "does not block an incomplete quasi-identifier combination: %s",
    (text) => {
      expect(containsPrivacyRisk(text)).toBe(false);
    },
  );

  it.each([
    "김다은 학생의 선택을 존중합니다.",
    "이하은 학생에게 단계별 안내를 제공합니다.",
    "박지은 학생은 토론을 선호합니다.",
    "김가을 학생은 토론을 선호합니다.",
    "학생 김다은의 선택을 존중합니다.",
    "교사 박은영은 토론을 선호합니다.",
    "교사 이름: 오준",
    "성명: 박은영",
    "성명은 박은영입니다.",
    "실명: 박은영",
    "교사 성명: 박은영",
    "학생 성명: 김민수",
    "본인 성명: 박은영",
    "교사 이름: Alex",
    "학생 이름: Joon",
    "교사 이름은 박은영입니다.",
    "학생 이름은 Joon입니다.",
    "제 이름은 김민수예요.",
    "제 이름은 김민수이에요.",
    "제 이름은 김민수라고 합니다.",
    "제 이름은 김민수라고 해요.",
    "교사 이름: '박은영'",
    "학생 이름: “김민수”",
    "성명: 「박은영」",
    "교사 이름은 박은영 님입니다.",
  ])(
    "keeps likely Korean names blocked after grammar exceptions: %s",
    (text) => {
      expect(containsPrivacyRisk(text)).toBe(true);
    },
  );

  it.each(["991332-1234567", "120101-9123456", "000230-3123456"])(
    "ignores a structurally invalid resident number: %s",
    (text) => {
      expect(
        detectPrivacyRisks(text).matches.some(
          (match) => match.type === "resident_registration_number",
        ),
      ).toBe(false);
    },
  );

  it("does not mistake ordinary teacher-and-student wording for a name", () => {
    expect(containsPrivacyRisk("교사 설명은 짧고 명확하게 구성한다.")).toBe(
      false,
    );
    expect(
      containsPrivacyRisk("짧은 교사 안내와 학생 활동을 분명히 구분한다."),
    ).toBe(false);
  });

  it("keeps every authored question prompt, intent, and example clear of privacy-risk patterns", () => {
    const questions = [
      ...COMMON_QUESTIONS,
      ...KINDERGARTEN_QUESTIONS,
      ...ELEMENTARY_QUESTIONS,
      ...MIDDLE_QUESTIONS,
      ...HIGH_QUESTIONS,
      ...Object.values(ROLE_QUESTIONS),
    ];
    const blocked = questions.flatMap((question) =>
      (["prompt", "intent", "example"] as const)
        .filter((field) => containsPrivacyRisk(question[field]))
        .map((field) => `${question.id}.${field}`),
    );
    expect(blocked).toEqual([]);
  });

  it("marks a profile with private content for review", () => {
    const profile = fictionalProfile();
    const claim = profile.modules[0]?.claims[0];
    if (!claim) throw new Error("Missing fictional claim");
    claim.text = "김민수 학생의 점수는 43점이고 ADHD 진단을 받았다.";
    const review = reviewProfilePrivacy(profile);
    expect(review.status).toBe("needs_review");
    expect(review.items).toHaveLength(1);
  });
});

describe("support-centered rewriting", () => {
  it("rewrites a deficit label as an instructional support", () => {
    const result = rewriteStudentDescription("수학을 못하는 학생이 3명 있다.");
    expect(result.changed).toBe(true);
    expect(result.rewritten).toContain("기초학습 지원");
    expect(result.rewritten).toContain("단계별 안내");
    expect(result.rewritten).not.toContain("못하는");
  });

  it("removes a named diagnosis and suggests classroom supports", () => {
    const result = rewriteStudentDescription("김민수 학생은 ADHD가 있다.");
    expect(result.rewritten).not.toContain("김민수");
    expect(result.rewritten).not.toContain("ADHD");
    expect(result.rewritten).toContain("활동 전환");
  });
});
