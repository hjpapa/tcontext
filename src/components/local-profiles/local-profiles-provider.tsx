"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { LocalProfileIdbFactory } from "@/lib/storage/profiles/database";
import {
  getLocalProfileAvailability,
  listLocalProfiles,
  LOCAL_PROFILES_CHANNEL,
  type LocalProfileAvailability,
  type LocalProfileErrorCode,
  type LocalProfileListItem,
  type LocalProfileRepositoryOptions,
} from "@/lib/storage/profiles/repository";

export type LocalProfileWriteStatus = {
  recordId: string;
  openedAt: number;
  kind: "draft" | "confirmed";
  phase: "saving" | "saved" | "error";
  savedAt?: string;
  error?: LocalProfileErrorCode;
} | null;
type LocalProfilesContextValue = {
  writeStatus: LocalProfileWriteStatus;
  setWriteStatus: Dispatch<SetStateAction<LocalProfileWriteStatus>>;
  availability: LocalProfileAvailability | "unknown";
  items: LocalProfileListItem[];
  options: LocalProfileRepositoryOptions;
  refresh: () => Promise<void>;
};
const LocalProfilesContext = createContext<LocalProfilesContextValue>({
  writeStatus: null,
  setWriteStatus: () => {},
  availability: "unknown",
  items: [],
  options: {},
  refresh: async () => {},
});
export function LocalProfilesProvider({
  children,
  factory,
}: {
  children: ReactNode;
  factory?: LocalProfileIdbFactory | null;
}) {
  const [writeStatus, setWriteStatus] = useState<LocalProfileWriteStatus>(null);
  const [availability, setAvailability] =
    useState<LocalProfilesContextValue["availability"]>("unknown");
  const [items, setItems] = useState<LocalProfileListItem[]>([]);
  const generation = useRef(0);
  const options = useMemo(() => ({ factory }), [factory]);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const next = await getLocalProfileAvailability(options);
    const listed = next === "enabled" ? await listLocalProfiles(options) : null;
    if (current !== generation.current) return;
    setAvailability(next);
    setItems(listed?.ok ? listed.value : []);
  }, [options]);
  const invalidateRefresh = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    let active = true;
    void getLocalProfileAvailability(options).then((next) => {
      if (active) setAvailability(next);
    });
    let channel: BroadcastChannel | undefined;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(LOCAL_PROFILES_CHANNEL);
        channel.onmessage = (event) => {
          if (event.data?.type === "changed") void refresh();
        };
      }
    } catch {
      /* Storage works without cross-tab notifications. */
    }
    return () => {
      active = false;
      invalidateRefresh();
      channel?.close();
    };
  }, [options, refresh, invalidateRefresh]);
  const value = useMemo(
    () => ({
      availability,
      items,
      options,
      refresh,
      writeStatus,
      setWriteStatus,
    }),
    [availability, items, options, refresh, writeStatus],
  );
  return (
    <LocalProfilesContext.Provider value={value}>
      {children}
    </LocalProfilesContext.Provider>
  );
}
export function useLocalProfiles(): LocalProfilesContextValue {
  return useContext(LocalProfilesContext);
}
