import {
  storedInterviewProgressSchema,
  toStoredInterviewProgress,
  type StoredInterviewProgress,
} from "./schema";

import type { InterviewState } from "@/types/interview";

export const SESSION_PROGRESS_KEY = "tcontext:interview-progress:v1";

function browserSessionStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

export function saveSessionProgress(
  state: InterviewState,
  storage: Storage | undefined = browserSessionStorage(),
): boolean {
  if (!storage) return false;
  const progress = toStoredInterviewProgress(state);
  storage.setItem(SESSION_PROGRESS_KEY, JSON.stringify(progress));
  return true;
}

export function loadSessionProgress(
  storage: Storage | undefined = browserSessionStorage(),
): StoredInterviewProgress | null {
  if (!storage) return null;
  const serialized = storage.getItem(SESSION_PROGRESS_KEY);
  if (!serialized) return null;

  try {
    return storedInterviewProgressSchema.parse(JSON.parse(serialized));
  } catch {
    storage.removeItem(SESSION_PROGRESS_KEY);
    return null;
  }
}

export function clearSessionProgress(
  storage: Storage | undefined = browserSessionStorage(),
): void {
  storage?.removeItem(SESSION_PROGRESS_KEY);
}
