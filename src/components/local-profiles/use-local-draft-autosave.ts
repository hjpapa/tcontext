"use client";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { SuggestedTag } from "@/lib/ai/schemas/profile";
import type { TeacherContextProfile } from "@/types/profile";
import type { LocalProfileLink } from "@/components/layout/interview-session-provider";
import {
  discardDraft,
  getLocalProfile,
  saveConfirmed,
  saveDraft,
  type LocalProfileRepositoryOptions,
  type LocalProfileResult,
  type LocalProfileErrorCode,
} from "@/lib/storage/profiles/repository";
import {
  toConfirmedSnapshot,
  toDraftSnapshot,
} from "@/lib/storage/profiles/serialize";
import type { LocalProfileWriteStatus } from "./local-profiles-provider";

type DraftInput = {
  profile: TeacherContextProfile | null;
  selectedTags: ReadonlySet<string>;
  suggestedTags: readonly SuggestedTag[];
};
type Options = {
  link: LocalProfileLink | null;
  options: LocalProfileRepositoryOptions;
  setLink: Dispatch<SetStateAction<LocalProfileLink | null>>;
  setStatus: Dispatch<SetStateAction<LocalProfileWriteStatus>>;
};
function autosaveController({ link, options, setLink, setStatus }: Options) {
  let revision = link?.revision ?? 0;
  let latest: DraftInput | null = null;
  let pending: DraftInput | null = null;
  let observed = false;
  let finalized = false;
  let paused = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();
  const status = (
    kind: "draft" | "confirmed",
    phase: "saving" | "saved" | "error",
    error?: LocalProfileErrorCode,
    savedAt?: string,
  ) => {
    if (link)
      setStatus({
        recordId: link.recordId,
        openedAt: link.openedAt,
        kind,
        phase,
        ...(error ? { error } : {}),
        ...(savedAt ? { savedAt } : {}),
      });
  };
  const updateLink = (
    nextRevision: number,
    baseline?: TeacherContextProfile,
  ) => {
    revision = nextRevision;
    setLink((current) =>
      current?.recordId === link?.recordId &&
      current?.openedAt === link?.openedAt
        ? {
            ...current!,
            revision: nextRevision,
            ...(baseline ? { baseline: structuredClone(baseline) } : {}),
          }
        : current,
    );
  };
  const enqueue = (kind: "draft" | "confirmed", work: () => Promise<void>) => {
    queue = queue.then(work).catch(() => {
      paused = true;
      status(kind, "error", "unavailable");
    });
    return queue;
  };
  const flush = () => {
    clearTimeout(timer);
    if (!link || finalized || paused || !pending?.profile) return queue;
    const input = pending;
    pending = null;
    return enqueue("draft", async () => {
      if (finalized || paused || !input.profile) return;
      status("draft", "saving");
      const current = await getLocalProfile(link.recordId, options);
      if (!current.ok) {
        paused = true;
        pending = latest;
        status("draft", "error", current.error);
        return;
      }
      const snapshot = toDraftSnapshot({
        profile: input.profile,
        suggestedTags: input.suggestedTags,
        selectedTagKeys: input.selectedTags,
        baseConfirmedAt: current.value.confirmed?.confirmedAt ?? null,
        now: new Date().toISOString(),
      });
      if (!snapshot.ok) {
        status("draft", "error", "invalid");
        return;
      }
      const result = await saveDraft(
        link.recordId,
        {
          draft: snapshot.snapshot,
          suggestedTags: input.suggestedTags,
          expectedRevision: revision,
        },
        options,
      );
      if (!result.ok) {
        paused = true;
        pending = latest;
        status("draft", "error", result.error);
        return;
      }
      updateLink(result.value.revision);
      status("draft", "saved", undefined, result.value.savedAt);
    });
  };
  return {
    observe(input: DraftInput) {
      if (
        latest?.profile === input.profile &&
        latest.selectedTags === input.selectedTags &&
        latest.suggestedTags === input.suggestedTags
      )
        return;
      latest = input;
      if (!observed) {
        observed = true;
        return;
      }
      if (!link || finalized) return;
      pending = input;
      clearTimeout(timer);
      if (!paused) timer = setTimeout(() => void flush(), 800);
    },
    flush,
    finalize(
      profile: TeacherContextProfile,
      suggestedTags: readonly SuggestedTag[],
    ) {
      finalized = true;
      pending = null;
      clearTimeout(timer);
      if (!link) return queue;
      return enqueue("confirmed", async () => {
        status("confirmed", "saving");
        const snapshot = toConfirmedSnapshot(profile, new Date().toISOString());
        if (!snapshot.ok) {
          status("confirmed", "error", "invalid");
          return;
        }
        const result = await saveConfirmed(
          link.recordId,
          {
            confirmed: snapshot.snapshot,
            suggestedTags,
            expectedRevision: revision,
          },
          options,
        );
        if (!result.ok) {
          status("confirmed", "error", result.error);
          return;
        }
        updateLink(result.value.revision, snapshot.snapshot.profile);
        status("confirmed", "saved", undefined, result.value.savedAt);
      });
    },
    retry() {
      paused = false;
      pending = latest;
      return flush();
    },
    async overwrite() {
      if (!link) return;
      await queue;
      const current = await getLocalProfile(link.recordId, options);
      if (!current.ok) {
        status("draft", "error", current.error);
        return;
      }
      revision = current.value.revision;
      paused = false;
      finalized = false;
      pending = latest;
      await flush();
    },
    async discard(): Promise<
      LocalProfileResult<{ deleted: boolean; revision: number | null }>
    > {
      paused = true;
      pending = null;
      clearTimeout(timer);
      await queue;
      if (!link) return { ok: false, error: "disabled" };
      const result = await discardDraft(
        link.recordId,
        { expectedRevision: revision },
        options,
      );
      if (!result.ok) status("draft", "error", result.error);
      return result;
    },
    async settle() {
      clearTimeout(timer);
      pending = null;
      paused = true;
      await queue;
    },
  };
}
export function useLocalDraftAutosave(input: DraftInput & Options) {
  const [controller] = useState(() => autosaveController(input));
  const { profile, selectedTags, suggestedTags } = input;
  useEffect(() => {
    controller.observe({ profile, selectedTags, suggestedTags });
  }, [controller, profile, selectedTags, suggestedTags]);
  useEffect(() => {
    const flush = () => {
      void controller.flush();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      flush();
    };
  }, [controller]);
  return controller;
}
