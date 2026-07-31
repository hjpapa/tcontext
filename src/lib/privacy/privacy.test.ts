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
    ["생년월일은 2012년 3월 4일", "birth_date"],
    ["서울특별시 종로구 세종대로 1", "address"],
    ["김소영 학생은 발표를 어려워한다", "student_name"],
    ["교사 이름: 박은영", "person_name"],
    ["박은영 교사는 토론을 선호한다", "person_name"],
    ["김가람 선생님은 토론을 선호한다", "person_name"],
    ["김가람 학생의 점수는 43점이다", "individual_score"],
    ["김소영 학생의 석차는 3이다", "rank"],
    ["박은영 학생은 ADHD 진단을 받았다", "medical_or_counseling"],
    ["푸른하늘초등학교에서 근무한다", "school_name"],
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

  it.each(["김소영 학생", "박은영 학생", "김가람 학생"])(
    "detects a plausible Korean name in student context: %s",
    (text) => {
      expect(
        detectPrivacyRisks(text).matches.some(
          (match) => match.type === "student_name",
        ),
      ).toBe(true);
    },
  );

  it.each([
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
    "프로젝트 이름은 질문나무다.",
    "활동 이름은 생각나무다.",
    "어떤 학생도 안전하게 참여할 수 있어야 한다.",
    "어떤 교사에게나 준비 시간이 필요하다.",
    "국어 교사로 근무합니다.",
    "기간제 교사입니다.",
    "원어민 교사와 협업합니다.",
    "진로 교사에게 자료를 제공합니다.",
    "현직 교사의 관심사를 묻습니다.",
    "원아 보호자와 관찰 기록을 공유합니다.",
    "국어 교사는 평균 80점 기준을 설명합니다.",
  ])("keeps generic dates, metrics, and support guidance clear: %s", (text) => {
    expect(containsPrivacyRisk(text)).toBe(false);
  });

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
