import { expect, expectTypeOf, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  PENDING_PRIVACY_REVIEW,
  UNVERIFIED_PRIVACY_REVIEW,
  type TeacherContextProfile,
} from "@/types/profile";
import {
  localDraftProfileSchema,
  localProfileRecordSchema,
  profileBackupFileSchema,
  PROFILE_BACKUP_FORMAT,
  MAX_SUGGESTED_TAGS,
  type LocalDraftProfile,
} from "./schema";
const now = "2026-10-25T00:00:00.000Z";
const profile = () => structuredClone(FICTIONAL_PROFILES[0]!);
const record = () => ({
  id: "c1d9ab22-56cd-491b-9654-5bab1976ab91",
  storageSchemaVersion: 1,
  createdAt: now,
  updatedAt: now,
  revision: 1,
  origin: "interview",
  suggestedTags: [],
  confirmed: { profile: profile(), confirmedAt: now },
  draft: null,
});
it("accepts all examples, legacy metadata and review outcomes", () => {
  for (const p of FICTIONAL_PROFILES)
    expect(
      localProfileRecordSchema.safeParse({
        ...record(),
        confirmed: { profile: p, confirmedAt: now },
      }).success,
    ).toBe(true);
  const r = record();
  delete r.confirmed.profile.metadata.teachingSubject;
  for (const review of [
    UNVERIFIED_PRIVACY_REVIEW,
    {
      status: "needs_review" as const,
      items: [{ text: "가상 원문", reason: "확인", suggestedRewrite: "수정" }],
    },
  ]) {
    r.confirmed.profile.privacyReview = review;
    expect(localProfileRecordSchema.safeParse(r).success).toBe(true);
  }
  expect(MAX_SUGGESTED_TAGS).toBe(41);
  expectTypeOf<LocalDraftProfile>().toEqualTypeOf<TeacherContextProfile>();
});
it("preserves blank draft text everywhere", () => {
  const p = profile();
  p.profileTitle = "";
  p.shortSummary = "  ";
  for (const m of p.modules) {
    m.title = "";
    m.summary = " ";
    for (const c of m.claims) c.text = "";
  }
  p.teachingDesignPrinciples = [""];
  p.classSupportConsiderations = [" "];
  p.realisticConstraints = [""];
  p.aiCollaborationInstructions = [""];
  expect(localDraftProfileSchema.parse(p)).toEqual(p);
});
it.each([
  "missing",
  "duplicate module",
  "duplicate claim",
  "unknown",
  "confirmation",
  "evidence",
  "length",
  "tags",
  "privacy",
])("rejects invalid draft: %s", (kind) => {
  const p = profile();
  if (kind === "missing") p.modules.pop();
  if (kind === "duplicate module") p.modules[1]!.id = p.modules[0]!.id;
  if (kind === "duplicate claim")
    p.modules[1]!.claims[0]!.id = p.modules[0]!.claims[0]!.id;
  if (kind === "unknown") Object.assign(p.modules[0]!, { extra: true });
  if (kind === "confirmation")
    p.modules[0]!.claims[0]!.basis = "needs_confirmation";
  if (kind === "evidence") p.modules[0]!.claims[0]!.evidenceQuestionIds = [];
  if (kind === "length") p.profileTitle = "x".repeat(20001);
  if (kind === "tags")
    p.confirmedTags.aiBoundaries = ["no_personal_data", "no_personal_data"];
  if (kind === "privacy")
    p.privacyReview = { status: "needs_review", items: [] };
  const expectedPaths: Record<string, PropertyKey[]> = {
    missing: ["modules"],
    "duplicate module": ["modules"],
    "duplicate claim": ["modules"],
    unknown: ["modules", 0],
    confirmation: ["modules", 0, "claims", 0, "confirmedByUser"],
    evidence: ["modules", 0, "claims", 0, "evidenceQuestionIds"],
    length: ["profileTitle"],
    tags: ["confirmedTags", "aiBoundaries"],
    privacy: ["privacyReview", "items"],
  };
  expectIssue(localDraftProfileSchema.safeParse(p), expectedPaths[kind]!);
});
it.each([
  "empty",
  "pending confirmed",
  "reviewed draft",
  "tags",
  "version",
  "draft version",
  "uuid",
])("rejects invalid record: %s", (kind) => {
  const r: Record<string, unknown> = record();
  if (kind === "empty") r.confirmed = null;
  if (kind === "pending confirmed")
    (
      r.confirmed as ReturnType<typeof record>["confirmed"]
    ).profile.privacyReview = PENDING_PRIVACY_REVIEW;
  if (kind === "reviewed draft")
    r.draft = { profile: profile(), baseConfirmedAt: null, updatedAt: now };
  if (kind === "tags")
    r.suggestedTags = Array(2).fill({
      category: "aiBoundaries",
      tag: "no_personal_data",
    });
  if (kind === "version")
    (
      r.confirmed as ReturnType<typeof record>["confirmed"]
    ).profile.metadata.schemaVersion = "2.0";
  if (kind === "draft version") {
    const p = profile();
    p.metadata.schemaVersion = "2.0";
    p.privacyReview = PENDING_PRIVACY_REVIEW;
    r.draft = { profile: p, baseConfirmedAt: null, updatedAt: now };
  }
  if (kind === "uuid") r.id = "bad";
  const expectedPaths: Record<string, PropertyKey[]> = {
    empty: [],
    "pending confirmed": ["confirmed", "profile", "privacyReview"],
    "reviewed draft": ["draft", "profile", "privacyReview"],
    tags: ["suggestedTags"],
    version: ["confirmed", "profile", "metadata", "schemaVersion"],
    "draft version": ["draft", "profile", "metadata", "schemaVersion"],
    uuid: ["id"],
  };
  expectIssue(localProfileRecordSchema.safeParse(r), expectedPaths[kind]!);
});
it("accepts pending drafts and both strict backup kinds", () => {
  const p = profile();
  p.privacyReview = PENDING_PRIVACY_REVIEW;
  expect(
    localProfileRecordSchema.safeParse({
      ...record(),
      draft: { profile: p, baseConfirmedAt: null, updatedAt: now },
    }).success,
  ).toBe(true);
  for (const kind of ["confirmed", "draft"]) {
    const backup = {
      format: PROFILE_BACKUP_FORMAT,
      formatVersion: 1,
      exportedAt: now,
      kind,
      profile: profile(),
      suggestedTags: [],
    };
    expect(profileBackupFileSchema.safeParse(backup).success).toBe(true);
    expect(
      profileBackupFileSchema.safeParse({ ...backup, extra: true }).success,
    ).toBe(false);
  }
});

function expectIssue(
  result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } },
  path: PropertyKey[],
) {
  expect(result.success).toBe(false);
  expect(
    result.error?.issues.some((issue) =>
      path.every((part, index) => issue.path[index] === part),
    ),
  ).toBe(true);
}
it("accepts imported draft-only records and blank draft backups", () => {
  const p = profile();
  p.privacyReview = structuredClone(PENDING_PRIVACY_REVIEW);
  p.profileTitle = "";
  p.modules[0]!.claims[0]!.text = "";
  expect(
    localProfileRecordSchema.safeParse({
      ...record(),
      origin: "import",
      confirmed: null,
      draft: { profile: p, baseConfirmedAt: null, updatedAt: now },
    }).success,
  ).toBe(true);
  expect(
    profileBackupFileSchema.safeParse({
      format: PROFILE_BACKUP_FORMAT,
      formatVersion: 1,
      exportedAt: now,
      kind: "draft",
      profile: p,
      suggestedTags: [],
    }).success,
  ).toBe(true);
});
it("rejects unknown record fields, zero revisions, offset times and invalid backup ids", () => {
  expectIssue(
    localProfileRecordSchema.safeParse({ ...record(), extra: true }),
    [],
  );
  expectIssue(
    localProfileRecordSchema.safeParse({ ...record(), revision: 0 }),
    ["revision"],
  );
  expectIssue(
    localProfileRecordSchema.safeParse({
      ...record(),
      updatedAt: "2026-10-25T09:00:00+09:00",
    }),
    ["updatedAt"],
  );
  expectIssue(
    profileBackupFileSchema.safeParse({
      format: PROFILE_BACKUP_FORMAT,
      formatVersion: 1,
      exportedAt: now,
      kind: "confirmed",
      profile: profile(),
      suggestedTags: [],
      recordId: "invalid",
    }),
    ["recordId"],
  );
});
