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
