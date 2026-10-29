import { teacherContextProfileSchema } from "@/types/profile";
import {
  LOCAL_PROFILE_STORAGE_SCHEMA_VERSION,
  PROFILE_BACKUP_FORMAT,
  PROFILE_BACKUP_FORMAT_VERSION,
  isSupportedProfileSchemaVersion,
  localProfileRecordSchema,
  profileBackupFileSchema,
  type LocalProfileRecord,
  type ProfileBackupFile,
} from "./schema";

export type RecordMigrationResult =
  | { ok: true; record: LocalProfileRecord; migrated: boolean }
  | {
      ok: false;
      error: "corrupted" | "unsupported_version";
      id: string | null;
    };
export type RecordUpgrade = (
  raw: Record<string, unknown>,
) => Record<string, unknown>;
const RECORD_UPGRADES: Readonly<Record<number, RecordUpgrade>> = {
  1: (raw) => ({
    ...raw,
    storageSchemaVersion: 2,
    history: [],
    exports: [],
  }),
};
function isObject(raw: unknown): raw is Record<string, unknown> {
  return Object.prototype.toString.call(raw) === "[object Object]";
}
function peekProfileSchemaVersion(value: unknown): string | null {
  return isObject(value) &&
    isObject(value.metadata) &&
    typeof value.metadata.schemaVersion === "string"
    ? value.metadata.schemaVersion
    : null;
}
function hasUnsupportedProfileVersion(value: unknown): boolean {
  const version = peekProfileSchemaVersion(value);
  return version !== null && !isSupportedProfileSchemaVersion(version);
}
export function migrateLocalProfileRecord(
  raw: unknown,
  upgrades: Readonly<Record<number, RecordUpgrade>> = RECORD_UPGRADES,
): RecordMigrationResult {
  const id = isObject(raw) && typeof raw.id === "string" ? raw.id : null;
  if (!isObject(raw)) return { ok: false, error: "corrupted", id };
  let candidate = raw;
  let version = candidate.storageSchemaVersion;
  if (
    typeof version === "number" &&
    version > LOCAL_PROFILE_STORAGE_SCHEMA_VERSION
  )
    return { ok: false, error: "unsupported_version", id };
  for (const snapshot of [
    raw.confirmed,
    raw.draft,
    ...(Array.isArray(raw.history) ? raw.history : []),
  ]) {
    if (isObject(snapshot) && hasUnsupportedProfileVersion(snapshot.profile))
      return { ok: false, error: "unsupported_version", id };
  }
  let migrated = false;
  while (
    typeof version === "number" &&
    version < LOCAL_PROFILE_STORAGE_SCHEMA_VERSION
  ) {
    const upgrade = upgrades[version];
    if (!upgrade) return { ok: false, error: "corrupted", id };
    try {
      const upgraded = upgrade(structuredClone(candidate));
      if (!isObject(upgraded)) return { ok: false, error: "corrupted", id };
      candidate = upgraded;
    } catch {
      return { ok: false, error: "corrupted", id };
    }
    const next = candidate.storageSchemaVersion;
    if (
      typeof next !== "number" ||
      next <= version ||
      next > LOCAL_PROFILE_STORAGE_SCHEMA_VERSION
    )
      return { ok: false, error: "corrupted", id };
    version = next;
    migrated = true;
  }
  const parsed = localProfileRecordSchema.safeParse(candidate);
  return parsed.success
    ? { ok: true, record: parsed.data, migrated }
    : { ok: false, error: "corrupted", id };
}

export type BackupMigrationError =
  | "not_object"
  | "unknown_format"
  | "unsupported_format_version"
  | "invalid_backup"
  | "unsupported_profile_schema";
export function migrateBackupFile(
  raw: unknown,
  now: string,
):
  | {
      ok: true;
      backup: ProfileBackupFile;
      source: "backup_v1" | "bare_profile";
    }
  | { ok: false; error: BackupMigrationError } {
  if (!isObject(raw)) return { ok: false, error: "not_object" };
  let backup: ProfileBackupFile;
  let source: "backup_v1" | "bare_profile";
  if (raw.format === PROFILE_BACKUP_FORMAT) {
    if (
      typeof raw.formatVersion === "number" &&
      raw.formatVersion > PROFILE_BACKUP_FORMAT_VERSION
    )
      return { ok: false, error: "unsupported_format_version" };
    if (hasUnsupportedProfileVersion(raw.profile))
      return { ok: false, error: "unsupported_profile_schema" };
    const parsed = profileBackupFileSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid_backup" };
    backup = parsed.data;
    source = "backup_v1";
  } else if (!("format" in raw)) {
    if (hasUnsupportedProfileVersion(raw))
      return { ok: false, error: "unsupported_profile_schema" };
    const profile = teacherContextProfileSchema.safeParse(raw);
    if (!profile.success) return { ok: false, error: "unknown_format" };
    const parsed = profileBackupFileSchema.safeParse({
      format: PROFILE_BACKUP_FORMAT,
      formatVersion: PROFILE_BACKUP_FORMAT_VERSION,
      exportedAt: now,
      kind: "confirmed",
      profile: profile.data,
      suggestedTags: [],
    });
    if (!parsed.success) return { ok: false, error: "invalid_backup" };
    backup = parsed.data;
    source = "bare_profile";
  } else return { ok: false, error: "unknown_format" };
  if (!isSupportedProfileSchemaVersion(backup.profile.metadata.schemaVersion))
    return { ok: false, error: "unsupported_profile_schema" };
  return { ok: true, backup, source };
}
