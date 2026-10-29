// @vitest-environment node
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { PENDING_PRIVACY_REVIEW } from "@/types/profile";
import {
  deleteLocalProfileDatabase,
  openExistingDatabase,
  openOrCreateDatabase,
  PROFILE_STORE,
  type LocalProfileIdbFactory,
} from "./database";
import {
  createLocalProfile,
  deleteLocalProfile,
  disableAndDeleteAllLocalProfiles,
  discardDraft,
  enableLocalProfiles,
  getLocalProfile,
  getLocalProfileAvailability,
  listLocalProfiles,
  saveConfirmed,
  saveDraft,
  toLocalProfileErrorCode,
  notifyLocalProfilesChanged,
} from "./repository";
import { LOCAL_PROFILE_DB_NAME } from "./schema";
import { migrateLocalProfileRecord } from "./migrate";
import {
  toConfirmedSnapshot,
  toDraftSnapshot,
  type ConfirmedSnapshot,
} from "./serialize";

const timestamp = "2026-10-25T00:00:00.000Z";
const id = "c1d9ab22-56cd-491b-9654-5bab1976ab91";
function snapshots() {
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  const confirmed = toConfirmedSnapshot(profile, timestamp);
  const draft = toDraftSnapshot({
    profile,
    suggestedTags: [],
    selectedTagKeys: [],
    baseConfirmedAt: timestamp,
    now: timestamp,
  });
  if (!confirmed.ok || !draft.ok) throw new Error("Invalid fixture");
  return { confirmed: confirmed.snapshot, draft: draft.snapshot };
}
function setup() {
  const factory = new IDBFactory();
  const notify = vi.fn();
  const options = { factory, notify, now: () => timestamp, randomId: () => id };
  const { confirmed, draft } = snapshots();
  return {
    factory,
    notify,
    options,
    confirmed,
    draft,
    create: () =>
      createLocalProfile(
        { origin: "interview", confirmed, suggestedTags: [] },
        options,
      ),
  };
}
async function rawPut(factory: LocalProfileIdbFactory, value: unknown) {
  const opened = await openExistingDatabase(factory);
  if (!opened.ok) throw new Error("No database");
  await new Promise<void>((resolve, reject) => {
    const tx = opened.db.transaction(PROFILE_STORE, "readwrite");
    tx.objectStore(PROFILE_STORE).put(value);
    tx.oncomplete = () => {
      opened.db.close();
      resolve();
    };
    tx.onabort = () => {
      opened.db.close();
      reject(tx.error);
    };
  });
}
async function rawGet(factory: LocalProfileIdbFactory, key: string) {
  const opened = await openExistingDatabase(factory);
  if (!opened.ok) throw new Error("No database");
  return new Promise<unknown>((resolve, reject) => {
    const tx = opened.db.transaction(PROFILE_STORE, "readonly");
    const request = tx.objectStore(PROFILE_STORE).get(key);
    tx.oncomplete = () => {
      opened.db.close();
      resolve(request.result);
    };
    tx.onabort = () => {
      opened.db.close();
      reject(tx.error);
    };
  });
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([true, false, "throws"])(
  "never creates a database before consent (databases: %s)",
  async (support) => {
    const s = setup();
    const wrapper: LocalProfileIdbFactory = {
      open: s.factory.open.bind(s.factory),
      deleteDatabase: s.factory.deleteDatabase.bind(s.factory),
    };
    if (support === "throws")
      wrapper.databases = async () => {
        throw new Error("unavailable");
      };
    const options = {
      ...s.options,
      factory: support === true ? s.factory : wrapper,
    };
    expect(await getLocalProfileAvailability(options)).toBe("disabled");
    for (const result of [
      await listLocalProfiles(options),
      await getLocalProfile(id, options),
      await saveDraft(id, { draft: s.draft, expectedRevision: 1 }, options),
      await createLocalProfile(
        { origin: "interview", confirmed: s.confirmed, suggestedTags: [] },
        options,
      ),
    ])
      expect(result).toEqual({ ok: false, error: "disabled" });
    expect(await s.factory.databases()).toEqual([]);
    expect(s.notify).not.toHaveBeenCalled();
  },
);
it("handles unavailable factories and throwing dependencies", async () => {
  const s = setup();
  for (const factory of [
    null,
    {
      open: () => {
        throw new DOMException("denied", "SecurityError");
      },
      deleteDatabase: s.factory.deleteDatabase.bind(s.factory),
    },
  ]) {
    expect(await getLocalProfileAvailability({ factory })).toBe("unavailable");
    expect(await enableLocalProfiles({ factory })).toEqual({
      ok: false,
      error: "unavailable",
    });
  }
  await enableLocalProfiles(s.options);
  for (const overrides of [
    {
      randomId: () => {
        throw new Error("rng");
      },
    },
    {
      now: () => {
        throw new Error("clock");
      },
    },
  ])
    expect(
      await createLocalProfile(
        { origin: "interview", confirmed: s.confirmed, suggestedTags: [] },
        { ...s.options, ...overrides },
      ),
    ).toEqual({ ok: false, error: "unavailable" });
  expect(await listLocalProfiles(s.options)).toEqual({ ok: true, value: [] });
  expect(s.notify).toHaveBeenCalledTimes(1);
});
it("enables once and atomically creates, drafts, confirms and deletes", async () => {
  const s = setup();
  expect(await enableLocalProfiles(s.options)).toEqual({
    ok: true,
    value: { enabledAt: timestamp },
  });
  expect(await getLocalProfileAvailability(s.options)).toBe("enabled");
  expect(
    await enableLocalProfiles({
      ...s.options,
      now: () => "2026-10-26T00:00:00.000Z",
    }),
  ).toEqual({ ok: true, value: { enabledAt: timestamp } });
  expect(s.notify).toHaveBeenCalledTimes(1);
  expect(await s.create()).toEqual({
    ok: true,
    value: { id, revision: 1, savedAt: timestamp },
  });
  const read = await getLocalProfile(id, s.options);
  expect(read.ok).toBe(true);
  if (!read.ok) throw new Error("Missing fixture");
  expect(read.value.confirmed).toStrictEqual(s.confirmed);
  expect(migrateLocalProfileRecord(read.value).ok).toBe(true);
  const later = "2026-10-26T00:00:00.000Z";
  expect(
    await saveDraft(
      id,
      { draft: s.draft, expectedRevision: 1 },
      { ...s.options, now: () => later },
    ),
  ).toEqual({ ok: true, value: { revision: 2, savedAt: later } });
  const listing = await listLocalProfiles(s.options);
  expect(listing).toMatchObject({
    ok: true,
    value: [
      {
        kind: "record",
        id,
        revision: 2,
        updatedAt: later,
        hasDraft: true,
        privacyStatus: "clear",
        confirmedAt: timestamp,
        title: s.draft.profile.profileTitle,
        schoolLevel: "kindergarten",
        role: s.draft.profile.metadata.role,
      },
    ],
  });
  if (listing.ok)
    expect(Object.hasOwn(listing.value[0]!, "teachingSubject")).toBe(false);
  expect(
    await saveConfirmed(
      id,
      { confirmed: s.confirmed, expectedRevision: 2 },
      s.options,
    ),
  ).toEqual({ ok: true, value: { revision: 3, savedAt: timestamp } });
  expect(await getLocalProfile(id, s.options)).toMatchObject({
    ok: true,
    value: { revision: 3, draft: null },
  });
  expect(await discardDraft(id, { expectedRevision: 3 }, s.options)).toEqual({
    ok: true,
    value: { deleted: false, revision: 3 },
  });
  expect(s.notify).toHaveBeenCalledTimes(4);
  expect(await deleteLocalProfile(id, s.options)).toEqual({
    ok: true,
    value: { deleted: true },
  });
  expect(await deleteLocalProfile(id, s.options)).toEqual({
    ok: true,
    value: { deleted: false },
  });
  expect(s.notify).toHaveBeenCalledTimes(5);
});
it("discards imported draft-only records and increments confirmed draft revisions", async () => {
  const s = setup();
  await enableLocalProfiles(s.options);
  expect(
    (
      await createLocalProfile(
        { origin: "import", draft: s.draft, suggestedTags: [] },
        s.options,
      )
    ).ok,
  ).toBe(true);
  expect(await listLocalProfiles(s.options)).toMatchObject({
    ok: true,
    value: [{ privacyStatus: null, origin: "import" }],
  });
  expect(await discardDraft(id, { expectedRevision: 1 }, s.options)).toEqual({
    ok: true,
    value: { deleted: true, revision: null },
  });
  expect(await getLocalProfile(id, s.options)).toEqual({
    ok: false,
    error: "not_found",
  });
  await s.create();
  await saveDraft(id, { draft: s.draft, expectedRevision: 1 }, s.options);
  expect(await discardDraft(id, { expectedRevision: 2 }, s.options)).toEqual({
    ok: true,
    value: { deleted: false, revision: 3 },
  });
});
it("rejects stale revisions and duplicate ids without changing stored bytes", async () => {
  const s = setup();
  await enableLocalProfiles(s.options);
  await s.create();
  const before = JSON.stringify(await rawGet(s.factory, id));
  for (const result of [
    await saveDraft(id, { draft: s.draft, expectedRevision: 0 }, s.options),
    await saveConfirmed(
      id,
      { confirmed: s.confirmed, expectedRevision: 0 },
      s.options,
    ),
    await discardDraft(id, { expectedRevision: 0 }, s.options),
    await s.create(),
  ])
    expect(result).toEqual({ ok: false, error: "conflict" });
  expect(JSON.stringify(await rawGet(s.factory, id))).toBe(before);
  expect(s.notify).toHaveBeenCalledTimes(2);
});
it("lists damaged and future records without an index and only allows deletion", async () => {
  const s = setup();
  await enableLocalProfiles(s.options);
  await s.create();
  for (const [key, version, error] of [
    ["broken", 1, "corrupted"],
    ["future", 3, "unsupported_version"],
  ] as const) {
    const raw = { id: key, storageSchemaVersion: version, junk: true };
    await rawPut(s.factory, raw);
    for (const result of [
      await getLocalProfile(key, s.options),
      await saveDraft(key, { draft: s.draft, expectedRevision: 1 }, s.options),
      await saveConfirmed(
        key,
        { confirmed: s.confirmed, expectedRevision: 1 },
        s.options,
      ),
      await discardDraft(key, { expectedRevision: 1 }, s.options),
    ])
      expect(result).toEqual({ ok: false, error });
    expect(await rawGet(s.factory, key)).toStrictEqual(raw);
  }
  expect(await listLocalProfiles(s.options)).toMatchObject({
    ok: true,
    value: [
      { kind: "record", id },
      { kind: "corrupted", id: "broken" },
      { kind: "unsupported", id: "future" },
    ],
  });
  for (const key of ["broken", "future"])
    expect(await deleteLocalProfile(key, s.options)).toEqual({
      ok: true,
      value: { deleted: true },
    });
});
it("counts damaged records toward the limit and sorts valid records newest first", async () => {
  const s = setup();
  await enableLocalProfiles(s.options);
  for (let i = 0; i < 9; i++)
    expect(
      (
        await createLocalProfile(
          { origin: "interview", confirmed: s.confirmed, suggestedTags: [] },
          {
            ...s.options,
            randomId: () => `c1d9ab22-56cd-491b-9654-5bab1976ab9${i}`,
            now: () => `2026-10-25T0${i}:00:00.000Z`,
          },
        )
      ).ok,
    ).toBe(true);
  await rawPut(s.factory, { id: "broken" });
  expect(await s.create()).toEqual({ ok: false, error: "limit_reached" });
  const result = await listLocalProfiles(s.options);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value[0]).toMatchObject({
      kind: "record",
      updatedAt: "2026-10-25T08:00:00.000Z",
    });
    expect(result.value[9]).toEqual({ kind: "corrupted", id: "broken" });
  }
});
it.each([
  [new DOMException("full", "QuotaExceededError"), "quota_exceeded"],
  [new Error("failure"), "unavailable"],
])("rolls back a failed put: %s", async (error, code) => {
  const s = setup();
  await enableLocalProfiles(s.options);
  await s.create();
  const before = await rawGet(s.factory, id);
  const spy = vi
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(() => {
      throw error;
    });
  expect(
    await saveDraft(id, { draft: s.draft, expectedRevision: 1 }, s.options),
  ).toEqual({ ok: false, error: code });
  spy.mockRestore();
  expect(await rawGet(s.factory, id)).toStrictEqual(before);
  expect(s.notify).toHaveBeenCalledTimes(2);
});
it("rejects invalid snapshots and secret fields without writing", async () => {
  const s = setup();
  await enableLocalProfiles(s.options);
  await s.create();
  const before = await rawGet(s.factory, id);
  for (const confirmed of [
    {
      ...s.confirmed,
      profile: {
        ...s.confirmed.profile,
        privacyReview: PENDING_PRIVACY_REVIEW,
      },
    },
    {
      ...s.confirmed,
      privacyReviewToken: "secret",
    } as unknown as ConfirmedSnapshot,
  ])
    expect(
      await saveConfirmed(id, { confirmed, expectedRevision: 1 }, s.options),
    ).toEqual({ ok: false, error: "invalid" });
  expect(await rawGet(s.factory, id)).toStrictEqual(before);
  expect(s.notify).toHaveBeenCalledTimes(2);
});
it("deletes all, closes cooperative connections and reports blocked deletion", async () => {
  const s = setup();
  await enableLocalProfiles(s.options);
  await s.create();
  const opened = await openExistingDatabase(s.factory);
  expect(opened.ok).toBe(true);
  expect(await disableAndDeleteAllLocalProfiles(undefined, s.options)).toEqual({
    ok: true,
    value: undefined,
  });
  expect(await s.factory.databases()).toEqual([]);
  expect(await getLocalProfileAvailability(s.options)).toBe("disabled");
  const stubborn = await openOrCreateDatabase(s.factory);
  if (!stubborn.ok) throw new Error("No db");
  stubborn.db.onversionchange = null;
  expect(
    await deleteLocalProfileDatabase(s.factory, { blockedTimeoutMs: 50 }),
  ).toEqual({ ok: false, error: "blocked" });
  stubborn.db.close();
  await vi.waitFor(async () => expect(await s.factory.databases()).toEqual([]));
});
it("preserves a future database version", async () => {
  const s = setup();
  await new Promise<void>((resolve, reject) => {
    const request = s.factory.open(LOCAL_PROFILE_DB_NAME, 2);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
  expect(await getLocalProfileAvailability(s.options)).toBe(
    "unsupported_version",
  );
  for (const result of [await enableLocalProfiles(s.options), await s.create()])
    expect(result).toEqual({ ok: false, error: "unsupported_version" });
  expect(await s.factory.databases()).toEqual([
    { name: LOCAL_PROFILE_DB_NAME, version: 2 },
  ]);
  expect(s.notify).not.toHaveBeenCalled();
});
it.each([
  ["QuotaExceededError", "quota_exceeded"],
  ["ConstraintError", "conflict"],
  ["VersionError", "unsupported_version"],
  ["InvalidStateError", "unavailable"],
  ["SecurityError", "unavailable"],
  ["UnknownError", "unavailable"],
  ["AbortError", "unavailable"],
])("maps %s", (name, expected) =>
  expect(toLocalProfileErrorCode(new DOMException("test", name))).toBe(
    expected,
  ),
);
it("maps unknown errors and only broadcasts the change marker", () => {
  for (const error of [null, undefined, "error", {}, 1])
    expect(toLocalProfileErrorCode(error)).toBe("unavailable");
  const post = vi.fn();
  const close = vi.fn();
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      postMessage = post;
      close = close;
    },
  );
  notifyLocalProfilesChanged();
  expect(post).toHaveBeenCalledExactlyOnceWith({ type: "changed" });
  expect(close).toHaveBeenCalledTimes(1);
});
