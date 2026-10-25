import {
  machineIdentifierSchema,
  type ProfileClaim,
  type ProfileModuleId,
  type TeacherContextProfile,
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

export type ProfileChanges = {
  profileTitleChanged: boolean;
  shortSummaryChanged: boolean;
  modules: Record<
    ProfileModuleId,
    {
      titleChanged: boolean;
      summaryChanged: boolean;
      added: string[];
      edited: string[];
      removedCount: number;
      reordered: boolean;
    }
  >;
  synthesis: Record<
    | "teachingDesignPrinciples"
    | "classSupportConsiderations"
    | "realisticConstraints"
    | "aiCollaborationInstructions",
    { changed: boolean }
  >;
  changedCount: number;
};
export function diffProfiles(
  baseline: TeacherContextProfile | null,
  profile: TeacherContextProfile,
): ProfileChanges {
  const modules = {} as ProfileChanges["modules"];
  let changedCount =
    Number(baseline?.profileTitle !== profile.profileTitle) +
    Number(baseline?.shortSummary !== profile.shortSummary);
  for (const profileModule of profile.modules) {
    const before = baseline?.modules.find(
      (item) => item.id === profileModule.id,
    );
    const previous = new Map(
      before?.claims.map((claim) => [claim.id, claim]) ?? [],
    );
    const currentIds = new Set(profileModule.claims.map((claim) => claim.id));
    const added = profileModule.claims
      .filter((claim) => !previous.has(claim.id))
      .map((claim) => claim.id);
    const content = (claim: ProfileClaim) =>
      JSON.stringify([claim.text, claim.basis, claim.evidenceQuestionIds]);
    const edited = profileModule.claims
      .filter(
        (claim) =>
          previous.has(claim.id) &&
          content(previous.get(claim.id)!) !== content(claim),
      )
      .map((claim) => claim.id);
    const removedCount = (before?.claims ?? []).filter(
      (claim) => !currentIds.has(claim.id),
    ).length;
    const commonBefore = (before?.claims ?? [])
      .filter((claim) => currentIds.has(claim.id))
      .map((claim) => claim.id);
    const commonAfter = profileModule.claims
      .filter((claim) => previous.has(claim.id))
      .map((claim) => claim.id);
    const change = {
      titleChanged: before?.title !== profileModule.title,
      summaryChanged: before?.summary !== profileModule.summary,
      added,
      edited,
      removedCount,
      reordered: JSON.stringify(commonBefore) !== JSON.stringify(commonAfter),
    };
    modules[profileModule.id] = change;
    changedCount +=
      Number(change.titleChanged) +
      Number(change.summaryChanged) +
      added.length +
      edited.length +
      removedCount +
      Number(change.reordered);
  }
  const synthesis = {} as ProfileChanges["synthesis"];
  for (const key of [
    "teachingDesignPrinciples",
    "classSupportConsiderations",
    "realisticConstraints",
    "aiCollaborationInstructions",
  ] as const) {
    const changed =
      JSON.stringify(baseline?.[key] ?? []) !== JSON.stringify(profile[key]);
    synthesis[key] = { changed };
    changedCount += Number(changed);
  }
  return {
    profileTitleChanged: baseline?.profileTitle !== profile.profileTitle,
    shortSummaryChanged: baseline?.shortSummary !== profile.shortSummary,
    modules,
    synthesis,
    changedCount,
  };
}
