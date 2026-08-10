"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { SuggestedTag } from "@/lib/ai/schemas/profile";
import {
  clearLocalProgress,
  isLocalResumeEnabled,
  loadLocalProgress,
  saveLocalProgress,
  setLocalResumeEnabled,
} from "@/lib/storage/local";
import { restoreInterviewProgress } from "@/lib/storage/restore";
import {
  clearSessionProgress,
  loadSessionProgress,
  saveSessionProgress,
} from "@/lib/storage/session";
import type { InterviewState } from "@/types/interview";
import type { TeacherContextProfile } from "@/types/profile";

export type ContributionReceipt = {
  submissionId: string;
  deletionToken: string;
  createdAt: string;
  retentionUntil: string;
};

export type RestoredProgressNotice = {
  source: "session" | "device";
  previousCompletedQuestionCount: number;
  restoredQuestionNumber: number;
};

type InterviewSessionValue = {
  interview: InterviewState | null;
  profile: TeacherContextProfile | null;
  suggestedTags: SuggestedTag[];
  markdown: string;
  contributionReceipt: ContributionReceipt | null;
  deviceProgressEnabled: boolean;
  progressHydrated: boolean;
  restoredProgress: RestoredProgressNotice | null;
  setInterview: (interview: InterviewState | null) => void;
  setProfile: (profile: TeacherContextProfile | null) => void;
  setSuggestedTags: (tags: SuggestedTag[]) => void;
  setMarkdown: (markdown: string) => void;
  setContributionReceipt: (receipt: ContributionReceipt | null) => void;
  setDeviceProgressEnabled: (enabled: boolean) => void;
  clearBrowserRecords: () => void;
};

const InterviewSessionContext = createContext<InterviewSessionValue | null>(
  null,
);

const DEVICE_PROGRESS_EVENT = "tcontext:device-progress-change";

function subscribeToDeviceProgress(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(DEVICE_PROGRESS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(DEVICE_PROGRESS_EVENT, onStoreChange);
  };
}

function readDeviceProgressPreference() {
  try {
    return isLocalResumeEnabled();
  } catch {
    return false;
  }
}

function readServerDeviceProgressPreference() {
  return false;
}

function subscribeToHydration() {
  return () => {};
}

function readClientHydration() {
  return true;
}

function readServerHydration() {
  return false;
}

type InitialProgress = {
  interview: InterviewState;
  notice: RestoredProgressNotice;
};

function readInitialProgress(): InitialProgress | null {
  if (typeof window === "undefined") return null;

  try {
    const sessionProgress = loadSessionProgress();
    if (sessionProgress) {
      const restored = restoreInterviewProgress(sessionProgress);
      if (!restored) {
        clearSessionProgress();
        clearLocalProgress();
        return null;
      }
      return {
        interview: restored.interview,
        notice: {
          source: "session",
          previousCompletedQuestionCount:
            restored.previousCompletedQuestionCount,
          restoredQuestionNumber: restored.restoredQuestionNumber,
        },
      };
    }

    const localProgress = loadLocalProgress();
    if (!localProgress) return null;
    const restored = restoreInterviewProgress(localProgress);
    if (!restored) {
      clearLocalProgress();
      return null;
    }
    return {
      interview: restored.interview,
      notice: {
        source: "device",
        previousCompletedQuestionCount: restored.previousCompletedQuestionCount,
        restoredQuestionNumber: restored.restoredQuestionNumber,
      },
    };
  } catch {
    // Web Storage may be unavailable in hardened/private browser modes.
    return null;
  }
}

function notifyDeviceProgressChanged() {
  window.dispatchEvent(new Event(DEVICE_PROGRESS_EVENT));
}

export function InterviewSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [initialProgress] = useState(readInitialProgress);
  const [interview, setInterviewState] = useState<InterviewState | null>(
    initialProgress?.interview ?? null,
  );
  const [restoredProgress, setRestoredProgress] =
    useState<RestoredProgressNotice | null>(initialProgress?.notice ?? null);
  const [profile, setProfile] = useState<TeacherContextProfile | null>(null);
  const [suggestedTags, setSuggestedTags] = useState<SuggestedTag[]>([]);
  const [markdown, setMarkdown] = useState("");
  const [contributionReceipt, setContributionReceipt] =
    useState<ContributionReceipt | null>(null);
  const deviceProgressEnabled = useSyncExternalStore(
    subscribeToDeviceProgress,
    readDeviceProgressPreference,
    readServerDeviceProgressPreference,
  );
  const progressHydrated = useSyncExternalStore(
    subscribeToHydration,
    readClientHydration,
    readServerHydration,
  );

  const setInterview = useCallback((nextInterview: InterviewState | null) => {
    setInterviewState(nextInterview);
    if (!nextInterview) setRestoredProgress(null);
  }, []);

  useEffect(() => {
    if (!interview) return;
    try {
      saveSessionProgress(interview);
      saveLocalProgress(interview);
    } catch {
      // Web Storage can be disabled. The in-memory interview remains usable.
    }
  }, [interview]);

  const setDeviceProgressEnabled = useCallback(
    (enabled: boolean) => {
      try {
        setLocalResumeEnabled(enabled);
        if (enabled && interview) saveLocalProgress(interview);
      } catch {}
      notifyDeviceProgressChanged();
    },
    [interview],
  );

  const clearBrowserRecords = useCallback(() => {
    setInterviewState(null);
    setRestoredProgress(null);
    setProfile(null);
    setSuggestedTags([]);
    setMarkdown("");
    setContributionReceipt(null);

    // TContext never stores raw answers. This only removes legacy/non-sensitive
    // TContext preferences if an older build left them behind.
    for (const storageName of ["sessionStorage", "localStorage"] as const) {
      try {
        const storage = window[storageName];
        const keys = Array.from({ length: storage.length }, (_, index) =>
          storage.key(index),
        ).filter((key): key is string => Boolean(key?.startsWith("tcontext:")));
        keys.forEach((key) => storage.removeItem(key));
      } catch {
        // Some privacy modes disable Web Storage entirely. Memory state above
        // is still cleared, which is the only place current answers can exist.
      }
    }
    notifyDeviceProgressChanged();
  }, []);

  const value = useMemo(
    () => ({
      interview,
      profile,
      suggestedTags,
      markdown,
      contributionReceipt,
      deviceProgressEnabled,
      progressHydrated,
      restoredProgress,
      setInterview,
      setProfile,
      setSuggestedTags,
      setMarkdown,
      setContributionReceipt,
      setDeviceProgressEnabled,
      clearBrowserRecords,
    }),
    [
      clearBrowserRecords,
      contributionReceipt,
      deviceProgressEnabled,
      interview,
      markdown,
      profile,
      progressHydrated,
      restoredProgress,
      suggestedTags,
      setInterview,
      setDeviceProgressEnabled,
    ],
  );

  return (
    <InterviewSessionContext.Provider value={value}>
      {children}
    </InterviewSessionContext.Provider>
  );
}

export function useInterviewSession(): InterviewSessionValue {
  const value = useContext(InterviewSessionContext);
  if (!value) {
    throw new Error(
      "useInterviewSession은 InterviewSessionProvider 안에서 사용해야 합니다.",
    );
  }
  return value;
}
