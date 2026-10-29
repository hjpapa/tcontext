// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { CONTROLLED_TAGS, type TeacherContextProfile } from "@/types/profile";
import {
  openExistingDatabase,
  PROFILE_STORE,
  type LocalProfileIdbFactory,
} from "./database";
import {
  createLocalProfile,
  deleteLocalProfile,
  deleteVersion,
  discardDraft,
  enableLocalProfiles,
  getLocalProfile,
  listLocalProfiles,
  recordExport,
  restoreVersion,
  saveConfirmed,
  saveDraft,
  type LocalProfileResult,
} from "./repository";
import { toConfirmedSnapshot, toDraftSnapshot } from "./serialize";

const id = "c1d9ab22-56cd-491b-9654-5bab1976ab91";
const importedId = "dfb651f7-47e2-4a2f-82bb-5cdb3453c9a1";
function time(step: number): string {
  return new Date(Date.UTC(2026, 9, 30, 0, step)).toISOString();
}
function valueOf<T>(result: LocalProfileResult<T>): T {
  if (!result.ok)
    throw new Error(`Repository operation failed: ${result.error}`);
  return result.value;
}
function confirmed(step: number, profile?: TeacherContextProfile) {
  const source = structuredClone(profile ?? FICTIONAL_PROFILES[0]!);
  if (!profile && step > 0) source.profileTitle += ` 수정 ${step}`;
  const result = toConfirmedSnapshot(source, time(step));
  if (!result.ok) throw new Error("Invalid confirmed fixture");
  return result.snapshot;
}
function draft(profile: TeacherContextProfile, baseConfirmedAt: string | null) {
  const result = toDraftSnapshot({
    profile,
    suggestedTags: [],
    selectedTagKeys: [],
    baseConfirmedAt,
    now: time(20),
  });
  if (!result.ok) throw new Error("Invalid draft fixture");
  return result.snapshot;
}
async function setup() {
  const factory = new IDBFactory();
  const notify = vi.fn();
  const options = {
    factory,
    notify,
    now: () => time(0),
    randomId: () => id,
  };
  valueOf(await enableLocalProfiles(options));
  const initial = confirmed(0);
  valueOf(
    await createLocalProfile(
      { origin: "interview", confirmed: initial, suggestedTags: [] },
      options,
    ),
  );
  const at = (step: number) => ({ ...options, now: () => time(step) });
  return {
    factory,
    notify,
    options,
    at,
    initial,
    read: async () => valueOf(await getLocalProfile(id, options)),
    save: async (step: number, expectedRevision: number) =>
      valueOf(
        await saveConfirmed(
          id,
          { confirmed: confirmed(step), expectedRevision },
          at(step),
        ),
      ),
  };
}
async function rawPut(factory: LocalProfileIdbFactory, record: unknown) {
  const opened = await openExistingDatabase(factory);
  if (!opened.ok) throw new Error("Missing fixture database");
  await new Promise<void>((resolve, reject) => {
    const tx = opened.db.transaction(PROFILE_STORE, "readwrite");
    tx.objectStore(PROFILE_STORE).put(record);
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
async function rawGet(factory: LocalProfileIdbFactory) {
  const opened = await openExistingDatabase(factory);
  if (!opened.ok) throw new Error("Missing fixture database");
  return new Promise<unknown>((resolve, reject) => {
    const tx = opened.db.transaction(PROFILE_STORE, "readonly");
    const request = tx.objectStore(PROFILE_STORE).get(id);
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

it("creates v2 records with empty history and exports, including imported drafts", async () => {
  const s = await setup();
  expect(await rawGet(s.factory)).toMatchObject({
    storageSchemaVersion: 2,
    history: [],
    exports: [],
  });
  valueOf(
    await createLocalProfile(
      {
        origin: "import",
        draft: draft(s.initial.profile, null),
        suggestedTags: [],
      },
      { ...s.at(1), randomId: () => importedId },
    ),
  );
  expect(valueOf(await getLocalProfile(importedId, s.options))).toMatchObject({
    storageSchemaVersion: 2,
    confirmed: null,
    history: [],
    exports: [],
  });
  expect(valueOf(await listLocalProfiles(s.options))).toMatchObject([
    {
      id: importedId,
      versionCount: 0,
      lastExport: null,
      outdatedExportTargets: [],
    },
    { id, versionCount: 1, lastExport: null, outdatedExportTargets: [] },
  ]);
  valueOf(
    await saveConfirmed(
      importedId,
      { confirmed: confirmed(2), expectedRevision: 1 },
      s.at(2),
    ),
  );
  expect(valueOf(await getLocalProfile(importedId, s.options))).toMatchObject({
    confirmed: confirmed(2),
    draft: null,
    history: [],
    exports: [],
  });
});

it("reads a v1 record without changing the database and writes v2 on the next save", async () => {
  const s = await setup();
  const legacy: Record<string, unknown> = {
    ...(await s.read()),
    storageSchemaVersion: 1,
  };
  delete legacy.history;
  delete legacy.exports;
  await rawPut(s.factory, legacy);
  s.notify.mockClear();
  expect(await s.read()).toEqual({
    ...legacy,
    storageSchemaVersion: 2,
    history: [],
    exports: [],
  });
  valueOf(await listLocalProfiles(s.options));
  expect(await rawGet(s.factory)).toEqual(legacy);
  expect(s.notify).not.toHaveBeenCalled();
  valueOf(
    await saveDraft(
      id,
      { draft: draft(s.initial.profile, time(0)), expectedRevision: 1 },
      s.at(1),
    ),
  );
  expect(await rawGet(s.factory)).toMatchObject({
    storageSchemaVersion: 2,
    revision: 2,
    history: [],
    exports: [],
  });
});

it("archives the previous confirmed profile and timestamp when content changes", async () => {
  const s = await setup();
  expect(await s.save(1, 1)).toEqual({ revision: 2, savedAt: time(1) });
  expect(await s.read()).toMatchObject({
    confirmed: confirmed(1),
    history: [{ ...s.initial, replacedAt: time(1) }],
    revision: 2,
    updatedAt: time(1),
  });
});

it("keeps the version timestamp and no history for same content while saving changed tags", async () => {
  const s = await setup();
  const tagged = structuredClone(s.initial.profile);
  tagged.confirmedTags.aiBoundaries = tagged.confirmedTags.aiBoundaries.length
    ? []
    : [CONTROLLED_TAGS.aiBoundaries[0]];
  expect(tagged.confirmedTags).not.toEqual(s.initial.profile.confirmedTags);
  valueOf(
    await saveDraft(
      id,
      { draft: draft(tagged, time(0)), expectedRevision: 1 },
      s.at(1),
    ),
  );
  expect(
    valueOf(
      await saveConfirmed(
        id,
        { confirmed: confirmed(2, tagged), expectedRevision: 2 },
        s.at(2),
      ),
    ),
  ).toEqual({ revision: 3, savedAt: time(2) });
  expect(await s.read()).toMatchObject({
    confirmed: { profile: tagged, confirmedAt: time(0) },
    history: [],
    draft: null,
    revision: 3,
    updatedAt: time(2),
  });
});

it("retains only the five latest previous versions after six content changes", async () => {
  const s = await setup();
  for (let step = 1; step <= 6; step++) await s.save(step, step);
  const record = await s.read();
  expect(record.confirmed).toEqual(confirmed(6));
  expect(record.history).toEqual(
    [5, 4, 3, 2, 1].map((step) => ({
      ...confirmed(step),
      replacedAt: time(step + 1),
    })),
  );
  expect(record.history.some((entry) => entry.confirmedAt === time(0))).toBe(
    false,
  );
  expect(valueOf(await listLocalProfiles(s.options))[0]).toMatchObject({
    versionCount: 6,
  });
});

it("restores an older version with its original timestamp and keeps the number of versions", async () => {
  const s = await setup();
  await s.save(1, 1);
  await s.save(2, 2);
  s.notify.mockClear();
  expect(
    await restoreVersion(
      id,
      { confirmedAt: time(0), expectedRevision: 3 },
      s.at(3),
    ),
  ).toEqual({ ok: true, value: { revision: 4, savedAt: time(3) } });
  expect(await s.read()).toMatchObject({
    confirmed: s.initial,
    history: [
      { ...confirmed(2), replacedAt: time(3) },
      { ...confirmed(1), replacedAt: time(2) },
    ],
    revision: 4,
    updatedAt: time(3),
  });
  expect(s.notify).toHaveBeenCalledTimes(1);
});

it("rejects missing versions, stale revisions and restoration over a draft without mutation", async () => {
  const s = await setup();
  await s.save(1, 1);
  const before = await s.read();
  expect(
    await restoreVersion(
      id,
      { confirmedAt: time(9), expectedRevision: 2 },
      s.at(2),
    ),
  ).toEqual({ ok: false, error: "not_found" });
  expect(
    await restoreVersion(
      id,
      { confirmedAt: time(0), expectedRevision: 1 },
      s.at(2),
    ),
  ).toEqual({ ok: false, error: "conflict" });
  expect(await s.read()).toEqual(before);
  valueOf(
    await saveDraft(
      id,
      { draft: draft(confirmed(1).profile, time(1)), expectedRevision: 2 },
      s.at(2),
    ),
  );
  const withDraft = await s.read();
  expect(
    await restoreVersion(
      id,
      { confirmedAt: time(0), expectedRevision: 3 },
      s.at(3),
    ),
  ).toEqual({ ok: false, error: "draft_exists" });
  expect(await s.read()).toEqual(withDraft);
});

it("deletes only a historical version without changing revision or blocking another tab's draft", async () => {
  const s = await setup();
  await s.save(1, 1);
  const before = await s.read();
  s.notify.mockClear();
  expect(await deleteVersion(id, { confirmedAt: time(0) }, s.at(2))).toEqual({
    ok: true,
    value: { deleted: true },
  });
  expect(s.notify).toHaveBeenCalledTimes(1);
  expect(await s.read()).toEqual({ ...before, history: [] });
  expect(await deleteVersion(id, { confirmedAt: time(1) }, s.at(3))).toEqual({
    ok: true,
    value: { deleted: false },
  });
  expect(await deleteVersion(id, { confirmedAt: time(9) }, s.at(3))).toEqual({
    ok: true,
    value: { deleted: false },
  });
  expect(await s.read()).toEqual({ ...before, history: [] });
  expect(
    await saveDraft(
      id,
      {
        draft: draft(confirmed(1).profile, time(1)),
        expectedRevision: before.revision,
      },
      s.at(4),
    ),
  ).toMatchObject({ ok: true, value: { revision: 3 } });
  expect((await s.read()).history).toEqual([]);
});

it("records only export metadata without changing revision or blocking another tab's draft", async () => {
  const s = await setup();
  const before = await s.read();
  s.notify.mockClear();
  expect(
    await recordExport(
      id,
      { target: "lesson-tool", format: "modules", confirmedAt: time(0) },
      s.at(1),
    ),
  ).toEqual({ ok: true, value: { recorded: true } });
  const exports = [
    {
      target: "lesson-tool",
      format: "modules",
      confirmedAt: time(0),
      exportedAt: time(1),
    },
  ];
  expect(await s.read()).toEqual({ ...before, exports });
  expect(s.notify).toHaveBeenCalledTimes(1);
  expect(
    await saveDraft(
      id,
      {
        draft: draft(s.initial.profile, time(0)),
        expectedRevision: before.revision,
      },
      s.at(2),
    ),
  ).toMatchObject({ ok: true, value: { revision: 2 } });
  expect((await s.read()).exports).toEqual(exports);
});

it("updates one export per target and drops the earliest export when exceeding ten targets", async () => {
  const s = await setup();
  for (let index = 0; index < 10; index++) {
    expect(
      await recordExport(
        id,
        {
          target: `target-${index}`,
          format: "full",
          confirmedAt: time(0),
        },
        s.at(index + 1),
      ),
    ).toEqual({ ok: true, value: { recorded: true } });
  }
  valueOf(
    await recordExport(
      id,
      { target: "target-0", format: "core", confirmedAt: time(0) },
      s.at(20),
    ),
  );
  expect((await s.read()).exports).toHaveLength(10);
  expect(
    (await s.read()).exports.filter((entry) => entry.target === "target-0"),
  ).toEqual([
    {
      target: "target-0",
      format: "core",
      confirmedAt: time(0),
      exportedAt: time(20),
    },
  ]);
  valueOf(
    await recordExport(
      id,
      { target: "target-10", format: "skill-package", confirmedAt: time(0) },
      s.at(21),
    ),
  );
  const record = await s.read();
  expect(record.exports).toHaveLength(10);
  expect(new Set(record.exports.map((entry) => entry.target)).size).toBe(10);
  expect(record.exports.some((entry) => entry.target === "target-1")).toBe(
    false,
  );
  expect(
    record.exports.find((entry) => entry.target === "target-0")?.exportedAt,
  ).toBe(time(20));
  expect(record).toMatchObject({ revision: 1, updatedAt: time(0) });
});

it("ignores a delayed export after another tab changes the confirmed version", async () => {
  const s = await setup();
  valueOf(
    await recordExport(
      id,
      { target: "lesson-tool", format: "full", confirmedAt: time(0) },
      s.at(1),
    ),
  );
  await s.save(2, 1);
  const before = await s.read();
  expect(
    await recordExport(
      id,
      { target: "lesson-tool", format: "core", confirmedAt: time(0) },
      s.at(3),
    ),
  ).toEqual({ ok: true, value: { recorded: false } });
  expect(await s.read()).toEqual(before);
  valueOf(
    await createLocalProfile(
      {
        origin: "import",
        draft: draft(s.initial.profile, null),
        suggestedTags: [],
      },
      { ...s.options, randomId: () => importedId },
    ),
  );
  expect(
    await recordExport(
      importedId,
      { target: "lesson-tool", format: "core", confirmedAt: time(0) },
      s.at(4),
    ),
  ).toEqual({ ok: true, value: { recorded: false } });
  expect(valueOf(await getLocalProfile(importedId, s.options)).exports).toEqual(
    [],
  );
});

it("preserves history and exports through existing draft, discard and same-content confirm writes", async () => {
  const s = await setup();
  await s.save(1, 1);
  valueOf(
    await recordExport(
      id,
      { target: "lesson-tool", format: "core", confirmedAt: time(1) },
      s.at(2),
    ),
  );
  const baseline = await s.read();
  const auxiliary = { history: baseline.history, exports: baseline.exports };
  valueOf(
    await saveDraft(
      id,
      { draft: draft(confirmed(1).profile, time(1)), expectedRevision: 2 },
      s.at(3),
    ),
  );
  expect(await s.read()).toMatchObject(auxiliary);
  valueOf(await discardDraft(id, { expectedRevision: 3 }, s.at(4)));
  expect(await s.read()).toMatchObject(auxiliary);
  valueOf(await discardDraft(id, { expectedRevision: 4 }, s.at(5)));
  expect(await s.read()).toMatchObject({ ...auxiliary, revision: 4 });
  valueOf(
    await saveConfirmed(
      id,
      { confirmed: confirmed(6, confirmed(1).profile), expectedRevision: 4 },
      s.at(6),
    ),
  );
  expect(await s.read()).toMatchObject({
    ...auxiliary,
    confirmed: confirmed(1),
    revision: 5,
  });
  valueOf(await enableLocalProfiles(s.at(7)));
  expect(await s.read()).toMatchObject(auxiliary);
  await s.save(8, 5);
  expect((await s.read()).exports).toEqual(auxiliary.exports);
  expect((await s.read()).history).toEqual([
    { ...confirmed(1), replacedAt: time(8) },
    ...auxiliary.history,
  ]);
  valueOf(await deleteLocalProfile(id, s.options));
  expect(await rawGet(s.factory)).toBeUndefined();
});

it("serializes concurrent auxiliary writes and a draft save without losing any update", async () => {
  const s = await setup();
  await s.save(1, 1);
  const results = await Promise.all([
    recordExport(
      id,
      { target: "first-tool", format: "core", confirmedAt: time(1) },
      s.at(2),
    ),
    recordExport(
      id,
      { target: "second-tool", format: "full", confirmedAt: time(1) },
      s.at(3),
    ),
    deleteVersion(id, { confirmedAt: time(0) }, s.at(4)),
    saveDraft(
      id,
      { draft: draft(confirmed(1).profile, time(1)), expectedRevision: 2 },
      s.at(5),
    ),
  ]);
  expect(results).toEqual([
    { ok: true, value: { recorded: true } },
    { ok: true, value: { recorded: true } },
    { ok: true, value: { deleted: true } },
    { ok: true, value: { revision: 3, savedAt: time(5) } },
  ]);
  const record = await s.read();
  expect(record).toMatchObject({
    history: [],
    revision: 3,
    updatedAt: time(5),
  });
  expect(record.draft).toEqual(draft(confirmed(1).profile, time(1)));
  expect(record.exports).toHaveLength(2);
  expect(record.exports).toEqual(
    expect.arrayContaining([
      {
        target: "first-tool",
        format: "core",
        confirmedAt: time(1),
        exportedAt: time(2),
      },
      {
        target: "second-tool",
        format: "full",
        confirmedAt: time(1),
        exportedAt: time(3),
      },
    ]),
  );
});

it("lists version counts, the latest export and outdated targets in export-time order", async () => {
  const s = await setup();
  valueOf(
    await recordExport(
      id,
      { target: "first-tool", format: "full", confirmedAt: time(0) },
      s.at(1),
    ),
  );
  valueOf(
    await recordExport(
      id,
      { target: "second-tool", format: "core", confirmedAt: time(0) },
      s.at(2),
    ),
  );
  await s.save(3, 1);
  valueOf(
    await recordExport(
      id,
      { target: "current-tool", format: "modules", confirmedAt: time(3) },
      s.at(4),
    ),
  );
  expect(valueOf(await listLocalProfiles(s.options))[0]).toMatchObject({
    versionCount: 2,
    lastExport: {
      target: "current-tool",
      format: "modules",
      exportedAt: time(4),
    },
    outdatedExportTargets: ["second-tool", "first-tool"],
  });
  const exports = (await s.read()).exports;
  valueOf(
    await restoreVersion(
      id,
      { confirmedAt: time(0), expectedRevision: 2 },
      s.at(5),
    ),
  );
  expect((await s.read()).exports).toEqual(exports);
  expect(valueOf(await listLocalProfiles(s.options))[0]).toMatchObject({
    versionCount: 2,
    lastExport: {
      target: "current-tool",
      format: "modules",
      exportedAt: time(4),
    },
    outdatedExportTargets: ["current-tool"],
  });
});
