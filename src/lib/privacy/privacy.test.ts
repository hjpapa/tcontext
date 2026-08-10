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
    ["학생 김민수는 토론을 선호한다", "student_name"],
    ["Alex Kim 학생은 토론을 선호한다", "student_name"],
    ["학생 Alex Kim은 토론을 선호한다", "student_name"],
    ["김가람 학생의 점수는 43점이다", "individual_score"],
    ["김소영 학생의 석차는 3이다", "rank"],
    ["박은영 학생은 ADHD 진단을 받았다", "medical_or_counseling"],
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
    "한 학생의 점수는 85점이다.",
    "학생 한 명의 석차는 3등이다.",
    "한 학생이 ADHD 진단을 받았다.",
    "학생 한 명의 상담 내용은 외부에 공유되었다.",
    "그 학생의 상담 내용: 최근 불안으로 치료 중이다.",
    "상담 내용은 보호자에게 제공하거나 교내에 기록한다.",
    "산만한 학생에게 짧은 활동 순서를 안내한다.",
    "수학을 못하는 학생에게 단계별 예시를 제공한다.",
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
