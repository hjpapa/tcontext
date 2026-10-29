import { z } from "zod";
import type { SuggestedTag } from "@/lib/ai/schemas/profile";
import { mergeSuggestedTags } from "@/lib/profile/tags";
import { sameProfileContent } from "@/lib/profile/versions";
import {
  isUnverifiedPrivacyReview,
  type SchoolLevel,
  type TeachingSubject,
} from "@/types/profile";
import {
  browserIdbFactory,
  deleteLocalProfileDatabase,
  META_STORE,
  openExistingDatabase,
  openOrCreateDatabase,
  PROFILE_STORE,
  type LocalProfileIdbFactory,
} from "./database";
import { migrateLocalProfileRecord } from "./migrate";
import {
  localProfileRecordSchema,
  localProfileSettingsSchema,
  LOCAL_PROFILE_SETTINGS_VERSION,
  LOCAL_PROFILE_STORAGE_SCHEMA_VERSION,
  MAX_LOCAL_PROFILES,
  MAX_PROFILE_HISTORY,
  MAX_PROFILE_EXPORTS,
  exportTargetSchema,
  profileExportFormatSchema,
  type ProfileExportFormat,
  type LocalProfileRecord,
} from "./schema";
import type { ConfirmedSnapshot, DraftSnapshot } from "./serialize";

export type LocalProfileAvailability =
  "unavailable" | "disabled" | "enabled" | "unsupported_version";
export type LocalProfileErrorCode =
  | "unavailable"
  | "disabled"
  | "unsupported_version"
  | "quota_exceeded"
  | "conflict"
  | "corrupted"
  | "not_found"
  | "draft_exists"
  | "limit_reached"
  | "blocked"
  | "invalid";
export type LocalProfileResult<T> =
  { ok: true; value: T } | { ok: false; error: LocalProfileErrorCode };
export type LocalProfileRepositoryOptions = {
  factory?: LocalProfileIdbFactory | null;
  now?: () => string;
  randomId?: () => string;
  notify?: () => void;
};
export const LOCAL_PROFILES_CHANNEL = "tcontext:local-profiles";
export function notifyLocalProfilesChanged(): void {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(LOCAL_PROFILES_CHANNEL);
    try {
      channel.postMessage({ type: "changed" });
    } finally {
      channel.close();
    }
  } catch {
    /* Notifications are best effort after a committed write. */
  }
}
export function toLocalProfileErrorCode(error: unknown): LocalProfileErrorCode {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? error.name
      : null;
  if (name === "QuotaExceededError") return "quota_exceeded";
  if (name === "ConstraintError") return "conflict";
  if (name === "VersionError") return "unsupported_version";
  return "unavailable";
}
export type LocalProfileListItem =
  | {
      kind: "record";
      id: string;
      revision: number;
      origin: "interview" | "import";
      title: string;
      schoolLevel: SchoolLevel;
      role: string;
      teachingSubject?: TeachingSubject;
      createdAt: string;
      updatedAt: string;
      confirmedAt: string | null;
      hasDraft: boolean;
      versionCount: number;
      lastExport: {
        target: string;
        format: ProfileExportFormat;
        exportedAt: string;
      } | null;
      outdatedExportTargets: string[];
      privacyStatus: "clear" | "warning" | "unverified" | null;
    }
  | { kind: "corrupted"; id: string | null }
  | { kind: "unsupported"; id: string | null };

function factoryFor(
  options?: LocalProfileRepositoryOptions,
): LocalProfileIdbFactory | null {
  return options?.factory === undefined ? browserIdbFactory() : options.factory;
}
function notify(options?: LocalProfileRepositoryOptions): void {
  try {
    (options?.notify ?? notifyLocalProfilesChanged)();
  } catch {
    /* Do not report a committed write as failed. */
  }
}
function now(options?: LocalProfileRepositoryOptions): string {
  return (options?.now ?? (() => new Date().toISOString()))();
}
type TransactionContext<T> = {
  profiles: IDBObjectStore;
  meta: IDBObjectStore;
  done: (value: T, changed?: boolean) => void;
  fail: (error: LocalProfileErrorCode) => void;
  guard: (callback: () => void) => void;
};
async function transaction<T>(
  options: LocalProfileRepositoryOptions | undefined,
  mode: IDBTransactionMode,
  create: boolean,
  strict: boolean,
  operation: (context: TransactionContext<T>) => void,
): Promise<LocalProfileResult<T>> {
  const factory = factoryFor(options);
  if (!factory) return { ok: false, error: "unavailable" };
  const opened = await (create
    ? openOrCreateDatabase(factory)
    : openExistingDatabase(factory));
  if (!opened.ok) return opened;
  const db = opened.db;
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    let result: LocalProfileResult<T> = { ok: false, error: "unavailable" };
    let changed = false;
    try {
      tx = db.transaction(
        [META_STORE, PROFILE_STORE],
        mode,
        strict ? { durability: "strict" } : undefined,
      );
      const fail = (error: LocalProfileErrorCode) => {
        result = { ok: false, error };
        try {
          tx.abort();
        } catch {
          db.close();
          resolve(result);
        }
      };
      const guard = (callback: () => void) => {
        try {
          callback();
        } catch (error) {
          fail(toLocalProfileErrorCode(error));
        }
      };
      tx.oncomplete = () => {
        db.close();
        if (result.ok && changed) notify(options);
        resolve(result);
      };
      tx.onabort = () => {
        db.close();
        resolve(
          result.ok
            ? { ok: false, error: toLocalProfileErrorCode(tx.error) }
            : result,
        );
      };
      tx.onerror = (event) => {
        result = {
          ok: false,
          error: toLocalProfileErrorCode(
            (event.target as IDBRequest | null)?.error ?? tx.error,
          ),
        };
      };
      const context: TransactionContext<T> = {
        profiles: tx.objectStore(PROFILE_STORE),
        meta: tx.objectStore(META_STORE),
        done: (value, written = false) => {
          result = { ok: true, value };
          changed = written;
        },
        fail,
        guard,
      };
      guard(() => {
        if (create) {
          operation(context);
          return;
        }
        const settings = context.meta.get("settings");
        settings.onsuccess = () =>
          guard(() => {
            if (
              !localProfileSettingsSchema.safeParse(settings.result).success
            ) {
              fail("disabled");
              return;
            }
            operation(context);
          });
      });
    } catch (error) {
      db.close();
      resolve({ ok: false, error: toLocalProfileErrorCode(error) });
    }
  });
}
export async function getLocalProfileAvailability(
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileAvailability> {
  const result = await transaction(
    options,
    "readonly",
    false,
    false,
    (context) => context.done(undefined),
  );
  if (result.ok) return "enabled";
  return result.error === "disabled" || result.error === "unsupported_version"
    ? result.error
    : "unavailable";
}
export function enableLocalProfiles(
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<{ enabledAt: string }>> {
  return transaction(options, "readwrite", true, true, (context) => {
    const request = context.meta.get("settings");
    request.onsuccess = () =>
      context.guard(() => {
        const existing = localProfileSettingsSchema.safeParse(request.result);
        if (existing.success) {
          context.done({ enabledAt: existing.data.enabledAt });
          return;
        }
        const settings = localProfileSettingsSchema.safeParse({
          key: "settings",
          enabledAt: now(options),
          storageSchemaVersion: LOCAL_PROFILE_SETTINGS_VERSION,
        });
        if (!settings.success) {
          context.fail("invalid");
          return;
        }
        context.meta.put(settings.data);
        context.done({ enabledAt: settings.data.enabledAt }, true);
      });
  });
}
function listItem(
  record: LocalProfileRecord,
  id: string,
): LocalProfileListItem {
  const profile = (record.draft ?? record.confirmed)!.profile;
  const review = record.confirmed?.profile.privacyReview;
  const exports = [...record.exports].sort(
    (a, b) => Date.parse(b.exportedAt) - Date.parse(a.exportedAt),
  );
  const latest = exports[0];
  return {
    kind: "record",
    id,
    revision: record.revision,
    origin: record.origin,
    title: profile.profileTitle,
    schoolLevel: profile.metadata.schoolLevel,
    role: profile.metadata.role,
    ...(profile.metadata.teachingSubject === undefined
      ? {}
      : { teachingSubject: profile.metadata.teachingSubject }),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    confirmedAt: record.confirmed?.confirmedAt ?? null,
    hasDraft: record.draft !== null,
    versionCount: record.confirmed ? 1 + record.history.length : 0,
    lastExport: latest
      ? {
          target: latest.target,
          format: latest.format,
          exportedAt: latest.exportedAt,
        }
      : null,
    outdatedExportTargets: exports
      .filter((item) => item.confirmedAt !== record.confirmed?.confirmedAt)
      .map((item) => item.target),
    privacyStatus: !review
      ? null
      : review.status === "clear"
        ? "clear"
        : isUnverifiedPrivacyReview(review)
          ? "unverified"
          : "warning",
  };
}
export function listLocalProfiles(
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<LocalProfileListItem[]>> {
  return transaction(options, "readonly", false, false, (context) => {
    const items: LocalProfileListItem[] = [];
    const cursor = context.profiles.openCursor();
    cursor.onsuccess = () =>
      context.guard(() => {
        const current = cursor.result;
        if (!current) {
          items.sort((a, b) =>
            a.kind === "record"
              ? b.kind === "record"
                ? b.updatedAt.localeCompare(a.updatedAt)
                : -1
              : b.kind === "record"
                ? 1
                : 0,
          );
          context.done(items);
          return;
        }
        const id =
          typeof current.primaryKey === "string" ? current.primaryKey : null;
        const parsed = migrateLocalProfileRecord(current.value);
        items.push(
          parsed.ok && id !== null
            ? listItem(parsed.record, id)
            : {
                kind:
                  !parsed.ok && parsed.error === "unsupported_version"
                    ? "unsupported"
                    : "corrupted",
                id,
              },
        );
        current.continue();
      });
  });
}
function readRecord<T>(
  context: TransactionContext<T>,
  id: string,
  callback: (record: LocalProfileRecord) => void,
): void {
  const request = context.profiles.get(id);
  request.onsuccess = () =>
    context.guard(() => {
      if (request.result === undefined) {
        context.fail("not_found");
        return;
      }
      const parsed = migrateLocalProfileRecord(request.result);
      if (!parsed.ok) {
        context.fail(parsed.error);
        return;
      }
      callback(parsed.record);
    });
}
export function getLocalProfile(
  id: string,
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<LocalProfileRecord>> {
  return transaction(options, "readonly", false, false, (context) =>
    readRecord(context, id, (record) => context.done(record)),
  );
}
type CreateInput =
  | {
      origin: "interview";
      confirmed: ConfirmedSnapshot;
      suggestedTags: readonly SuggestedTag[];
    }
  | {
      origin: "import";
      draft: DraftSnapshot;
      suggestedTags: readonly SuggestedTag[];
    };
export function createLocalProfile(
  input: CreateInput,
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<{ id: string; revision: 1; savedAt: string }>> {
  return transaction(options, "readwrite", false, true, (context) => {
    const count = context.profiles.count();
    count.onsuccess = () =>
      context.guard(() => {
        if (count.result >= MAX_LOCAL_PROFILES) {
          context.fail("limit_reached");
          return;
        }
        const id = (options?.randomId ?? (() => crypto.randomUUID()))();
        const savedAt = now(options);
        const parsed = localProfileRecordSchema.safeParse({
          id,
          storageSchemaVersion: LOCAL_PROFILE_STORAGE_SCHEMA_VERSION,
          createdAt: savedAt,
          updatedAt: savedAt,
          revision: 1,
          origin: input.origin,
          suggestedTags: mergeSuggestedTags(input.suggestedTags),
          confirmed: input.origin === "interview" ? input.confirmed : null,
          draft: input.origin === "import" ? input.draft : null,
          history: [],
          exports: [],
        });
        if (!parsed.success) {
          context.fail("invalid");
          return;
        }
        context.profiles.add(parsed.data);
        context.done({ id, revision: 1, savedAt }, true);
      });
  });
}
type RevisionInput = {
  expectedRevision: number;
  suggestedTags?: readonly SuggestedTag[];
};
function update<T>(
  id: string,
  input: RevisionInput,
  options: LocalProfileRepositoryOptions | undefined,
  strict: boolean,
  apply: (record: LocalProfileRecord, context: TransactionContext<T>) => void,
): Promise<LocalProfileResult<T>> {
  return transaction(options, "readwrite", false, strict, (context) =>
    readRecord(context, id, (record) => {
      if (record.revision !== input.expectedRevision) {
        context.fail("conflict");
        return;
      }
      apply(record, context);
    }),
  );
}
function putRecord<T>(
  record: LocalProfileRecord,
  context: TransactionContext<T>,
  value: T,
): void {
  const parsed = localProfileRecordSchema.safeParse(record);
  if (!parsed.success) {
    context.fail("invalid");
    return;
  }
  context.profiles.put(parsed.data);
  context.done(value, true);
}
export function saveDraft(
  id: string,
  input: RevisionInput & { draft: DraftSnapshot },
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<{ revision: number; savedAt: string }>> {
  return update(id, input, options, false, (record, context) => {
    record.draft = input.draft;
    record.suggestedTags = mergeSuggestedTags(
      record.suggestedTags,
      input.suggestedTags ?? [],
    );
    record.revision++;
    record.updatedAt = now(options);
    putRecord(record, context, {
      revision: record.revision,
      savedAt: record.updatedAt,
    });
  });
}
export function saveConfirmed(
  id: string,
  input: RevisionInput & { confirmed: ConfirmedSnapshot },
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<{ revision: number; savedAt: string }>> {
  return update(id, input, options, true, (record, context) => {
    const incoming = localProfileRecordSchema.shape.confirmed.safeParse(
      input.confirmed,
    );
    if (!incoming.success || !incoming.data) {
      context.fail("invalid");
      return;
    }
    const savedAt = now(options);
    if (
      record.confirmed &&
      sameProfileContent(record.confirmed.profile, incoming.data.profile)
    ) {
      record.confirmed = {
        profile: incoming.data.profile,
        confirmedAt: record.confirmed.confirmedAt,
      };
    } else {
      if (record.confirmed) {
        record.history.unshift({ ...record.confirmed, replacedAt: savedAt });
        record.history = record.history.slice(0, MAX_PROFILE_HISTORY);
      }
      record.confirmed = incoming.data;
    }
    record.draft = null;
    record.suggestedTags = mergeSuggestedTags(
      record.suggestedTags,
      input.suggestedTags ?? [],
    );
    record.revision++;
    record.updatedAt = savedAt;
    putRecord(record, context, {
      revision: record.revision,
      savedAt: record.updatedAt,
    });
  });
}
const versionInputSchema = z.object({ confirmedAt: z.iso.datetime() }).strict();
const restoreInputSchema = versionInputSchema
  .extend({ expectedRevision: z.number().int().min(1) })
  .strict();
const exportInputSchema = z
  .object({
    target: exportTargetSchema,
    format: profileExportFormatSchema,
    confirmedAt: z.iso.datetime(),
  })
  .strict();

export function restoreVersion(
  id: string,
  input: { confirmedAt: string; expectedRevision: number },
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<{ revision: number; savedAt: string }>> {
  const parsed = restoreInputSchema.safeParse(input);
  if (!parsed.success) return Promise.resolve({ ok: false, error: "invalid" });
  return update(id, parsed.data, options, true, (record, context) => {
    if (record.draft) {
      context.fail("draft_exists");
      return;
    }
    const selected = record.history.find(
      (item) => item.confirmedAt === parsed.data.confirmedAt,
    );
    if (!selected || !record.confirmed) {
      context.fail("not_found");
      return;
    }
    const savedAt = now(options);
    record.history = [
      { ...record.confirmed, replacedAt: savedAt },
      ...record.history.filter(
        (item) => item.confirmedAt !== selected.confirmedAt,
      ),
    ];
    record.confirmed = {
      profile: selected.profile,
      confirmedAt: selected.confirmedAt,
    };
    record.revision++;
    record.updatedAt = savedAt;
    putRecord(record, context, { revision: record.revision, savedAt });
  });
}

export function deleteVersion(
  id: string,
  input: { confirmedAt: string },
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<{ deleted: boolean }>> {
  const parsed = versionInputSchema.safeParse(input);
  if (!parsed.success) return Promise.resolve({ ok: false, error: "invalid" });
  return transaction(options, "readwrite", false, true, (context) =>
    readRecord(context, id, (record) => {
      const history = record.history.filter(
        (item) => item.confirmedAt !== parsed.data.confirmedAt,
      );
      if (history.length === record.history.length) {
        context.done({ deleted: false });
        return;
      }
      record.history = history;
      putRecord(record, context, { deleted: true });
    }),
  );
}

export function recordExport(
  id: string,
  input: { target: string; format: ProfileExportFormat; confirmedAt: string },
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<{ recorded: boolean }>> {
  const parsed = exportInputSchema.safeParse(input);
  if (!parsed.success) return Promise.resolve({ ok: false, error: "invalid" });
  return transaction(options, "readwrite", false, true, (context) =>
    readRecord(context, id, (record) => {
      if (record.confirmed?.confirmedAt !== parsed.data.confirmedAt) {
        context.done({ recorded: false });
        return;
      }
      record.exports = [
        { ...parsed.data, exportedAt: now(options) },
        ...record.exports.filter((item) => item.target !== parsed.data.target),
      ]
        .sort((a, b) => Date.parse(b.exportedAt) - Date.parse(a.exportedAt))
        .slice(0, MAX_PROFILE_EXPORTS);
      putRecord(record, context, { recorded: true });
    }),
  );
}
export function discardDraft(
  id: string,
  input: { expectedRevision: number },
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<{ deleted: boolean; revision: number | null }>> {
  return update(id, input, options, true, (record, context) => {
    if (!record.draft) {
      context.done({ deleted: false, revision: record.revision });
      return;
    }
    if (!record.confirmed) {
      context.profiles.delete(id);
      context.done({ deleted: true, revision: null }, true);
      return;
    }
    record.draft = null;
    record.revision++;
    record.updatedAt = now(options);
    putRecord(record, context, { deleted: false, revision: record.revision });
  });
}
export function deleteLocalProfile(
  id: string,
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<{ deleted: boolean }>> {
  return transaction(options, "readwrite", false, true, (context) => {
    const request = context.profiles.count(id);
    request.onsuccess = () =>
      context.guard(() => {
        if (!request.result) {
          context.done({ deleted: false });
          return;
        }
        context.profiles.delete(id);
        context.done({ deleted: true }, true);
      });
  });
}
export async function disableAndDeleteAllLocalProfiles(
  deleteOptions?: { blockedTimeoutMs?: number },
  options?: LocalProfileRepositoryOptions,
): Promise<LocalProfileResult<void>> {
  const factory = factoryFor(options);
  if (!factory) return { ok: false, error: "unavailable" };
  const result = await deleteLocalProfileDatabase(factory, deleteOptions);
  if (!result.ok) return result;
  notify(options);
  return { ok: true, value: undefined };
}
