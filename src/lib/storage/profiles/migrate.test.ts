// @vitest-environment node
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  migrateBackupFile,
  migrateLocalProfileRecord,
  type RecordUpgrade,
} from "./migrate";
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
    storageSchemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    origin: "interview",
    suggestedTags: [],
    confirmed: { profile: profile(), confirmedAt: now },
    draft: null,
    history: [],
    exports: [],
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
  expect(migrateLocalProfileRecord({ id, storageSchemaVersion: 3 })).toEqual({
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

function validRecord() {
  return {
    id,
    storageSchemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    origin: "interview",
    suggestedTags: [],
    confirmed: { profile: profile(), confirmedAt: now },
    draft: null,
    history: [],
    exports: [],
  };
}
it("accepts ordinary cross-realm records and backups", () => {
  const foreign = (value: unknown) =>
    runInNewContext(`JSON.parse(input)`, { input: JSON.stringify(value) });
  expect(migrateLocalProfileRecord(foreign(validRecord())).ok).toBe(true);
  expect(migrateBackupFile(foreign(backup()), now)).toMatchObject({
    ok: true,
    source: "backup_v1",
  });
  for (const raw of [
    new Map(),
    new Date(),
    [],
    runInNewContext("new Map()"),
    runInNewContext("new Date()"),
    runInNewContext("[]"),
  ]) {
    expect(migrateLocalProfileRecord(raw)).toEqual({
      ok: false,
      error: "corrupted",
      id: null,
    });
    expect(migrateBackupFile(raw, now)).toEqual({
      ok: false,
      error: "not_object",
    });
  }
});
it("detects future profile versions before validating their changed shape", () => {
  const future = { metadata: { schemaVersion: "2.0" }, changed: true };
  for (const raw of [future, { ...backup(), profile: future }])
    expect(migrateBackupFile(raw, now)).toEqual({
      ok: false,
      error: "unsupported_profile_schema",
    });
  for (const key of ["confirmed", "draft"])
    expect(
      migrateLocalProfileRecord({
        ...validRecord(),
        [key]: { profile: future },
      }),
    ).toEqual({ ok: false, error: "unsupported_version", id });
  expect(migrateBackupFile({ ...backup(), profile: {} }, now)).toEqual({
    ok: false,
    error: "invalid_backup",
  });
  expect(migrateBackupFile({}, now)).toEqual({
    ok: false,
    error: "unknown_format",
  });
  expect(
    migrateBackupFile({ ...backup(), formatVersion: 2, profile: future }, now),
  ).toEqual({ ok: false, error: "unsupported_format_version" });
});
it("isolates mutable upgrades and rejects failed or invalid upgrades", () => {
  const raw = { ...validRecord(), storageSchemaVersion: 0 };
  const before = structuredClone(raw);
  const result = migrateLocalProfileRecord(raw, {
    0: (candidate) => {
      candidate.storageSchemaVersion = 1;
      (
        candidate.confirmed as { profile: { profileTitle: string } }
      ).profile.profileTitle = "수정";
      return candidate;
    },
    1: (candidate) => ({ ...candidate, storageSchemaVersion: 2 }),
  });
  expect(result).toMatchObject({
    ok: true,
    migrated: true,
    record: {
      storageSchemaVersion: 2,
      confirmed: { profile: { profileTitle: "수정" } },
    },
  });
  expect(raw).toStrictEqual(before);
  const upgrades: RecordUpgrade[] = [
    () => {
      throw new Error("failure");
    },
    (candidate) => candidate,
    (candidate) => ({ ...candidate, storageSchemaVersion: 3 }),
    (() => null) as unknown as RecordUpgrade,
    (() => []) as unknown as RecordUpgrade,
  ];
  for (const upgrade of upgrades)
    expect(migrateLocalProfileRecord(raw, { 0: upgrade })).toEqual({
      ok: false,
      error: "corrupted",
      id,
    });
  expect(raw).toStrictEqual(before);
});
