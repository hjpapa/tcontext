"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { disableAndDeleteAllLocalProfiles } from "@/lib/storage/profiles/repository";
import { useLocalProfiles } from "./local-profiles-provider";
import { LOCAL_PROFILE_ERROR_MESSAGES } from "./local-save-panel";

export function ConfirmLocalAction({
  label,
  description,
  onConfirm,
  children,
  confirmLabel = "계속",
  destructive = false,
}: {
  label: string;
  description: string;
  onConfirm: () => void;
  children?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{children ?? label}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function LocalProfileDeleteControls() {
  const { availability, options, refresh } = useLocalProfiles();
  const { setLocalProfileLink } = useInterviewSession();
  const [message, setMessage] = useState<string | null>(null);
  if (availability === "unknown" || availability === "disabled") return null;
  const remove = async () => {
    const result = await disableAndDeleteAllLocalProfiles(undefined, options);
    if (result.ok) {
      setLocalProfileLink(null);
      setMessage("저장된 프로파일을 모두 삭제하고 로컬 저장을 껐습니다.");
    } else setMessage(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
    await refresh();
  };
  return (
    <div className="space-y-3">
      <ConfirmLocalAction
        label="로컬 저장 끄고 모두 삭제"
        confirmLabel="모두 삭제"
        destructive
        description="이 브라우저의 모든 프로파일과 편집 초안을 삭제합니다. 복구하려면 JSON 백업이 필요합니다. 현재 탭의 문서는 유지됩니다."
        onConfirm={() => void remove()}
      />
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
