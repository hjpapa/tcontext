import { describe, expect, it } from "vitest";
import { detectPrivacyRisks } from "./detector";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  localAuthoredProfilePrivacyReview,
  localProfilePrivacyReview,
} from "@/lib/security/privacy-guard";

describe("non-disclosure instructions in teacher profiles", () => {
  it("applies the same rule to final review and optional storage without rewriting the profile", () => {
    const profile = structuredClone(FICTIONAL_PROFILES[0]!);
    profile.aiCollaborationInstructions.push(
      "개별 학생의 건강 정보나 상담 기록은 AI에 입력하지 않는다.",
    );
    const before = structuredClone(profile);
    expect(localAuthoredProfilePrivacyReview(profile).status).toBe("clear");
    expect(localProfilePrivacyReview(profile).status).toBe("clear");
    expect(profile).toEqual(before);
    profile.aiCollaborationInstructions.push(
      "한 학생은 ADHD 진단을 받았지만 입력하지 않는다.",
    );
    expect(localAuthoredProfilePrivacyReview(profile).status).toBe(
      "needs_review",
    );
    expect(localProfilePrivacyReview(profile).status).toBe("needs_review");
  });
  it.each([
    "개별 학생의 건강 정보나 상담 기록은 AI에 입력하지 않는다.",
    "특정 학생의 상담 내용이나 가정 환경을 기록하지 않습니다.",
    "개별 학생의 이름, 성적, 건강 정보는 포함하지 않고 집단 수준의 지원 요구만 전달한다.",
  ])("accepts generic instructions without disclosed values: %s", (text) => {
    expect(detectPrivacyRisks(text).matches.map((match) => match.type)).toEqual(
      [],
    );
  });

  it.each([
    "김민수 학생의 건강 정보는 AI에 입력하지 않는다.",
    "한 학생은 ADHD 진단을 받았지만 AI에 입력하지 않는다.",
    "개별 학생의 상담 기록: 우울증 치료 중. 공유하지 않는다.",
    "개별 학생의 건강 정보는 AI에 입력하지 않는다(우울증 치료 중).",
    "개별 학생의 건강 정보는 AI에 입력하지 않는다. 한 학생은 ADHD 진단을 받았다.",
    "김민수 학생. 개별 학생의 건강 정보는 AI에 입력하지 않는다.",
    "개별 학생의 건강 정보는 상담 기록에 남긴다.",
  ])("still flags actual identifying or sensitive details: %s", (text) => {
    expect(detectPrivacyRisks(text).status).toBe("blocked");
  });
});
