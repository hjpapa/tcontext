// @vitest-environment node
import { expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { PENDING_PRIVACY_REVIEW } from "@/types/profile";
import { migrateLocalProfileRecord } from "./migrate";

const now = "2026-10-30T12:00:00.000Z";
const before = "2026-10-29T12:00:00.000Z";
const profile = () => structuredClone(FICTIONAL_PROFILES[0]!);
const v1Record = () => ({
  id: "c1d9ab22-56cd-491b-9654-5bab1976ab91",
  storageSchemaVersion: 1,
  createdAt: before,
  updatedAt: now,
  revision: 4,
  origin: "interview",
  suggestedTags: [],
  confirmed: { profile: profile(), confirmedAt: now },
  draft: null,
});

it("upgrades v1 without history fields into v2 and preserves all original fields", () => {
  const raw = v1Record();
  const original = structuredClone(raw);
  const migrated = migrateLocalProfileRecord(raw);
  expect(migrated).toEqual({
    ok: true,
    migrated: true,
    record: { ...raw, storageSchemaVersion: 2, history: [], exports: [] },
  });
  expect(raw).toEqual(original);
  expect(Object.hasOwn(raw, "history")).toBe(false);
  if (!migrated.ok) throw new Error("Expected v1 migration to succeed");
  migrated.record.confirmed!.profile.profileTitle = "독립된 값";
  expect(raw).toEqual(original);
});

it("preserves imported draft-only v1 records during migration", () => {
  const draft = profile();
  draft.profileTitle = "";
  draft.privacyReview = structuredClone(PENDING_PRIVACY_REVIEW);
  const raw = {
    ...v1Record(),
    origin: "import",
    confirmed: null,
    draft: { profile: draft, baseConfirmedAt: null, updatedAt: now },
  };
  const original = structuredClone(raw);
  expect(migrateLocalProfileRecord(raw)).toEqual({
    ok: true,
    migrated: true,
    record: { ...raw, storageSchemaVersion: 2, history: [], exports: [] },
  });
  expect(raw).toEqual(original);
});

it("preserves current history and export fields without migration", () => {
  const raw = {
    ...v1Record(),
    storageSchemaVersion: 2,
    history: [{ profile: profile(), confirmedAt: before, replacedAt: now }],
    exports: [
      {
        target: "result",
        format: "core",
        confirmedAt: before,
        exportedAt: now,
      },
    ],
  };
  const original = structuredClone(raw);
  expect(migrateLocalProfileRecord(raw)).toEqual({
    ok: true,
    record: raw,
    migrated: false,
  });
  expect(raw).toEqual(original);
});

it("detects unsupported historical profile versions before validating changed shapes", () => {
  const raw = {
    ...v1Record(),
    storageSchemaVersion: 2,
    history: [
      { profile: { metadata: { schemaVersion: "2.0" }, changed: true } },
    ],
    exports: [],
  };
  expect(migrateLocalProfileRecord(raw)).toEqual({
    ok: false,
    error: "unsupported_version",
    id: raw.id,
  });
});

it.each([null, {}, [{ profile: {} }]])(
  "retains corrupted classification for malformed v2 history %j",
  (history) => {
    const raw = {
      ...v1Record(),
      storageSchemaVersion: 2,
      history,
      exports: [],
    };
    expect(migrateLocalProfileRecord(raw)).toEqual({
      ok: false,
      error: "corrupted",
      id: raw.id,
    });
  },
);

it("still rejects malformed v1 records after adding version fields", () => {
  const raw = { ...v1Record(), revision: 0 };
  expect(migrateLocalProfileRecord(raw)).toEqual({
    ok: false,
    error: "corrupted",
    id: raw.id,
  });
});
