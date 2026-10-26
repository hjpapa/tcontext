// @vitest-environment node
import { expect, it, vi } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { PENDING_PRIVACY_REVIEW } from "@/types/profile";
import {
  BACKUP_IMPORT_ERROR_MESSAGES,
  createProfileBackupFile,
  MAX_BACKUP_FILE_BYTES,
  parseProfileBackupFile,
} from "./backup";
const now = "2026-10-25T00:00:00.000Z";
function backup() {
  const result = createProfileBackupFile({
    kind: "confirmed",
    profile: structuredClone(FICTIONAL_PROFILES[0]!),
    suggestedTags: [],
    now,
  });
  if (!result.ok) throw new Error("Invalid fixture");
  return result.value;
}
function file(content: string) {
  return {
    name: "profile.JSON",
    size: Buffer.byteLength(content),
    text: async () => content,
  };
}
it("round trips canonical content while invalidating imported privacy review", async () => {
  const exported = backup();
  expect(exported.path).toBe(
    "tcontext-teacher-profile-kindergarten-20261025.json",
  );
  expect(exported.content.startsWith("\uFEFF")).toBe(false);
  expect(exported.content.endsWith("\n")).toBe(true);
  const parsed = await parseProfileBackupFile(
    file("\uFEFF" + exported.content),
    now,
  );
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.value.profile).toStrictEqual({
      ...structuredClone(FICTIONAL_PROFILES[0]!),
      privacyReview: PENDING_PRIVACY_REVIEW,
    });
    expect(parsed.value).toMatchObject({
      kind: "confirmed",
      source: "backup_v1",
      unconfirmedCount: 0,
    });
    expect(parsed.value.modules).toHaveLength(7);
    parsed.value.profile.privacyReview.items[0]!.text = "changed";
    expect(PENDING_PRIVACY_REVIEW.items[0]!.text).not.toBe("changed");
  }
});
it("checks size and extension before reading and handles read failures", async () => {
  const text = vi.fn(async () => backup().content);
  expect(
    await parseProfileBackupFile(
      { name: "profile.json", size: MAX_BACKUP_FILE_BYTES + 1, text },
      now,
    ),
  ).toEqual({ ok: false, error: "too_large" });
  expect(
    await parseProfileBackupFile({ name: "profile.txt", size: 10, text }, now),
  ).toEqual({ ok: false, error: "wrong_extension" });
  expect(text).not.toHaveBeenCalled();
  expect(
    await parseProfileBackupFile(
      {
        name: "profile.json",
        size: 10,
        text: async () => {
          throw new Error("read");
        },
      },
      now,
    ),
  ).toEqual({ ok: false, error: "read_failed" });
});
it("reports distinct actionable errors for malformed or unsupported backups", async () => {
  const original = JSON.parse(backup().content);
  const cases = [
    ["{", "invalid_json"],
    ["[]", "not_object"],
    [JSON.stringify({ ...original, format: "other" }), "unknown_format"],
    [
      JSON.stringify({ ...original, formatVersion: 2 }),
      "unsupported_format_version",
    ],
    [JSON.stringify({ ...original, extra: true }), "invalid_backup"],
    [
      JSON.stringify({
        ...original,
        profile: { metadata: { schemaVersion: "2.0" } },
      }),
      "unsupported_profile_schema",
    ],
    [original.content ?? '{"__proto__": {"polluted": true}}', "unknown_format"],
  ];
  for (const [content, error] of cases)
    expect(await parseProfileBackupFile(file(content!), now)).toEqual({
      ok: false,
      error,
    });
  expect(new Set(Object.values(BACKUP_IMPORT_ERROR_MESSAGES)).size).toBe(
    Object.keys(BACKUP_IMPORT_ERROR_MESSAGES).length,
  );
  for (const message of Object.values(BACKUP_IMPORT_ERROR_MESSAGES))
    expect(message).toContain("주세요");
});
it("supports bare and blank draft profiles and refuses invalid exports", async () => {
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  expect(
    await parseProfileBackupFile(file(JSON.stringify(profile)), now),
  ).toMatchObject({ ok: true, value: { source: "bare_profile" } });
  profile.profileTitle = "";
  const result = createProfileBackupFile({
    kind: "draft",
    profile,
    suggestedTags: [],
    now,
  });
  expect(result.ok).toBe(true);
  if (result.ok)
    expect(
      await parseProfileBackupFile(file(result.value.content), now),
    ).toMatchObject({ ok: true, value: { title: "", kind: "draft" } });
  expect(
    createProfileBackupFile({
      kind: "confirmed",
      profile,
      suggestedTags: [],
      now,
    }),
  ).toEqual({ ok: false, error: "invalid_backup" });
});
