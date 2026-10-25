"use client";
import { Button } from "@/components/ui/button";
import type { LocalProfileLink } from "@/components/layout/interview-session-provider";
import { useLocalProfiles } from "./local-profiles-provider";
import { LOCAL_PROFILE_ERROR_MESSAGES } from "./local-save-panel";
import { ConfirmLocalAction } from "./local-profile-delete-controls";
export function LocalDraftStatus({
  link,
  onDiscard,
  onOverwrite,
  onReload,
  onRetry,
}: {
  link: LocalProfileLink | null;
  onDiscard: () => void;
  onOverwrite: () => void;
  onReload: () => void;
  onRetry: () => void;
}) {
  const { writeStatus } = useLocalProfiles();
  if (!link) return null;
  const status =
    writeStatus?.recordId === link.recordId &&
    writeStatus.openedAt === link.openedAt
      ? writeStatus
      : null;
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p aria-live="polite">
        {status?.phase === "saving"
          ? "저장 중"
          : status?.phase === "saved"
            ? `이 브라우저에 초안 저장됨${status.savedAt ? ` · ${new Date(status.savedAt).toLocaleTimeString("ko-KR")}` : ""}`
            : status?.phase === "error"
              ? `저장하지 못함: ${LOCAL_PROFILE_ERROR_MESSAGES[status.error ?? "unavailable"]}`
              : "편집하면 이 브라우저에 초안을 자동 저장합니다."}
      </p>
      <div className="flex flex-wrap gap-2">
        <ConfirmLocalAction
          label="초안 버리기"
          description="이 편집 초안을 버리고 확정본으로 돌아갑니다. 확정본이 없는 가져온 문서는 삭제됩니다."
          onConfirm={onDiscard}
        />
        {status?.error === "conflict" ? (
          <>
            <ConfirmLocalAction
              label="이 탭 내용으로 저장"
              description="다른 탭의 최신 편집 초안을 이 탭의 내용으로 덮어씁니다. 기존 확정본은 유지됩니다."
              onConfirm={onOverwrite}
            />
            <Button variant="outline" onClick={onReload}>
              저장된 최신 내용 불러오기
            </Button>
          </>
        ) : status?.phase === "error" ? (
          <Button variant="outline" onClick={onRetry}>
            초안 저장 다시 시도
          </Button>
        ) : null}
      </div>
    </div>
  );
}
