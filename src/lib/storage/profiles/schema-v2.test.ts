import { expect, expectTypeOf, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  PENDING_PRIVACY_REVIEW,
  UNVERIFIED_PRIVACY_REVIEW,
} from "@/types/profile";
import {
  LOCAL_PROFILE_SETTINGS_VERSION,
  LOCAL_PROFILE_STORAGE_SCHEMA_VERSION,
  MAX_PROFILE_EXPORTS,
  MAX_PROFILE_HISTORY,
  localProfileRecordSchema,
  localProfileSettingsSchema,
  type LocalProfileRecord,
  type ProfileExportFormat,
} from "./schema";

const now = "2026-10-30T12:00:00.000Z";
const before = "2026-10-29T12:00:00.000Z";
const earlier = "2026-10-28T12:00:00.000Z";
const profile = () => structuredClone(FICTIONAL_PROFILES[0]!);
const history = (confirmedAt = before, replacedAt = now) => ({
  profile: profile(),
  confirmedAt,
  replacedAt,
});
const record = (): LocalProfileRecord => ({
  id: "c1d9ab22-56cd-491b-9654-5bab1976ab91",
  storageSchemaVersion: 2,
  createdAt: earlier,
  updatedAt: now,
  revision: 2,
  origin: "interview",
  suggestedTags: [],
  confirmed: { profile: profile(), confirmedAt: now },
  draft: null,
  history: [history()],
  exports: [
    { target: "result", format: "core", confirmedAt: earlier, exportedAt: now },
  ],
});

it("keeps the settings format at v1 while records use v2", () => {
  expect(LOCAL_PROFILE_SETTINGS_VERSION).toBe(1);
  expect(LOCAL_PROFILE_STORAGE_SCHEMA_VERSION).toBe(2);
  const settings = { key: "settings", enabledAt: now, storageSchemaVersion: 1 };
  expect(localProfileSettingsSchema.parse(settings)).toEqual(settings);
  expect(
    localProfileSettingsSchema.safeParse({
      ...settings,
      storageSchemaVersion: 2,
    }).success,
  ).toBe(false);
  expect(
    localProfileRecordSchema.safeParse({ ...record(), storageSchemaVersion: 1 })
      .success,
  ).toBe(false);
  expectTypeOf<ProfileExportFormat>().toEqualTypeOf<
    "full" | "core" | "modules" | "skill-package"
  >();
});

it("accepts maximum history and exports with references to versions outside history", () => {
  const r = record();
  r.history = Array.from({ length: MAX_PROFILE_HISTORY }, (_, index) =>
    history(`2026-10-${String(29 - index)}T12:00:00.000Z`, now),
  );
  r.exports = Array.from({ length: MAX_PROFILE_EXPORTS }, (_, index) => ({
    target: `target-${index}`,
    format: (["full", "core", "modules", "skill-package"] as const)[index % 4]!,
    confirmedAt: "2026-10-01T12:00:00.000Z",
    exportedAt: now,
  }));
  expect(localProfileRecordSchema.parse(r)).toEqual(r);
});

it("accepts supported historical profile versions and completed review outcomes", () => {
  const r = record();
  for (const review of [
    profile().privacyReview,
    UNVERIFIED_PRIVACY_REVIEW,
    {
      status: "needs_review" as const,
      items: [{ text: "가상 원문", reason: "확인", suggestedRewrite: "수정" }],
    },
  ]) {
    r.history[0]!.profile.metadata.schemaVersion = "1.9.2";
    r.history[0]!.profile.privacyReview = structuredClone(review);
    expect(localProfileRecordSchema.safeParse(r).success).toBe(true);
  }
});

it("orders replacement times by instant, including equal times with different precision", () => {
  const r = record();
  r.history = [
    history(before, "2026-10-30T12:00:00.1Z"),
    history(earlier, "2026-10-30T12:00:00.01Z"),
  ];
  expect(localProfileRecordSchema.safeParse(r).success).toBe(true);
  r.history[1]!.replacedAt = "2026-10-30T12:00:00.100Z";
  expect(localProfileRecordSchema.safeParse(r).success).toBe(true);
  r.history[1]!.replacedAt = "2026-10-30T12:00:00.11Z";
  expect(localProfileRecordSchema.safeParse(r).success).toBe(false);
});

it("does not relate export references to the current snapshot or retained history", () => {
  const r = record();
  r.confirmed = null;
  r.history = [];
  const draft = profile();
  draft.privacyReview = structuredClone(PENDING_PRIVACY_REVIEW);
  r.draft = { profile: draft, baseConfirmedAt: null, updatedAt: now };
  expect(localProfileRecordSchema.safeParse(r).success).toBe(true);
});

const invalidRecords: {
  name: string;
  change: (r: LocalProfileRecord) => void;
  path: PropertyKey[];
}[] = [
  {
    name: "history without a current snapshot",
    change: (r) => {
      r.confirmed = null;
    },
    path: ["history"],
  },
  {
    name: "pending historical privacy review",
    change: (r) => {
      r.history[0]!.profile.privacyReview = structuredClone(
        PENDING_PRIVACY_REVIEW,
      );
    },
    path: ["history", 0, "profile", "privacyReview"],
  },
  {
    name: "unsupported historical profile version",
    change: (r) => {
      r.history[0]!.profile.metadata.schemaVersion = "2.0";
    },
    path: ["history", 0, "profile", "metadata", "schemaVersion"],
  },
  {
    name: "current and historical version identifier collision",
    change: (r) => {
      r.history[0]!.confirmedAt = now;
    },
    path: ["history", 0, "confirmedAt"],
  },
  {
    name: "duplicate historical version identifiers",
    change: (r) => {
      r.history.push(history());
    },
    path: ["history", 1, "confirmedAt"],
  },
  {
    name: "ascending replacement times",
    change: (r) => {
      r.history[0]!.replacedAt = before;
      r.history.push(history(earlier, now));
    },
    path: ["history", 1, "replacedAt"],
  },
  {
    name: "more than five historical snapshots",
    change: (r) => {
      r.history = Array.from({ length: MAX_PROFILE_HISTORY + 1 }, (_, index) =>
        history(`2026-10-${String(29 - index)}T12:00:00.000Z`),
      );
    },
    path: ["history"],
  },
  {
    name: "duplicate export targets",
    change: (r) => {
      r.exports.push({ ...r.exports[0]!, format: "full" });
    },
    path: ["exports", 1, "target"],
  },
  {
    name: "more than ten export targets",
    change: (r) => {
      r.exports = Array.from(
        { length: MAX_PROFILE_EXPORTS + 1 },
        (_, index) => ({ ...r.exports[0]!, target: `target-${index}` }),
      );
    },
    path: ["exports"],
  },
  {
    name: "unknown historical fields",
    change: (r) => {
      Object.assign(r.history[0]!, { extra: true });
    },
    path: ["history", 0],
  },
  {
    name: "unknown export fields",
    change: (r) => {
      Object.assign(r.exports[0]!, { content: "not allowed" });
    },
    path: ["exports", 0],
  },
  {
    name: "invalid historical date",
    change: (r) => {
      r.history[0]!.confirmedAt = "invalid";
    },
    path: ["history", 0, "confirmedAt"],
  },
  {
    name: "invalid export date",
    change: (r) => {
      r.exports[0]!.exportedAt = "invalid";
    },
    path: ["exports", 0, "exportedAt"],
  },
  {
    name: "unsupported export format",
    change: (r) => {
      Object.assign(r.exports[0]!, { format: "other" });
    },
    path: ["exports", 0, "format"],
  },
];

it.each(invalidRecords)("rejects $name", ({ change, path }) => {
  const r = record();
  change(r);
  const parsed = localProfileRecordSchema.safeParse(r);
  expect(parsed.success).toBe(false);
  if (parsed.success) throw new Error("Expected an invalid record");
  expect(parsed.error.issues.map((issue) => issue.path)).toContainEqual(path);
});

it.each([
  "",
  "Result",
  "-target",
  "target-",
  "target--id",
  "target_id",
  "target id",
  "target/id",
  "a".repeat(65),
])("rejects invalid export target %j", (target) => {
  const r = record();
  r.exports[0]!.target = target;
  expect(localProfileRecordSchema.safeParse(r).success).toBe(false);
});

it.each(["a", "target-2", "123", "a".repeat(64)])(
  "accepts opaque export target %j",
  (target) => {
    const r = record();
    r.exports[0]!.target = target;
    expect(localProfileRecordSchema.safeParse(r).success).toBe(true);
  },
);
