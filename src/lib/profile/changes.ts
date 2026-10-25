import {
  machineIdentifierSchema,
  type ProfileClaim,
  type ProfileModuleId,
} from "@/types/profile";

export const TEACHER_AUTHORED_EVIDENCE_ID = "teacher-authored";

export function createTeacherAuthoredClaim(
  moduleId: ProfileModuleId,
  existingClaimIds: Iterable<string>,
  randomId: () => string = () => crypto.randomUUID(),
): ProfileClaim {
  const existing = new Set(existingClaimIds);
  for (let attempt = 0; attempt <= 10; attempt++) {
    const id = `${moduleId}:teacher:${randomId().replaceAll("-", "").slice(0, 8)}`;
    if (!machineIdentifierSchema.safeParse(id).success)
      throw new Error("Invalid generated claim identifier");
    if (!existing.has(id))
      return {
        id,
        text: "",
        basis: "direct",
        evidenceQuestionIds: [TEACHER_AUTHORED_EVIDENCE_ID],
        confirmedByUser: false,
      };
  }
  throw new Error("Could not generate a unique claim identifier");
}

export function isTeacherAuthoredClaim(
  claim: Pick<ProfileClaim, "evidenceQuestionIds">,
): boolean {
  return claim.evidenceQuestionIds.includes(TEACHER_AUTHORED_EVIDENCE_ID);
}
