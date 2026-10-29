"use client";

import { useCallback } from "react";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { useLocalProfiles } from "@/components/local-profiles/local-profiles-provider";
import { sameProfileContent } from "@/lib/profile/versions";
import {
  getLocalProfile,
  recordExport,
} from "@/lib/storage/profiles/repository";
import type { ProfileExportFormat } from "@/lib/storage/profiles/schema";

export function useRecordExport(): (
  target: string,
  format: ProfileExportFormat,
) => void {
  const { profile, localProfileLink } = useInterviewSession();
  const { availability, options, refresh } = useLocalProfiles();
  return useCallback(
    (target: string, format: ProfileExportFormat): void => {
      if (availability !== "enabled" || !profile || !localProfileLink) return;
      void (async () => {
        try {
          const result = await getLocalProfile(
            localProfileLink.recordId,
            options,
          );
          const confirmed = result.ok ? result.value.confirmed : null;
          if (!confirmed || !sameProfileContent(confirmed.profile, profile))
            return;
          const recorded = await recordExport(
            localProfileLink.recordId,
            { target, format, confirmedAt: confirmed.confirmedAt },
            options,
          );
          if (recorded.ok && recorded.value.recorded) await refresh();
        } catch {
          // Export tracking is best effort and never changes export feedback.
        }
      })();
    },
    [availability, profile, localProfileLink, options, refresh],
  );
}
