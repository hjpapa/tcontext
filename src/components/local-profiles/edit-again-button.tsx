"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
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
} from "@/components/ui/alert-dialog";
import { getLocalProfile } from "@/lib/storage/profiles/repository";
import type { LocalProfileRecord } from "@/lib/storage/profiles/schema";
import { toEditableSession } from "@/lib/storage/profiles/serialize";
import { useLocalProfiles } from "./local-profiles-provider";
import { LOCAL_PROFILE_ERROR_MESSAGES } from "./local-save-panel";

export function EditAgainButton() {
  const { localProfileLink, openProfile } = useInterviewSession();
  const { availability, options } = useLocalProfiles();
  const router = useRouter();
  const [record, setRecord] = useState<LocalProfileRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const edit = async () => {
    if (busy) return;
    setError(null);
    if (!localProfileLink || availability !== "enabled") {
      router.push("/review");
      return;
    }
    setBusy(true);
    try {
      const result = await getLocalProfile(localProfileLink.recordId, options);
      if (!result.ok) setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
      else if (result.value.draft) setRecord(result.value);
      else router.push("/review");
    } finally {
      setBusy(false);
    }
  };
  const resume = () => {
    if (!record) return;
    const session = toEditableSession(record);
    openProfile({
      profile: session.profile,
      suggestedTags: session.suggestedTags,
      mode: "edit",
      link: {
        recordId: session.recordId,
        revision: session.revision,
        baseline: session.baseline,
      },
    });
    router.push("/review");
  };
  return (
    <div className="space-y-3">
      <Button asChild variant="outline">
        <Link
          href="/review"
          aria-disabled={busy}
          onClick={(event) => {
            event.preventDefault();
            void edit();
          }}
        >
          다시 수정하기
        </Link>
      </Button>
      {error ? <p role="alert">{error}</p> : null}
      <AlertDialog
        open={record !== null}
        onOpenChange={(open) => {
          if (!open) setRecord(null);
        }}
      >
        <AlertDialogContent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            resumeRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>편집 중인 초안이 있습니다</AlertDialogTitle>
            <AlertDialogDescription>
              초안을 이어서 수정하거나 확정본에서 새로 시작할 수 있습니다.
              확정본에서 시작하면 첫 수정이 저장되면 기존 초안은 대체됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => router.push("/review")}
            >
              확정본에서 새로 시작
            </AlertDialogAction>
            <AlertDialogAction ref={resumeRef} onClick={resume}>
              초안 이어서 수정
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
