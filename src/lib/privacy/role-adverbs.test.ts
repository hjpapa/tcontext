import { describe, expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { detectPrivacyRisks } from "./detector";
import {
  localAuthoredProfilePrivacyReview,
  localProfilePrivacyReview,
} from "@/lib/security/privacy-guard";

const genericPhrases = [
  "AI의 제안도 교사가 직접 검토한다.",
  "활동 마지막에 학생이 바꾼 생각을 정리한다.",
  "수업 마지막으로 교사가 다음 활동을 안내한다.",
  "활동 중간에 학생의 질문을 살핀다.",
  "설명 직후에 유아가 고른 방법으로 표현한다.",
  "제안은 교사가 교실 조건에 맞게 수정한다.",
  "활동 순서를 유지하되 학생이 표현 방법을 고르게 한다.",
  "AI가 대안을 제안하되 교사가 최종 판단한다.",
  "확인할 질문을 남기고 교사가 검토한다.",
  "선택할 여지를 남기며 학생이 결정하도록 돕는다.",
  "다음 질문을 남기되 학생이 스스로 생각하게 한다.",
];

describe("ordinary phrases beside student and teacher roles", () => {
  it.each(genericPhrases)(
    "does not mistake a grammatical phrase for a name: %s",
    (text) => {
      expect(detectPrivacyRisks(text).matches).toEqual([]);
    },
  );

  it("keeps final review and optional storage consistent without changing claims", () => {
    const profile = structuredClone(FICTIONAL_PROFILES[0]!);
    profile.shortSummary = genericPhrases[0]!;
    profile.teachingDesignPrinciples.push(...genericPhrases.slice(1));
    const before = structuredClone(profile);
    expect(localAuthoredProfilePrivacyReview(profile).status).toBe("clear");
    expect(localProfilePrivacyReview(profile).status).toBe("clear");
    expect(profile).toEqual(before);
  });

  it.each([
    "김민도 교사가 활동을 안내한다.",
    "김서해 학생이 생각을 정리한다.",
    "김진로 학생이 활동을 고른다.",
    "이준서 학생에게 준비 시간을 준다.",
    "마지막에 김민수 학생이 발표한다.",
    "교사 이름: 제안도.",
    "학생 이름: 마지막에.",
    "김민고 교사가 활동을 안내한다.",
    "남기준 교사가 질문을 남긴다.",
    "유지훈 학생이 활동을 고른다.",
    "교사 이름: 남기고.",
    "학생 이름: 유지하되.",
  ])("still blocks identifying names and explicit name labels: %s", (text) => {
    expect(detectPrivacyRisks(text).status).toBe("blocked");
  });
});
