import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import {
  PROFILE_MODULE_IDS,
  type ProfileModuleId,
  type TeacherContextProfile,
} from "@/types/profile";
import { diffProfiles } from "./changes";

export function sameProfileContent(
  a: TeacherContextProfile,
  b: TeacherContextProfile,
): boolean {
  return profileToMarkdown(a) === profileToMarkdown(b);
}

export type ChangedArea =
  | { kind: "profile"; field: "profileTitle" | "shortSummary" }
  | { kind: "module"; id: ProfileModuleId }
  | {
      kind: "synthesis";
      id:
        | "teachingDesignPrinciples"
        | "classSupportConsiderations"
        | "realisticConstraints"
        | "aiCollaborationInstructions";
    };

export function changedAreas(
  before: TeacherContextProfile,
  after: TeacherContextProfile,
): ChangedArea[] {
  const changes = diffProfiles(before, after);
  const areas: ChangedArea[] = [];
  if (changes.profileTitleChanged)
    areas.push({ kind: "profile", field: "profileTitle" });
  if (changes.shortSummaryChanged)
    areas.push({ kind: "profile", field: "shortSummary" });
  for (const id of PROFILE_MODULE_IDS) {
    const change = changes.modules[id];
    if (
      change.titleChanged ||
      change.summaryChanged ||
      change.added.length > 0 ||
      change.edited.length > 0 ||
      change.removedCount > 0 ||
      change.reordered
    )
      areas.push({ kind: "module", id });
  }
  for (const id of [
    "teachingDesignPrinciples",
    "classSupportConsiderations",
    "realisticConstraints",
    "aiCollaborationInstructions",
  ] as const)
    if (changes.synthesis[id].changed) areas.push({ kind: "synthesis", id });
  return areas;
}
