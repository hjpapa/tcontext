// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { toConfirmedSnapshot } from "@/lib/storage/profiles/serialize";
import { useContextAsOf } from "./use-context-as-of";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

function profile() {
  const value = structuredClone(FICTIONAL_PROFILES[0]!);
  value.metadata.generatedAt = "2026-10-01T15:30:00.000Z";
  return value;
}

function renderContext(factory: IDBFactory) {
  return renderHook(
    () => {
      const session = useInterviewSession();
      const local = useLocalProfiles();
      return { session, local, asOf: useContextAsOf(session.profile) };
    },
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

async function createConfirmed(factory: IDBFactory, confirmedAt: string) {
  const options = { factory };
  expect((await repository.enableLocalProfiles(options)).ok).toBe(true);
  const snapshot = toConfirmedSnapshot(profile(), confirmedAt);
  if (!snapshot.ok) throw new Error("Invalid fixture snapshot");
  const created = await repository.createLocalProfile(
    { origin: "interview", confirmed: snapshot.snapshot, suggestedTags: [] },
    options,
  );
  if (!created.ok) throw new Error("Fixture record was not created");
  const read = await repository.getLocalProfile(created.value.id, options);
  if (!read.ok) throw new Error("Fixture record was not readable");
  return { id: created.value.id, read };
}

function link(recordId: string) {
  return { recordId, revision: 1, baseline: null, openedAt: 1 };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe("useContextAsOf", () => {
  it("uses generatedAt in Korean time without creating a database, even for an unavailable link", async () => {
    const factory = new IDBFactory();
    const open = vi.spyOn(factory, "open");
    const read = vi.spyOn(repository, "getLocalProfile");
    const { result } = renderContext(factory);
    expect(result.current.asOf).toBeNull();
    await waitFor(() =>
      expect(result.current.local.availability).toBe("disabled"),
    );
    act(() => {
      result.current.session.setProfile(profile());
      result.current.session.setLocalProfileLink(link(MISSING_ID));
    });
    expect(result.current.asOf).toEqual({
      date: "2026-10-02",
      source: "generated",
    });
    expect(read).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(await factory.databases()).toEqual([]);
  });

  it("uses a linked confirmedAt from the injected existing database", async () => {
    const factory = new IDBFactory();
    const saved = await createConfirmed(factory, "2026-10-25T15:30:00.000Z");
    const { result } = renderContext(factory);
    act(() => {
      result.current.session.setProfile(profile());
      result.current.session.setLocalProfileLink(link(saved.id));
    });
    await waitFor(() =>
      expect(result.current.asOf).toEqual({
        date: "2026-10-26",
        source: "confirmed",
      }),
    );
    expect((await factory.databases()).length).toBe(1);
  });

  it("keeps the generated date for an unlinked profile even when local storage is enabled", async () => {
    const factory = new IDBFactory();
    await createConfirmed(factory, "2026-10-25T15:30:00.000Z");
    const read = vi.spyOn(repository, "getLocalProfile");
    const { result } = renderContext(factory);
    await waitFor(() =>
      expect(result.current.local.availability).toBe("enabled"),
    );
    act(() => result.current.session.setProfile(profile()));
    expect(result.current.asOf).toEqual({
      date: "2026-10-02",
      source: "generated",
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("falls back to generatedAt when the linked record cannot be read", async () => {
    const factory = new IDBFactory();
    await createConfirmed(factory, "2026-10-25T15:30:00.000Z");
    const read = vi.spyOn(repository, "getLocalProfile");
    const { result } = renderContext(factory);
    await waitFor(() =>
      expect(result.current.local.availability).toBe("enabled"),
    );
    act(() => {
      result.current.session.setProfile(profile());
      result.current.session.setLocalProfileLink(link(MISSING_ID));
    });
    await waitFor(() =>
      expect(read).toHaveBeenCalledWith(MISSING_ID, { factory }),
    );
    await act(async () => {
      await read.mock.results[0]!.value;
    });
    expect(result.current.asOf).toEqual({
      date: "2026-10-02",
      source: "generated",
    });
  });

  it("handles a rejected read without leaking an unhandled rejection", async () => {
    const factory = new IDBFactory();
    const saved = await createConfirmed(factory, "2026-10-25T15:30:00.000Z");
    const read = vi
      .spyOn(repository, "getLocalProfile")
      .mockRejectedValue(new Error("unavailable"));
    const { result } = renderContext(factory);
    await waitFor(() =>
      expect(result.current.local.availability).toBe("enabled"),
    );
    await act(async () => {
      result.current.session.setProfile(profile());
      result.current.session.setLocalProfileLink(link(saved.id));
    });
    expect(read).toHaveBeenCalledOnce();
    expect(result.current.asOf).toEqual({
      date: "2026-10-02",
      source: "generated",
    });
  });

  it("ignores stale reads and immediately drops a previous link's date", async () => {
    const factory = new IDBFactory();
    const first = await createConfirmed(factory, "2026-10-20T01:00:00.000Z");
    const second = await createConfirmed(factory, "2026-10-25T15:30:00.000Z");
    type ReadResult = Awaited<ReturnType<typeof repository.getLocalProfile>>;
    let resolveFirst!: (value: ReadResult) => void;
    let resolveSecond!: (value: ReadResult) => void;
    const read = vi
      .spyOn(repository, "getLocalProfile")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const { result } = renderContext(factory);
    await waitFor(() =>
      expect(result.current.local.availability).toBe("enabled"),
    );
    act(() => {
      result.current.session.setProfile(profile());
      result.current.session.setLocalProfileLink(link(first.id));
    });
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    act(() => result.current.session.setLocalProfileLink(link(second.id)));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(result.current.asOf).toEqual({
      date: "2026-10-02",
      source: "generated",
    });
    await act(async () => {
      resolveSecond(second.read);
    });
    expect(result.current.asOf).toEqual({
      date: "2026-10-26",
      source: "confirmed",
    });
    await act(async () => {
      resolveFirst(first.read);
    });
    expect(result.current.asOf).toEqual({
      date: "2026-10-26",
      source: "confirmed",
    });
    act(() => result.current.session.setLocalProfileLink(null));
    expect(result.current.asOf).toEqual({
      date: "2026-10-02",
      source: "generated",
    });
  });
});
