// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import {
  LocalProfilesProvider,
  useLocalProfiles,
} from "@/components/local-profiles/local-profiles-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import * as repository from "@/lib/storage/profiles/repository";
import { toDraftSnapshot } from "@/lib/storage/profiles/serialize";
import { CONTROLLED_TAGS } from "@/types/profile";
import { useRecordExport } from "./use-record-export";

const id = "c1d9ab22-56cd-491b-9654-5bab1976ab91";
const confirmedAt = "2026-10-25T00:00:00.000Z";
const newerAt = "2026-10-28T00:00:00.000Z";
function profile() {
  return structuredClone(FICTIONAL_PROFILES[0]!);
}
async function fixture() {
  const factory = new IDBFactory();
  const options = {
    factory,
    notify: () => {},
    randomId: () => id,
    now: () => confirmedAt,
  };
  expect((await repository.enableLocalProfiles(options)).ok).toBe(true);
  expect(
    (
      await repository.createLocalProfile(
        {
          origin: "interview",
          confirmed: { profile: profile(), confirmedAt },
          suggestedTags: [],
        },
        options,
      )
    ).ok,
  ).toBe(true);
  return { factory, options };
}
function mount(factory: IDBFactory) {
  return renderHook(
    () => ({
      session: useInterviewSession(),
      local: useLocalProfiles(),
      record: useRecordExport(),
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <InterviewSessionProvider>
          <LocalProfilesProvider factory={factory}>
            {children}
          </LocalProfilesProvider>
        </InterviewSessionProvider>
      ),
    },
  );
}
function link() {
  return { recordId: id, revision: 1, baseline: null, openedAt: 1 };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

it("records the current stored timestamp for matching content and refreshes the same provider", async () => {
  const { factory, options } = await fixture();
  const write = vi.spyOn(repository, "recordExport");
  const { result } = mount(factory);
  await waitFor(() =>
    expect(result.current.local.availability).toBe("enabled"),
  );
  const exported = profile();
  exported.confirmedTags.aiBoundaries = exported.confirmedTags.aiBoundaries
    .length
    ? []
    : [CONTROLLED_TAGS.aiBoundaries[0]];
  act(() => {
    result.current.session.setProfile(exported);
    result.current.session.setLocalProfileLink(link());
  });
  expect(result.current.record("lesson-tool", "core")).toBeUndefined();
  await waitFor(() =>
    expect(write).toHaveBeenCalledWith(
      id,
      {
        target: "lesson-tool",
        format: "core",
        confirmedAt,
      },
      { factory },
    ),
  );
  await waitFor(() =>
    expect(result.current.local.items[0]).toMatchObject({
      lastExport: { target: "lesson-tool", format: "core" },
    }),
  );
  const stored = await repository.getLocalProfile(id, options);
  expect(stored).toMatchObject({
    ok: true,
    value: { revision: 1, updatedAt: confirmedAt },
  });
});

it("does not read or create storage while disabled even for a linked session", async () => {
  const factory = new IDBFactory();
  const read = vi.spyOn(repository, "getLocalProfile");
  const write = vi.spyOn(repository, "recordExport");
  const { result } = mount(factory);
  await waitFor(() =>
    expect(result.current.local.availability).toBe("disabled"),
  );
  act(() => {
    result.current.session.setProfile(profile());
    result.current.session.setLocalProfileLink(link());
    result.current.record("lesson-tool", "full");
  });
  result.current.record("lesson-tool", "full");
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(await factory.databases()).toEqual([]);
});

it("does not read storage without both the profile and its local link", async () => {
  const { factory } = await fixture();
  const read = vi.spyOn(repository, "getLocalProfile");
  const write = vi.spyOn(repository, "recordExport");
  const { result } = mount(factory);
  await waitFor(() =>
    expect(result.current.local.availability).toBe("enabled"),
  );
  act(() => result.current.session.setLocalProfileLink(link()));
  result.current.record("lesson-tool", "full");
  act(() => {
    result.current.session.setLocalProfileLink(null);
    result.current.session.setProfile(profile());
  });
  result.current.record("lesson-tool", "full");
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});

it("skips recording when the saved confirmed content differs", async () => {
  const { factory } = await fixture();
  const read = vi.spyOn(repository, "getLocalProfile");
  const write = vi.spyOn(repository, "recordExport");
  const { result } = mount(factory);
  await waitFor(() =>
    expect(result.current.local.availability).toBe("enabled"),
  );
  const changed = profile();
  changed.profileTitle += " 아직 저장하지 않은 수정";
  act(() => {
    result.current.session.setProfile(changed);
    result.current.session.setLocalProfileLink(link());
  });
  await act(async () => {
    result.current.record("lesson-tool", "core");
  });
  await waitFor(() => expect(read).toHaveBeenCalledOnce());
  await act(async () => {
    await read.mock.results[0]!.value;
  });
  expect(write).not.toHaveBeenCalled();
});

it("skips missing records and records without a confirmed version", async () => {
  const { factory, options } = await fixture();
  const read = vi.spyOn(repository, "getLocalProfile");
  const write = vi.spyOn(repository, "recordExport");
  const { result } = mount(factory);
  await waitFor(() =>
    expect(result.current.local.availability).toBe("enabled"),
  );
  act(() => {
    result.current.session.setProfile(profile());
    result.current.session.setLocalProfileLink(link());
  });
  await repository.deleteLocalProfile(id, options);
  await act(async () => {
    result.current.record("lesson-tool", "full");
  });
  await act(async () => {
    await read.mock.results[0]!.value;
  });
  const draft = toDraftSnapshot({
    profile: profile(),
    suggestedTags: [],
    selectedTagKeys: [],
    baseConfirmedAt: null,
    now: confirmedAt,
  });
  if (!draft.ok) throw new Error("Invalid fixture");
  await repository.createLocalProfile(
    { origin: "import", draft: draft.snapshot, suggestedTags: [] },
    options,
  );
  await act(async () => {
    result.current.record("lesson-tool", "full");
  });
  await act(async () => {
    await read.mock.results[1]!.value;
  });
  expect(write).not.toHaveBeenCalled();
});

it.each(["read", "write", "write-result", "refresh"] as const)(
  "swallows %s failures without returning a promise or throwing to the export caller",
  async (failure) => {
    const { factory } = await fixture();
    const { result } = mount(factory);
    await waitFor(() =>
      expect(result.current.local.availability).toBe("enabled"),
    );
    act(() => {
      result.current.session.setProfile(profile());
      result.current.session.setLocalProfileLink(link());
    });
    const read = vi.spyOn(repository, "getLocalProfile");
    const write = vi.spyOn(repository, "recordExport");
    if (failure === "read") read.mockRejectedValue(new Error("read failed"));
    if (failure === "write") write.mockRejectedValue(new Error("write failed"));
    if (failure === "write-result")
      write.mockResolvedValue({ ok: false, error: "quota_exceeded" });
    if (failure === "refresh") {
      write.mockResolvedValue({ ok: true, value: { recorded: true } });
      vi.spyOn(repository, "getLocalProfileAvailability").mockRejectedValue(
        new Error("refresh failed"),
      );
    }
    await act(async () => {
      expect(result.current.record("lesson-tool", "modules")).toBeUndefined();
      await Promise.resolve();
    });
    await waitFor(() => expect(read).toHaveBeenCalled());
    if (failure !== "read")
      await waitFor(() => expect(write).toHaveBeenCalled());
    expect(result.current.session.profile?.profileTitle).toBe(
      profile().profileTitle,
    );
  },
);

it("allows export to finish while a read is pending and rejects a stale timestamp at the write", async () => {
  const { factory, options } = await fixture();
  const originalRead = repository.getLocalProfile;
  const originalWrite = repository.recordExport;
  const stored = await originalRead(id, options);
  let release!: (value: typeof stored) => void;
  vi.spyOn(repository, "getLocalProfile").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const write = vi
    .spyOn(repository, "recordExport")
    .mockImplementation(async (...args) => {
      const edited = profile();
      edited.profileTitle += " 다른 탭 수정";
      await repository.saveConfirmed(
        id,
        {
          confirmed: { profile: edited, confirmedAt: newerAt },
          expectedRevision: 1,
        },
        { ...options, now: () => newerAt },
      );
      return originalWrite(...args);
    });
  const { result } = mount(factory);
  await waitFor(() =>
    expect(result.current.local.availability).toBe("enabled"),
  );
  act(() => {
    result.current.session.setProfile(profile());
    result.current.session.setLocalProfileLink(link());
  });
  expect(result.current.record("lesson-tool", "full")).toBeUndefined();
  expect(write).not.toHaveBeenCalled();
  await act(async () => {
    release(stored);
  });
  await waitFor(() => expect(write).toHaveBeenCalled());
  await act(async () => {
    await write.mock.results[0]!.value;
  });
  expect(await originalRead(id, options)).toMatchObject({
    ok: true,
    value: { exports: [], confirmed: { confirmedAt: newerAt } },
  });
});
