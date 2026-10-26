// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import * as repository from "@/lib/storage/profiles/repository";
import { toConfirmedSnapshot } from "@/lib/storage/profiles/serialize";
import { PENDING_PRIVACY_REVIEW } from "@/types/profile";
import { useLocalDraftAutosave } from "./use-local-draft-autosave";
const now = "2026-10-25T00:00:00.000Z";
function fixture(linked = true) {
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  const snapshot = toConfirmedSnapshot(profile, now);
  if (!snapshot.ok) throw new Error("fixture");
  vi.spyOn(repository, "getLocalProfile").mockResolvedValue({
    ok: true,
    value: {
      id: "c1d9ab22-56cd-491b-9654-5bab1976ab91",
      revision: 1,
      storageSchemaVersion: 1,
      origin: "interview",
      createdAt: now,
      updatedAt: now,
      suggestedTags: [],
      confirmed: snapshot.snapshot,
      draft: null,
    },
  });
  const draft = vi
    .spyOn(repository, "saveDraft")
    .mockResolvedValue({ ok: true, value: { revision: 2, savedAt: now } });
  const confirmed = vi
    .spyOn(repository, "saveConfirmed")
    .mockResolvedValue({ ok: true, value: { revision: 3, savedAt: now } });
  const setStatus = vi.fn();
  const props = {
    profile,
    selectedTags: new Set<string>(),
    suggestedTags: [],
    link: linked
      ? {
          recordId: "c1d9ab22-56cd-491b-9654-5bab1976ab91",
          revision: 1,
          baseline: profile,
          openedAt: 1,
        }
      : null,
    options: {},
    setLink: vi.fn(),
    setStatus,
  };
  const hook = renderHook((input) => useLocalDraftAutosave(input), {
    initialProps: props,
  });
  return { ...hook, props, draft, confirmed, setStatus };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("skips opening and debounces profile and tag edits into one pending-only draft", async () => {
  const f = fixture();
  await act(() => vi.advanceTimersByTimeAsync(900));
  expect(f.draft).not.toHaveBeenCalled();
  f.rerender({
    ...f.props,
    profile: { ...f.props.profile, profileTitle: "첫 수정" },
  });
  f.rerender({
    ...f.props,
    profile: { ...f.props.profile, profileTitle: "마지막 수정" },
    selectedTags: new Set(["preferredTeachingMethods:inquiry"]),
  });
  await act(() => vi.advanceTimersByTimeAsync(800));
  expect(f.draft).toHaveBeenCalledTimes(1);
  expect(f.draft.mock.calls[0]![1]).toMatchObject({
    expectedRevision: 1,
    draft: {
      baseConfirmedAt: now,
      profile: {
        profileTitle: "마지막 수정",
        privacyReview: PENDING_PRIVACY_REVIEW,
      },
    },
  });
});
it("does not write without a local link", async () => {
  const f = fixture(false);
  f.rerender({
    ...f.props,
    profile: { ...f.props.profile, profileTitle: "수정" },
  });
  await act(() => vi.advanceTimersByTimeAsync(900));
  await act(() => f.result.current.finalize(f.props.profile, []));
  expect(f.draft).not.toHaveBeenCalled();
  expect(f.confirmed).not.toHaveBeenCalled();
});
it("saves module rewrite results and flushes on pagehide", async () => {
  const f = fixture();
  const profile = structuredClone(f.props.profile);
  profile.modules[0]!.claims[0]!.text = "재작성된 수업 지원";
  f.rerender({ ...f.props, profile });
  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
    await f.result.current.flush();
  });
  expect(f.draft).toHaveBeenCalledTimes(1);
  expect(
    f.draft.mock.calls[0]![1].draft.profile.modules[0]!.claims[0]!.text,
  ).toBe("재작성된 수업 지원");
});
it("cancels pending drafts and never recreates one after finalization", async () => {
  const f = fixture();
  const profile = { ...f.props.profile, profileTitle: "최종" };
  f.rerender({ ...f.props, profile });
  await act(() => f.result.current.finalize(profile, []));
  f.rerender({ ...f.props, profile: structuredClone(profile) });
  await act(() => vi.advanceTimersByTimeAsync(900));
  expect(f.draft).not.toHaveBeenCalled();
  expect(f.confirmed).toHaveBeenCalledTimes(1);
  expect(f.confirmed.mock.calls[0]![1].expectedRevision).toBe(1);
});
it("serializes a final write behind an in-flight draft using its new revision", async () => {
  const f = fixture();
  let finish!: (
    result: Awaited<ReturnType<typeof repository.saveDraft>>,
  ) => void;
  f.draft.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  f.rerender({
    ...f.props,
    profile: { ...f.props.profile, profileTitle: "초안" },
  });
  await act(() => vi.advanceTimersByTimeAsync(800));
  expect(f.draft).toHaveBeenCalledTimes(1);
  const final = f.result.current.finalize(f.props.profile, []);
  expect(f.confirmed).not.toHaveBeenCalled();
  await act(async () => {
    finish({ ok: true, value: { revision: 2, savedAt: now } });
    await final;
  });
  expect(f.confirmed.mock.calls[0]![1].expectedRevision).toBe(2);
});
it("reports failed final writes without throwing", async () => {
  const f = fixture();
  f.confirmed.mockResolvedValue({ ok: false, error: "quota_exceeded" });
  await act(() => f.result.current.finalize(f.props.profile, []));
  expect(f.setStatus).toHaveBeenLastCalledWith(
    expect.objectContaining({
      phase: "error",
      kind: "confirmed",
      error: "quota_exceeded",
    }),
  );
});
