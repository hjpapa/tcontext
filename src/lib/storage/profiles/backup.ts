import type { SuggestedTag } from "@/lib/ai/schemas/profile";
import { profileBackupFilename } from "@/lib/export/download";
import type { ExportFile } from "@/lib/export/files";
import { localAuthoredProfilePrivacyReview } from "@/lib/security/privacy-guard";
import {
  PENDING_PRIVACY_REVIEW,
  type TeacherContextProfile,
} from "@/types/profile";
import { migrateBackupFile, type BackupMigrationError } from "./migrate";
import {
  localDraftProfileSchema,
  profileBackupFileSchema,
  PROFILE_BACKUP_FORMAT,
  PROFILE_BACKUP_FORMAT_VERSION,
  type ProfileBackupFile,
} from "./schema";

export const MAX_BACKUP_FILE_BYTES = 1_048_576;
export type BackupImportError =
  | BackupMigrationError
  | "too_large"
  | "wrong_extension"
  | "read_failed"
  | "invalid_json";
export type BackupResult<T> =
  { ok: true; value: T } | { ok: false; error: BackupImportError };
export const BACKUP_IMPORT_ERROR_MESSAGES: Record<BackupImportError, string> = {
  too_large:
    "파일이 1 MiB를 넘습니다. TContext에서 내려받은 더 작은 JSON 백업을 선택해 주세요.",
  wrong_extension:
    "JSON 파일이 아닙니다. 확장자가 .json인 백업 파일을 선택해 주세요.",
  read_failed:
    "파일을 읽지 못했습니다. 파일 접근 권한을 확인하고 다시 선택해 주세요.",
  invalid_json:
    "JSON 문법이 올바르지 않습니다. 파일을 다시 내려받거나 다른 백업을 선택해 주세요.",
  not_object:
    "프로파일 객체가 없는 파일입니다. TContext JSON 백업을 선택해 주세요.",
  unknown_format:
    "지원하는 프로파일 형식이 아닙니다. TContext에서 내려받은 JSON 백업을 선택해 주세요.",
  unsupported_format_version:
    "더 새로운 백업 형식입니다. 최신 TContext에서 파일을 열어 주세요.",
  invalid_backup:
    "백업의 필수 항목이나 구조가 올바르지 않습니다. 원본 백업을 다시 선택해 주세요.",
  unsupported_profile_schema:
    "지원하지 않는 프로파일 버전입니다. 해당 버전을 지원하는 최신 TContext에서 열어 주세요.",
};
export type BackupImportPreview = {
  profile: TeacherContextProfile;
  suggestedTags: SuggestedTag[];
  title: string;
  schoolLevel: TeacherContextProfile["metadata"]["schoolLevel"];
  role: string;
  modules: {
    id: TeacherContextProfile["modules"][number]["id"];
    title: string;
    claimCount: number;
  }[];
  unconfirmedCount: number;
  warningCount: number;
  kind: ProfileBackupFile["kind"];
  source: "backup_v1" | "bare_profile";
  recordId?: string;
};
export function createProfileBackupFile(input: {
  kind: ProfileBackupFile["kind"];
  profile: TeacherContextProfile;
  suggestedTags: readonly SuggestedTag[];
  recordId?: string;
  now: string;
}): BackupResult<ExportFile> {
  const parsed = profileBackupFileSchema.safeParse({
    format: PROFILE_BACKUP_FORMAT,
    formatVersion: PROFILE_BACKUP_FORMAT_VERSION,
    exportedAt: input.now,
    kind: input.kind,
    profile: input.profile,
    suggestedTags: input.suggestedTags,
    ...(input.recordId === undefined ? {} : { recordId: input.recordId }),
  });
  if (!parsed.success) return { ok: false, error: "invalid_backup" };
  return {
    ok: true,
    value: {
      path: profileBackupFilename(
        parsed.data.profile.metadata.schoolLevel,
        new Date(input.now),
      ),
      mediaType: "application/json",
      content: JSON.stringify(parsed.data, null, 2) + "\n",
    },
  };
}
export async function parseProfileBackupFile(
  file: Pick<File, "name" | "size" | "text">,
  now: string,
): Promise<BackupResult<BackupImportPreview>> {
  if (file.size > MAX_BACKUP_FILE_BYTES)
    return { ok: false, error: "too_large" };
  if (!/\.json$/iu.test(file.name))
    return { ok: false, error: "wrong_extension" };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "read_failed" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/u, ""));
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  const migration = migrateBackupFile(raw, now);
  if (!migration.ok) return migration;
  const backup = migration.backup;
  const parsed = localDraftProfileSchema.safeParse({
    ...backup.profile,
    privacyReview: structuredClone(PENDING_PRIVACY_REVIEW),
  });
  if (!parsed.success) return { ok: false, error: "invalid_backup" };
  const profile = parsed.data;
  return {
    ok: true,
    value: {
      profile,
      suggestedTags: backup.suggestedTags,
      title: profile.profileTitle,
      schoolLevel: profile.metadata.schoolLevel,
      role: profile.metadata.role,
      modules: profile.modules.map((module) => ({
        id: module.id,
        title: module.title,
        claimCount: module.claims.length,
      })),
      unconfirmedCount: profile.modules.reduce(
        (count, module) =>
          count +
          module.claims.filter(
            (claim) =>
              !claim.confirmedByUser || claim.basis === "needs_confirmation",
          ).length,
        0,
      ),
      warningCount: localAuthoredProfilePrivacyReview(profile).items.length,
      kind: backup.kind,
      source: migration.source,
      ...(backup.recordId === undefined ? {} : { recordId: backup.recordId }),
    },
  };
}
