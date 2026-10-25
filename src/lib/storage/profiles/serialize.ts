import { z } from "zod";
import type { SuggestedTag } from "@/lib/ai/schemas/profile";
import {
  confirmedTagsFromSelection,
  mergeSuggestedTags,
  suggestedTagsFromConfirmedTags,
} from "@/lib/profile/tags";
import {
  PENDING_PRIVACY_REVIEW,
  isPendingPrivacyReview,
  teacherContextProfileSchema,
  type PrivacyReview,
  type TeacherContextProfile,
} from "@/types/profile";
import { localDraftProfileSchema, type LocalProfileRecord } from "./schema";

export type ConfirmedSnapshot = NonNullable<LocalProfileRecord["confirmed"]>;
export type DraftSnapshot = NonNullable<LocalProfileRecord["draft"]>;
export type SerializeError =
  "invalid_profile" | "not_finalized" | "invalid_draft";

function copyProfile(
  profile: TeacherContextProfile,
  review: PrivacyReview,
  tags = profile.confirmedTags,
): TeacherContextProfile {
  return {
    metadata: {
      schoolLevel: profile.metadata.schoolLevel,
      role: profile.metadata.role,
      teachingSubject: profile.metadata.teachingSubject,
      generatedAt: profile.metadata.generatedAt,
      schemaVersion: profile.metadata.schemaVersion,
      modelName: profile.metadata.modelName,
      promptVersion: profile.metadata.promptVersion,
    },
    profileTitle: profile.profileTitle,
    shortSummary: profile.shortSummary,
    modules: profile.modules.map((module) => ({
      id: module.id,
      title: module.title,
      summary: module.summary,
      claims: module.claims.map((claim) => ({
        id: claim.id,
        text: claim.text,
        basis: claim.basis,
        evidenceQuestionIds: claim.evidenceQuestionIds.map((id) => id),
        confirmedByUser: claim.confirmedByUser,
      })),
    })),
    teachingDesignPrinciples: profile.teachingDesignPrinciples.map(
      (text) => text,
    ),
    classSupportConsiderations: profile.classSupportConsiderations.map(
      (text) => text,
    ),
    realisticConstraints: profile.realisticConstraints.map((text) => text),
    aiCollaborationInstructions: profile.aiCollaborationInstructions.map(
      (text) => text,
    ),
    confirmedTags: {
      preferredTeachingMethods: tags.preferredTeachingMethods.map((tag) => tag),
      participationPriorities: tags.participationPriorities.map((tag) => tag),
      emotionalSupportPriorities: tags.emotionalSupportPriorities.map(
        (tag) => tag,
      ),
      assessmentPriorities: tags.assessmentPriorities.map((tag) => tag),
      environmentConstraints: tags.environmentConstraints.map((tag) => tag),
      aiBoundaries: tags.aiBoundaries.map((tag) => tag),
    },
    privacyReview: {
      status: review.status,
      items: review.items.map((item) => ({
        text: item.text,
        reason: item.reason,
        suggestedRewrite: item.suggestedRewrite,
      })),
    },
  };
}

export function toConfirmedSnapshot(
  profile: TeacherContextProfile,
  now: string,
):
  | { ok: true; snapshot: ConfirmedSnapshot }
  | { ok: false; error: SerializeError } {
  const parsed = teacherContextProfileSchema.safeParse(
    copyProfile(profile, profile.privacyReview),
  );
  if (!parsed.success || !z.iso.datetime().safeParse(now).success)
    return { ok: false, error: "invalid_profile" };
  if (isPendingPrivacyReview(parsed.data.privacyReview))
    return { ok: false, error: "not_finalized" };
  return { ok: true, snapshot: { profile: parsed.data, confirmedAt: now } };
}

export function toDraftSnapshot(input: {
  profile: TeacherContextProfile;
  suggestedTags: readonly SuggestedTag[];
  selectedTagKeys: Iterable<string>;
  baseConfirmedAt: string | null;
  now: string;
}):
  { ok: true; snapshot: DraftSnapshot } | { ok: false; error: SerializeError } {
  const tags = confirmedTagsFromSelection(
    mergeSuggestedTags(
      input.suggestedTags,
      suggestedTagsFromConfirmedTags(input.profile.confirmedTags),
    ),
    input.selectedTagKeys,
  );
  const parsed = localDraftProfileSchema.safeParse(
    copyProfile(input.profile, PENDING_PRIVACY_REVIEW, tags),
  );
  if (
    !parsed.success ||
    !z.iso.datetime().safeParse(input.now).success ||
    !z.iso.datetime().nullable().safeParse(input.baseConfirmedAt).success
  )
    return { ok: false, error: "invalid_draft" };
  return {
    ok: true,
    snapshot: {
      profile: parsed.data,
      baseConfirmedAt: input.baseConfirmedAt,
      updatedAt: input.now,
    },
  };
}

export type EditableLocalProfileSession = {
  recordId: string;
  revision: number;
  profile: TeacherContextProfile;
  baseline: TeacherContextProfile | null;
  suggestedTags: SuggestedTag[];
  source: "draft" | "confirmed";
};
export function toEditableSession(
  record: LocalProfileRecord,
): EditableLocalProfileSession {
  const source = record.draft ?? record.confirmed;
  if (!source) throw new Error("Local record has no profile");
  const profile = copyProfile(source.profile, source.profile.privacyReview);
  return {
    recordId: record.id,
    revision: record.revision,
    profile,
    baseline: record.confirmed
      ? copyProfile(
          record.confirmed.profile,
          record.confirmed.profile.privacyReview,
        )
      : null,
    suggestedTags: mergeSuggestedTags(
      record.suggestedTags,
      suggestedTagsFromConfirmedTags(profile.confirmedTags),
    ).map((tag) => ({ category: tag.category, tag: tag.tag }) as SuggestedTag),
    source: record.draft ? "draft" : "confirmed",
  };
}
