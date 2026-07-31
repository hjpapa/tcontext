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
    ["김민수 학생은 발표를 어려워한다", "student_name"],
    ["교사 이름: 김민수", "person_name"],
    ["점수는 43점이다", "individual_score"],
    ["석차 3", "rank"],
    ["ADHD 진단을 받았다", "medical_or_counseling"],
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
