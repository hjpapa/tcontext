import { expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { migrateBackupFile, migrateLocalProfileRecord } from "./migrate";
import { PROFILE_BACKUP_FORMAT } from "./schema";
const now = "2026-10-25T00:00:00.000Z";
const id = "c1d9ab22-56cd-491b-9654-5bab1976ab91";
const profile = () => structuredClone(FICTIONAL_PROFILES[0]!);
const backup = () => ({
  format: PROFILE_BACKUP_FORMAT,
  formatVersion: 1,
  exportedAt: now,
  kind: "confirmed",
  profile: profile(),
  suggestedTags: [],
});
it("validates v1 without migration and preserves raw input", () => {
  const raw = {
    id,
    storageSchemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    origin: "interview",
    suggestedTags: [],
    confirmed: { profile: profile(), confirmedAt: now },
    draft: null,
  };
  const before = structuredClone(raw);
  expect(migrateLocalProfileRecord(raw)).toEqual({
    ok: true,
    record: raw,
    migrated: false,
  });
  expect(raw).toEqual(before);
});
it("distinguishes future and corrupt records and retains ids", () => {
  expect(migrateLocalProfileRecord({ id, storageSchemaVersion: 2 })).toEqual({
    ok: false,
    error: "unsupported_version",
    id,
  });
  expect(migrateLocalProfileRecord({ id })).toEqual({
    ok: false,
    error: "corrupted",
    id,
  });
  for (const raw of [{}, { storageSchemaVersion: 0 }, null, [], "text"])
    expect(migrateLocalProfileRecord(raw)).toEqual({
      ok: false,
      error: "corrupted",
      id: null,
    });
});
it("imports wrapped and bare profiles", () => {
  expect(migrateBackupFile(backup(), now)).toEqual({
    ok: true,
    backup: backup(),
    source: "backup_v1",
  });
  expect(migrateBackupFile(profile(), now)).toEqual({
    ok: true,
    backup: backup(),
    source: "bare_profile",
  });
});
it("classifies backup errors in priority order", () => {
  for (const raw of [null, [], "text", new Date()])
    expect(migrateBackupFile(raw, now)).toEqual({
      ok: false,
      error: "not_object",
    });
  expect(migrateBackupFile({ ...backup(), formatVersion: 2 }, now)).toEqual({
    ok: false,
    error: "unsupported_format_version",
  });
  expect(migrateBackupFile({ ...backup(), format: "other" }, now)).toEqual({
    ok: false,
    error: "unknown_format",
  });
  expect(migrateBackupFile({ ...backup(), extra: true }, now)).toEqual({
    ok: false,
    error: "invalid_backup",
  });
  const b = backup();
  b.profile.metadata.schemaVersion = "2.0";
  for (const raw of [b, b.profile])
    expect(migrateBackupFile(raw, now)).toEqual({
      ok: false,
      error: "unsupported_profile_schema",
    });
});
