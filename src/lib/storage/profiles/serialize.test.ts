import { expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  PENDING_PRIVACY_REVIEW,
  UNVERIFIED_PRIVACY_REVIEW,
} from "@/types/profile";
import { selectedTagKeysFromConfirmedTags } from "@/lib/profile/tags";
import {
  toConfirmedSnapshot,
  toDraftSnapshot,
  toEditableSession,
} from "./serialize";
import type { LocalProfileRecord } from "./schema";
const now = "2026-10-25T00:00:00.000Z";
const profile = () => structuredClone(FICTIONAL_PROFILES[0]!);
it("trims confirmed profiles, preserves reviews and rejects pending/invalid input", () => {
  for (const review of [
    profile().privacyReview,
    UNVERIFIED_PRIVACY_REVIEW,
    {
      status: "needs_review" as const,
      items: [{ text: "가상 경고", reason: "확인", suggestedRewrite: "수정" }],
    },
  ]) {
    const p = profile();
    p.privacyReview = review;
    p.profileTitle = " 제목 ";
    const result = toConfirmedSnapshot(p, now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.profile.profileTitle).toBe("제목");
      expect(result.snapshot.profile.privacyReview).toEqual(review);
    }
  }
  const p = profile();
  p.privacyReview = PENDING_PRIVACY_REVIEW;
  expect(toConfirmedSnapshot(p, now)).toEqual({
    ok: false,
    error: "not_finalized",
  });
  p.profileTitle = "";
  expect(toConfirmedSnapshot(p, now).ok).toBe(false);
  expect(toConfirmedSnapshot(profile(), "invalid").ok).toBe(false);
});
it("allowlists nested fields and removes old privacy excerpts from drafts", () => {
  const p = profile();
  const forbidden = [
    "answers",
    "privacyReviewToken",
    "contributionReceipt",
    "refineInstructions",
    "synthesisConfirmed",
    "privacyWarningAccepted",
  ];
  for (const key of forbidden)
    for (const obj of [
      p,
      p.metadata,
      p.modules[0]!,
      p.modules[0]!.claims[0]!,
      p.confirmedTags,
      p.privacyReview,
    ])
      Object.assign(obj, { [key]: `secret-${key}` });
  p.privacyReview = {
    status: "needs_review",
    items: [
      { text: "가상 이름 원문 사본", reason: "확인", suggestedRewrite: "수정" },
    ],
  };
  const confirmed = toConfirmedSnapshot(p, now);
  const draft = toDraftSnapshot({
    profile: p,
    suggestedTags: [],
    selectedTagKeys: [],
    baseConfirmedAt: null,
    now,
  });
  expect(confirmed.ok).toBe(true);
  expect(draft.ok).toBe(true);
  for (const result of [confirmed, draft])
    for (const key of forbidden)
      expect(JSON.stringify(result)).not.toContain(key);
  expect(JSON.stringify(draft)).not.toContain("가상 이름 원문 사본");
  if (draft.ok) {
    expect(draft.snapshot.profile.privacyReview).toEqual(
      PENDING_PRIVACY_REVIEW,
    );
    draft.snapshot.profile.privacyReview.items[0]!.text = "변경";
    expect(PENDING_PRIVACY_REVIEW.items[0]!.text).not.toBe("변경");
  }
});
it("preserves selected existing tags and blank draft text", () => {
  const p = profile();
  p.profileTitle = "  ";
  const selected = selectedTagKeysFromConfirmedTags(p.confirmedTags);
  selected.add("preferredTeachingMethods:making");
  const result = toDraftSnapshot({
    profile: p,
    suggestedTags: [{ category: "preferredTeachingMethods", tag: "making" }],
    selectedTagKeys: selected,
    baseConfirmedAt: now,
    now,
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.snapshot.profile.profileTitle).toBe("  ");
    expect(
      result.snapshot.profile.confirmedTags.preferredTeachingMethods,
    ).toContain("making");
    for (const key of selectedTagKeysFromConfirmedTags(p.confirmedTags))
      expect(
        selectedTagKeysFromConfirmedTags(
          result.snapshot.profile.confirmedTags,
        ).has(key),
      ).toBe(true);
  }
  p.profileTitle = "x".repeat(20001);
  expect(
    toDraftSnapshot({
      profile: p,
      suggestedTags: [],
      selectedTagKeys: [],
      baseConfirmedAt: null,
      now,
    }),
  ).toEqual({ ok: false, error: "invalid_draft" });
});
it("opens draft first with an independent baseline and independent nested values", () => {
  const r: LocalProfileRecord = {
    id: "c1d9ab22-56cd-491b-9654-5bab1976ab91",
    storageSchemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    revision: 2,
    origin: "interview",
    suggestedTags: [{ category: "preferredTeachingMethods", tag: "making" }],
    confirmed: { profile: profile(), confirmedAt: now },
    draft: { profile: profile(), baseConfirmedAt: now, updatedAt: now },
  };
  r.draft!.profile.profileTitle = "초안";
  const before = structuredClone(r);
  const session = toEditableSession(r);
  expect(session.source).toBe("draft");
  expect(session.profile.profileTitle).toBe("초안");
  expect(session.baseline).toEqual(r.confirmed!.profile);
  expect(session.suggestedTags.length).toBeGreaterThan(1);
  session.profile.modules[0]!.claims[0]!.evidenceQuestionIds.push("changed");
  session.baseline!.privacyReview.items.push({
    text: "변경",
    reason: "변경",
    suggestedRewrite: "변경",
  });
  session.suggestedTags[0]!.tag = "inquiry";
  expect(r).toEqual(before);
  r.draft = null;
  const confirmed = toEditableSession(r);
  expect(confirmed.source).toBe("confirmed");
  expect(confirmed.profile).not.toBe(confirmed.baseline);
  r.draft = before.draft;
  r.confirmed = null;
  expect(toEditableSession(r).baseline).toBeNull();
});
