import { expect, it, vi } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  machineIdentifierSchema,
  teacherContextProfileSchema,
} from "@/types/profile";
import {
  createTeacherAuthoredClaim,
  isTeacherAuthoredClaim,
  TEACHER_AUTHORED_EVIDENCE_ID,
} from "./changes";
it("creates a valid unconfirmed teacher-authored claim", () => {
  const claim = createTeacherAuthoredClaim(
    "identity_and_role",
    [],
    () => "abcd-1234-5678",
  );
  expect(claim).toEqual({
    id: "identity_and_role:teacher:abcd1234",
    text: "",
    basis: "direct",
    evidenceQuestionIds: [TEACHER_AUTHORED_EVIDENCE_ID],
    confirmedByUser: false,
  });
  expect(machineIdentifierSchema.safeParse(claim.id).success).toBe(true);
  expect(isTeacherAuthoredClaim(claim)).toBe(true);
  expect(
    isTeacherAuthoredClaim({ evidenceQuestionIds: ["common-role-focus"] }),
  ).toBe(false);
  const p = structuredClone(FICTIONAL_PROFILES[0]!);
  claim.text = "교사가 직접 작성한 지원 원칙";
  p.modules[0]!.claims.push(claim);
  expect(teacherContextProfileSchema.safeParse(p).success).toBe(true);
});
it("retries collisions at most ten times after the initial attempt", () => {
  const existing = ["identity_and_role:teacher:aaaaaaaa"];
  const random = vi
    .fn()
    .mockReturnValueOnce("aaaaaaaa")
    .mockReturnValue("bbbbbbbb");
  expect(
    createTeacherAuthoredClaim("identity_and_role", existing, random).id,
  ).toContain("bbbbbbbb");
  expect(random).toHaveBeenCalledTimes(2);
  const stuck = vi.fn(() => "aaaaaaaa");
  expect(() =>
    createTeacherAuthoredClaim("identity_and_role", existing, stuck),
  ).toThrow();
  expect(stuck).toHaveBeenCalledTimes(11);
  expect(() =>
    createTeacherAuthoredClaim("identity_and_role", [], () => "!invalid"),
  ).toThrow();
});

it("diffs title, summary, claims and synthesis without treating tags or confirmation as content", async () => {
  const { diffProfiles } = await import("./changes");
  const baseline = structuredClone(FICTIONAL_PROFILES[0]!);
  const profile = structuredClone(baseline);
  expect(diffProfiles(baseline, profile).changedCount).toBe(0);
  profile.confirmedTags.aiBoundaries = [];
  profile.modules[0]!.claims[0]!.confirmedByUser = false;
  expect(diffProfiles(baseline, profile).changedCount).toBe(0);
  profile.profileTitle += " 수정";
  profile.shortSummary += " 수정";
  profile.modules[0]!.title += " 수정";
  profile.modules[0]!.summary += " 수정";
  const originalId = profile.modules[0]!.claims[0]!.id;
  profile.modules[0]!.claims[0]!.text += " 수정";
  const removed = profile.modules[1]!.claims.pop()!;
  const added = createTeacherAuthoredClaim(
    profile.modules[0]!.id,
    [],
    () => "12345678",
  );
  profile.modules[0]!.claims.push(added);
  profile.teachingDesignPrinciples.push("추가 원칙");
  const diff = diffProfiles(baseline, profile);
  expect(diff).toMatchObject({
    profileTitleChanged: true,
    shortSummaryChanged: true,
    modules: {
      identity_and_role: {
        titleChanged: true,
        summaryChanged: true,
        added: [added.id],
        edited: [originalId],
        reordered: false,
      },
      educational_philosophy: { removedCount: 1 },
    },
    synthesis: { teachingDesignPrinciples: { changed: true } },
  });
  expect(removed).toBeDefined();
  const beforeOrder = structuredClone(baseline);
  beforeOrder.modules[0]!.claims.push({
    ...beforeOrder.modules[0]!.claims[0]!,
    id: "second-order-claim",
  });
  const reordered = structuredClone(beforeOrder);
  reordered.modules[0]!.claims.reverse();
  expect(
    diffProfiles(beforeOrder, reordered).modules.identity_and_role,
  ).toMatchObject({ reordered: true, edited: [], added: [], removedCount: 0 });
  expect(diffProfiles(null, baseline).modules.identity_and_role.added).toEqual(
    baseline.modules[0]!.claims.map((claim) => claim.id),
  );
});
