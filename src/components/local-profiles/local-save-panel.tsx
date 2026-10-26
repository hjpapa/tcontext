"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createLocalProfile,
  enableLocalProfiles,
  getLocalProfile,
  saveConfirmed,
  type LocalProfileErrorCode,
} from "@/lib/storage/profiles/repository";
import { MAX_LOCAL_PROFILES } from "@/lib/storage/profiles/schema";
import { toConfirmedSnapshot } from "@/lib/storage/profiles/serialize";
import { useLocalProfiles } from "./local-profiles-provider";
import { ConfirmLocalAction } from "./local-profile-delete-controls";

export const LOCAL_PROFILE_ERROR_MESSAGES: Record<
  LocalProfileErrorCode,
  string
> = {
  unavailable:
    "이 브라우저에서 저장소를 사용할 수 없습니다. JSON 백업을 내려받아 보관해 주세요.",
  disabled:
    "로컬 저장이 꺼져 있습니다. 저장 동의를 확인하거나 JSON 백업을 내려받아 주세요.",
  unsupported_version:
    "더 새로운 버전의 저장 데이터입니다. 최신 TContext에서 열어 주세요.",
  quota_exceeded:
    "브라우저 저장 공간이 부족합니다. JSON 백업을 먼저 내려받고 불필요한 기록을 지워 주세요.",
  conflict:
    "다른 탭에서 수정한 기록입니다. 저장된 최신 내용을 확인한 뒤 다시 저장해 주세요.",
  corrupted:
    "손상된 기록을 읽을 수 없습니다. JSON 백업에서 복원하거나 해당 기록을 삭제해 주세요.",
  not_found:
    "저장된 기록을 찾지 못했습니다. 내 프로파일 목록을 새로 확인해 주세요.",
  limit_reached:
    "프로파일은 10개까지 보관할 수 있습니다. JSON 백업 후 불필요한 기록을 삭제해 주세요.",
  blocked:
    "다른 탭이 저장소를 사용 중입니다. 다른 TContext 탭을 닫고 삭제를 다시 시도해 주세요.",
  invalid:
    "저장할 문서가 올바르지 않습니다. 다시 검토하거나 JSON 백업을 확인해 주세요.",
};
export function LocalSavePanel() {
  const { profile, suggestedTags, localProfileLink, setLocalProfileLink } =
    useInterviewSession();
  const { availability, items, options, refresh, writeStatus, setWriteStatus } =
    useLocalProfiles();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  useEffect(() => {
    if (availability === "enabled") void refresh();
  }, [availability, refresh]);
  if (availability === "unknown" || !profile) return null;
  const linked = localProfileLink && availability === "enabled";
  const full = items.length >= MAX_LOCAL_PROFILES;
  const savedItem = items.find(
    (item) => item.kind === "record" && item.id === localProfileLink?.recordId,
  );
  const currentWrite =
    writeStatus?.recordId === localProfileLink?.recordId &&
    writeStatus?.openedAt === localProfileLink?.openedAt &&
    writeStatus?.kind === "confirmed"
      ? writeStatus
      : null;
  const savedTime =
    currentWrite?.savedAt ??
    savedAt ??
    (savedItem?.kind === "record" ? savedItem.updatedAt : null);
  const save = async () => {
    if (busy || (availability === "disabled" && !consent)) return;
    setBusy(true);
    setError(null);
    try {
      if (availability === "disabled") {
        const enabled = await enableLocalProfiles(options);
        if (!enabled.ok) {
          setError(LOCAL_PROFILE_ERROR_MESSAGES[enabled.error]);
          return;
        }
      }
      const snapshot = toConfirmedSnapshot(profile, new Date().toISOString());
      if (!snapshot.ok) {
        setError(
          "최종 검사를 마친 문서만 저장할 수 있습니다. 다시 검토해 주세요.",
        );
        return;
      }
      const result = await createLocalProfile(
        { origin: "interview", confirmed: snapshot.snapshot, suggestedTags },
        options,
      );
      if (!result.ok) {
        setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
        return;
      }
      setLocalProfileLink({
        recordId: result.value.id,
        revision: result.value.revision,
        baseline: structuredClone(snapshot.snapshot.profile),
        openedAt: Date.now(),
      });
      setSavedAt(result.value.savedAt);
    } finally {
      setBusy(false);
      await refresh();
    }
  };
  const overwrite = async () => {
    if (!localProfileLink || busy) return;
    const link = localProfileLink;
    const status = {
      recordId: link.recordId,
      openedAt: link.openedAt,
      kind: "confirmed" as const,
    };
    setBusy(true);
    setWriteStatus({ ...status, phase: "saving" });
    try {
      const current = await getLocalProfile(link.recordId, options);
      if (!current.ok) {
        setWriteStatus({ ...status, phase: "error", error: current.error });
        return;
      }
      const snapshot = toConfirmedSnapshot(profile, new Date().toISOString());
      if (!snapshot.ok) {
        setWriteStatus({ ...status, phase: "error", error: "invalid" });
        return;
      }
      const result = await saveConfirmed(
        link.recordId,
        {
          confirmed: snapshot.snapshot,
          suggestedTags,
          expectedRevision: current.value.revision,
        },
        options,
      );
      if (!result.ok) {
        setWriteStatus({ ...status, phase: "error", error: result.error });
        return;
      }
      setLocalProfileLink((active) =>
        active?.recordId === link.recordId && active.openedAt === link.openedAt
          ? {
              ...active,
              revision: result.value.revision,
              baseline: structuredClone(snapshot.snapshot.profile),
            }
          : active,
      );
      setWriteStatus({
        ...status,
        phase: "saved",
        savedAt: result.value.savedAt,
      });
      await refresh();
    } catch {
      setWriteStatus({ ...status, phase: "error", error: "unavailable" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      aria-labelledby="local-save-title"
      className="space-y-4 rounded-2xl border p-5"
      data-print-hidden="true"
    >
      <h2 id="local-save-title" className="text-xl font-bold">
        이 브라우저에 보관하기 (서버로 보내지 않음)
      </h2>
      <p className="text-muted-foreground text-sm leading-6">
        이 브라우저에만 저장하며 서버로 보내지 않습니다. 공용 기기에서는 저장에
        주의해 주세요. 브라우저 데이터를 지우면 사라질 수 있으므로 JSON 백업도
        권장합니다.
      </p>
      {availability === "unavailable" ||
      availability === "unsupported_version" ? (
        <p role="status">{LOCAL_PROFILE_ERROR_MESSAGES[availability]}</p>
      ) : linked ? (
        <div className="space-y-2">
          {!currentWrite || currentWrite.phase === "saved" ? (
            <p role="status">
              저장됨
              {savedTime
                ? ` · ${new Date(savedTime).toLocaleString("ko-KR")}`
                : ""}
            </p>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/profiles">내 프로파일 열기</Link>
          </Button>
        </div>
      ) : (
        <>
          {availability === "disabled" ? (
            <label className="flex items-start gap-3 text-sm leading-6">
              <Checkbox
                checked={consent}
                onCheckedChange={(value) => setConsent(value === true)}
              />
              <span>이 브라우저에 프로파일을 저장하는 데 동의합니다.</span>
            </label>
          ) : null}
          {full ? (
            <p role="status">{LOCAL_PROFILE_ERROR_MESSAGES.limit_reached}</p>
          ) : (
            <Button
              disabled={busy || (availability === "disabled" && !consent)}
              onClick={() => void save()}
            >
              {busy ? "저장 중…" : "이 브라우저에 저장"}
            </Button>
          )}
        </>
      )}
      {currentWrite?.phase === "saving" ? (
        <p role="status">확정본 저장 중…</p>
      ) : null}
      {currentWrite?.phase === "error" ? (
        <div className="space-y-3">
          <h3 className="font-bold">
            최신 확정본을 이 브라우저에 저장하지 못했습니다
          </h3>
          <p role="alert">
            {LOCAL_PROFILE_ERROR_MESSAGES[currentWrite.error ?? "unavailable"]}{" "}
            Markdown·JSON 다운로드는 계속 사용할 수 있습니다.
          </p>
          {currentWrite.error === "conflict" ? (
            <ConfirmLocalAction
              label="이 확정본으로 덮어쓰기"
              confirmLabel="덮어쓰기"
              destructive
              description="다른 탭에서 저장한 내용이 이 확정본으로 바뀝니다."
              onConfirm={() => void overwrite()}
            />
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
