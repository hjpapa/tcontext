import {
  storedInterviewProgressSchema,
  toStoredInterviewProgress,
  type StoredInterviewProgress,
} from "./schema";

import type { InterviewState } from "@/types/interview";

export const LOCAL_PROGRESS_KEY = "tcontext:interview-progress:local:v1";
export const LOCAL_RESUME_PREFERENCE_KEY =
  "tcontext:interview-local-resume-enabled:v1";

function browserLocalStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function isLocalResumeEnabled(
  storage: Storage | undefined = browserLocalStorage(),
): boolean {
  return storage?.getItem(LOCAL_RESUME_PREFERENCE_KEY) === "true";
}

export function setLocalResumeEnabled(
  enabled: boolean,
  storage: Storage | undefined = browserLocalStorage(),
): void {
  if (!storage) return;
  if (enabled) {
    storage.setItem(LOCAL_RESUME_PREFERENCE_KEY, "true");
  } else {
    storage.removeItem(LOCAL_RESUME_PREFERENCE_KEY);
    storage.removeItem(LOCAL_PROGRESS_KEY);
  }
}

/**
 * Local persistence is off by default and cannot be written until the teacher
 * explicitly enables the preference.
 */
export function saveLocalProgress(
  state: InterviewState,
  storage: Storage | undefined = browserLocalStorage(),
): boolean {
  if (!storage || !isLocalResumeEnabled(storage)) return false;
  storage.setItem(
    LOCAL_PROGRESS_KEY,
    JSON.stringify(toStoredInterviewProgress(state)),
  );
  return true;
}

export function loadLocalProgress(
  storage: Storage | undefined = browserLocalStorage(),
): StoredInterviewProgress | null {
  if (!storage || !isLocalResumeEnabled(storage)) return null;
  const serialized = storage.getItem(LOCAL_PROGRESS_KEY);
  if (!serialized) return null;

  try {
    return storedInterviewProgressSchema.parse(JSON.parse(serialized));
  } catch {
    storage.removeItem(LOCAL_PROGRESS_KEY);
    return null;
  }
}

export function clearLocalProgress(
  storage: Storage | undefined = browserLocalStorage(),
): void {
  storage?.removeItem(LOCAL_PROGRESS_KEY);
}

export function clearAllLocalData(
  storage: Storage | undefined = browserLocalStorage(),
): void {
  if (!storage) return;
  storage.removeItem(LOCAL_PROGRESS_KEY);
  storage.removeItem(LOCAL_RESUME_PREFERENCE_KEY);
}
