import { expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { CONTROLLED_TAGS, PROFILE_MODULE_IDS } from "@/types/profile";
import { changedAreas, sameProfileContent } from "./versions";

it.each(FICTIONAL_PROFILES)(
  "recognizes identical document content for $profileTitle",
  (profile) => {
    expect(sameProfileContent(profile, structuredClone(profile))).toBe(true);
    expect(changedAreas(profile, structuredClone(profile))).toEqual([]);
  },
);

it("compares document content while ignoring analysis tags and hidden metadata", () => {
  const before = structuredClone(FICTIONAL_PROFILES[0]!);
  const after = structuredClone(before);
  after.confirmedTags.aiBoundaries = before.confirmedTags.aiBoundaries.length
    ? []
    : [CONTROLLED_TAGS.aiBoundaries[0]];
  after.metadata.modelName = "replacement-model";
  after.modules[0]!.claims[0]!.evidenceQuestionIds = ["replacement-evidence"];
  expect(sameProfileContent(before, after)).toBe(true);
  after.metadata.generatedAt = "2026-10-30T00:00:00.000Z";
  expect(sameProfileContent(before, after)).toBe(false);
});

it("detects visible text and claim confirmation changes in document content", () => {
  const before = structuredClone(FICTIONAL_PROFILES[0]!);
  const after = structuredClone(before);
  after.profileTitle += " 수정";
  expect(sameProfileContent(before, after)).toBe(false);
  after.profileTitle = before.profileTitle;
  after.modules[0]!.claims[0]!.confirmedByUser =
    !before.modules[0]!.claims[0]!.confirmedByUser;
  expect(sameProfileContent(before, after)).toBe(false);
});

it("returns each changed area once in profile, module and synthesis order", () => {
  const before = structuredClone(FICTIONAL_PROFILES[0]!);
  before.modules[5]!.claims.push({
    ...before.modules[5]!.claims[0]!,
    id: "second-order-claim",
  });
  const after = structuredClone(before);
  after.profileTitle += " 수정";
  after.shortSummary += " 수정";
  after.modules[0]!.title += " 수정";
  after.modules[0]!.summary += " 수정";
  after.modules[1]!.summary += " 수정";
  after.modules[2]!.claims.push({
    ...after.modules[2]!.claims[0]!,
    id: "new-area-claim",
  });
  after.modules[3]!.claims[0]!.text += " 수정";
  after.modules[4]!.claims.pop();
  after.modules[5]!.claims.reverse();
  after.modules[6]!.claims[0]!.evidenceQuestionIds = ["changed-evidence"];
  after.modules.reverse();
  after.teachingDesignPrinciples.push("추가 수업 원칙");
  after.classSupportConsiderations.push("추가 학급 지원");
  after.realisticConstraints.push("추가 환경 제약");
  after.aiCollaborationInstructions.push("추가 협업 지침");
  expect(changedAreas(before, after)).toEqual([
    { kind: "profile", field: "profileTitle" },
    { kind: "profile", field: "shortSummary" },
    ...PROFILE_MODULE_IDS.map((id) => ({ kind: "module", id })),
    { kind: "synthesis", id: "teachingDesignPrinciples" },
    { kind: "synthesis", id: "classSupportConsiderations" },
    { kind: "synthesis", id: "realisticConstraints" },
    { kind: "synthesis", id: "aiCollaborationInstructions" },
  ]);
});

it("omits unchanged areas and follows the existing diff treatment of tags and review flags", () => {
  const before = structuredClone(FICTIONAL_PROFILES[0]!);
  const after = structuredClone(before);
  after.confirmedTags.aiBoundaries = [];
  after.modules[0]!.claims[0]!.confirmedByUser =
    !before.modules[0]!.claims[0]!.confirmedByUser;
  expect(changedAreas(before, after)).toEqual([]);
  after.modules[4]!.title += " 수정";
  after.realisticConstraints.push("수정한 제약");
  expect(changedAreas(before, after)).toEqual([
    { kind: "module", id: "participation_and_emotion" },
    { kind: "synthesis", id: "realisticConstraints" },
  ]);
});
