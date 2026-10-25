import { LOCAL_PROFILE_DB_NAME, LOCAL_PROFILE_DB_VERSION } from "./schema";

export const PROFILE_STORE = "profiles";
export const META_STORE = "meta";
export const PROFILE_UPDATED_AT_INDEX = "updatedAt";
export type LocalProfileIdbFactory = Pick<
  IDBFactory,
  "open" | "deleteDatabase"
> & { databases?: () => Promise<IDBDatabaseInfo[]> };
export type OpenDatabaseResult =
  | { ok: true; db: IDBDatabase }
  | { ok: false; error: "unavailable" | "disabled" | "unsupported_version" };

export function browserIdbFactory(): LocalProfileIdbFactory | null {
  try {
    return typeof indexedDB === "undefined" ? null : indexedDB;
  } catch {
    return null;
  }
}

function upgradeDatabase(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(PROFILE_STORE)) {
      const profiles = db.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      profiles.createIndex(PROFILE_UPDATED_AT_INDEX, "updatedAt", {
        unique: false,
      });
    }
    if (!db.objectStoreNames.contains(META_STORE))
      db.createObjectStore(META_STORE, { keyPath: "key" });
  }
}
function openDatabase(
  factory: LocalProfileIdbFactory,
  create: boolean,
): Promise<OpenDatabaseResult> {
  return new Promise((resolve) => {
    let disabled = false;
    try {
      const request = factory.open(
        LOCAL_PROFILE_DB_NAME,
        LOCAL_PROFILE_DB_VERSION,
      );
      request.onupgradeneeded = (event) => {
        if (!create && event.oldVersion === 0) {
          disabled = true;
          request.transaction?.abort();
          return;
        }
        upgradeDatabase(request.result, event.oldVersion);
      };
      request.onerror = () =>
        resolve({
          ok: false,
          error: disabled
            ? "disabled"
            : request.error?.name === "VersionError"
              ? "unsupported_version"
              : "unavailable",
        });
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve({ ok: true, db });
      };
    } catch {
      resolve({ ok: false, error: "unavailable" });
    }
  });
}
export async function openExistingDatabase(
  factory: LocalProfileIdbFactory,
): Promise<OpenDatabaseResult> {
  if (factory.databases) {
    try {
      if (
        !(await factory.databases()).some(
          (db) => db.name === LOCAL_PROFILE_DB_NAME,
        )
      )
        return { ok: false, error: "disabled" };
    } catch {
      /* Fall back to an aborted creation transaction. */
    }
  }
  return openDatabase(factory, false);
}
export function openOrCreateDatabase(
  factory: LocalProfileIdbFactory,
): Promise<OpenDatabaseResult> {
  return openDatabase(factory, true);
}
export function deleteLocalProfileDatabase(
  factory: LocalProfileIdbFactory,
  options?: { blockedTimeoutMs?: number },
): Promise<{ ok: true } | { ok: false; error: "blocked" | "unavailable" }> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = factory.deleteDatabase(LOCAL_PROFILE_DB_NAME);
      request.onsuccess = () => {
        clearTimeout(timer);
        resolve({ ok: true });
      };
      request.onerror = () => {
        clearTimeout(timer);
        resolve({ ok: false, error: "unavailable" });
      };
      request.onblocked = () => {
        timer ??= setTimeout(
          () => resolve({ ok: false, error: "blocked" }),
          options?.blockedTimeoutMs ?? 3000,
        );
      };
    } catch {
      clearTimeout(timer);
      resolve({ ok: false, error: "unavailable" });
    }
  });
}
