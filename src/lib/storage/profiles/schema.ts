import { z } from "zod";
import { suggestedTagSchema } from "@/lib/ai/schemas/profile";
import { tagKey } from "@/lib/profile/tags";
import {
  CONTROLLED_TAGS,
  PROFILE_MODULE_IDS,
  confirmedTagsInputSchema,
  evidenceBasisSchema,
  isPendingPrivacyReview,
  machineIdentifierSchema,
  privacyReviewOutputSchema,
  profileModuleIdSchema,
  refineTeacherContextProfile,
  teacherContextProfileOutputSchema,
  teacherContextProfileSchema,
} from "@/types/profile";

export const LOCAL_PROFILE_DB_NAME = "tcontext-local-profiles";
export const LOCAL_PROFILE_DB_VERSION = 1;
export const LOCAL_PROFILE_STORAGE_SCHEMA_VERSION = 1;
export const MAX_LOCAL_PROFILES = 10;
export const MAX_DRAFT_TEXT_LENGTH = 20_000;
export const MAX_SUGGESTED_TAGS: number = Object.values(CONTROLLED_TAGS).reduce(
  (total, tags) => total + tags.length,
  0,
);
export const PROFILE_BACKUP_FORMAT = "tcontext.teacher-profile-backup";
export const PROFILE_BACKUP_FORMAT_VERSION = 1;

export function isSupportedProfileSchemaVersion(version: string): boolean {
  return /^1(?:\.\d+)*$/u.test(version);
}

const text = z.string().max(MAX_DRAFT_TEXT_LENGTH);
export const localDraftProfileSchema = z
  .object({
    metadata: teacherContextProfileOutputSchema.shape.metadata,
    profileTitle: text,
    shortSummary: text,
    modules: z
      .array(
        z
          .object({
            id: profileModuleIdSchema,
            title: text,
            summary: text,
            claims: z.array(
              z
                .object({
                  id: machineIdentifierSchema,
                  text,
                  basis: evidenceBasisSchema,
                  evidenceQuestionIds: z.array(machineIdentifierSchema).min(1),
                  confirmedByUser: z.boolean(),
                })
                .strict(),
            ),
          })
          .strict(),
      )
      .length(PROFILE_MODULE_IDS.length),
    teachingDesignPrinciples: z.array(text),
    classSupportConsiderations: z.array(text),
    realisticConstraints: z.array(text),
    aiCollaborationInstructions: z.array(text),
    confirmedTags: confirmedTagsInputSchema,
    privacyReview: privacyReviewOutputSchema,
  })
  .strict()
  .superRefine(refineTeacherContextProfile);
export type LocalDraftProfile = z.output<typeof localDraftProfileSchema>;

export const localProfileSettingsSchema = z
  .object({
    key: z.literal("settings"),
    enabledAt: z.iso.datetime(),
    storageSchemaVersion: z.literal(1),
  })
  .strict();

const suggestedTagsSchema = z
  .array(suggestedTagSchema)
  .max(MAX_SUGGESTED_TAGS)
  .superRefine((tags, context) => {
    if (new Set(tags.map(tagKey)).size !== tags.length)
      context.addIssue({
        code: "custom",
        message: "제안 태그는 중복될 수 없습니다.",
      });
  });

export const localProfileRecordSchema = z
  .object({
    id: z.uuid(),
    storageSchemaVersion: z.literal(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    revision: z.number().int().min(1),
    origin: z.enum(["interview", "import"]),
    suggestedTags: suggestedTagsSchema,
    confirmed: z
      .object({
        profile: teacherContextProfileSchema,
        confirmedAt: z.iso.datetime(),
      })
      .strict()
      .nullable(),
    draft: z
      .object({
        profile: localDraftProfileSchema,
        baseConfirmedAt: z.iso.datetime().nullable(),
        updatedAt: z.iso.datetime(),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((record, context) => {
    if (!record.confirmed && !record.draft)
      context.addIssue({
        code: "custom",
        message: "확정본 또는 초안이 필요합니다.",
      });
    if (
      record.confirmed &&
      isPendingPrivacyReview(record.confirmed.profile.privacyReview)
    )
      context.addIssue({
        code: "custom",
        path: ["confirmed", "profile", "privacyReview"],
        message: "확정본에는 검사 결과가 필요합니다.",
      });
    if (
      record.draft &&
      !isPendingPrivacyReview(record.draft.profile.privacyReview)
    )
      context.addIssue({
        code: "custom",
        path: ["draft", "profile", "privacyReview"],
        message: "초안은 검사 대기 상태여야 합니다.",
      });
    for (const key of ["confirmed", "draft"] as const) {
      const snapshot = record[key];
      if (
        snapshot &&
        !isSupportedProfileSchemaVersion(
          snapshot.profile.metadata.schemaVersion,
        )
      )
        context.addIssue({
          code: "custom",
          path: [key, "profile", "metadata", "schemaVersion"],
          message: "지원하지 않는 프로파일 버전입니다.",
        });
    }
  });
export type LocalProfileRecord = z.output<typeof localProfileRecordSchema>;

const backupFields = {
  format: z.literal(PROFILE_BACKUP_FORMAT),
  formatVersion: z.literal(PROFILE_BACKUP_FORMAT_VERSION),
  exportedAt: z.iso.datetime(),
  recordId: z.uuid().optional(),
  suggestedTags: suggestedTagsSchema,
};
export const profileBackupFileSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...backupFields,
      kind: z.literal("confirmed"),
      profile: teacherContextProfileSchema,
    })
    .strict(),
  z
    .object({
      ...backupFields,
      kind: z.literal("draft"),
      profile: localDraftProfileSchema,
    })
    .strict(),
]);
export type ProfileBackupFile = z.output<typeof profileBackupFileSchema>;
