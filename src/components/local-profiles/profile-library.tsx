"use client";
import Link from "next/link";
import { SCHOOL_LEVEL_DISPLAY_LABELS } from "@/content/profile-document";
import { findPlatformGuide } from "@/content/platform-guides";
import { TEACHER_ROLE_LABELS, type TeacherRole } from "@/types/interview";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useInterviewSession,
  type OpenProfileInput,
} from "@/components/layout/interview-session-provider";
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
import {
  deleteLocalProfile,
  discardDraft,
  enableLocalProfiles,
  getLocalProfile,
  type LocalProfileListItem,
} from "@/lib/storage/profiles/repository";
import {
  MAX_LOCAL_PROFILES,
  type LocalProfileRecord,
  type ProfileExportFormat,
} from "@/lib/storage/profiles/schema";
import { toEditableSession } from "@/lib/storage/profiles/serialize";
import { createProfileBackupFile } from "@/lib/storage/profiles/backup";
import { downloadTextFile } from "@/lib/export/download";
import {
  mergeSuggestedTags,
  suggestedTagsFromConfirmedTags,
} from "@/lib/profile/tags";
import { useLocalProfiles } from "./local-profiles-provider";
import { LOCAL_PROFILE_ERROR_MESSAGES } from "./local-save-panel";
import {
  ConfirmLocalAction,
  LocalProfileDeleteControls,
} from "./local-profile-delete-controls";
import { BackupImport } from "./backup-import";

export function toViewSession(
  record: LocalProfileRecord,
  id: string,
): OpenProfileInput | null {
  if (!record.confirmed) return null;
  return {
    profile: record.confirmed.profile,
    suggestedTags: mergeSuggestedTags(
      record.suggestedTags,
      suggestedTagsFromConfirmedTags(record.confirmed.profile.confirmedTags),
    ),
    mode: "view",
    link: {
      recordId: id,
      revision: record.revision,
      baseline: record.confirmed.profile,
    },
  };
}
export function exportTargetLabel(target: string): string {
  return target === "result"
    ? "결과 화면"
    : (findPlatformGuide(target)?.name ?? target);
}
export const EXPORT_FORMAT_LABELS: Record<ProfileExportFormat, string> = {
  full: "전체본",
  core: "핵심본",
  modules: "모듈 선택본",
  "skill-package": "skill 패키지",
};

export function ProfileLibrary() {
  const { availability, items, options, refresh } = useLocalProfiles();
  const { profile, localProfileLink, openProfile, setLocalProfileLink } =
    useInterviewSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState<OpenProfileInput | null>(null);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const open = (input: OpenProfileInput) => {
    openProfile(input);
    router.push(input.mode === "view" ? "/result" : "/review");
  };
  const requestOpen = (input: OpenProfileInput) => {
    if (profile && !localProfileLink) setPending(input);
    else open(input);
  };
  const load = async (id: string, mode: "view" | "edit") => {
    const result = await getLocalProfile(id, options);
    if (!result.ok) {
      setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
      return;
    }
    const record = result.value;
    const viewSession = mode === "view" ? toViewSession(record, id) : null;
    if (viewSession) requestOpen(viewSession);
    else {
      const session = toEditableSession(record);
      requestOpen({
        profile: session.profile,
        suggestedTags: session.suggestedTags,
        mode: "edit",
        link: {
          recordId: id,
          revision: session.revision,
          baseline: session.baseline,
        },
      });
    }
  };
  const remove = async (id: string) => {
    const result = await deleteLocalProfile(id, options);
    if (!result.ok) setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
    else if (localProfileLink?.recordId === id) setLocalProfileLink(null);
    await refresh();
  };
  const discard = async (
    item: Extract<LocalProfileListItem, { kind: "record" }>,
  ) => {
    const result = await discardDraft(
      item.id,
      { expectedRevision: item.revision },
      options,
    );
    if (!result.ok) setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
    else if (result.value.deleted && localProfileLink?.recordId === item.id)
      setLocalProfileLink(null);
    await refresh();
  };
  const backup = async (id: string, kind: "confirmed" | "draft") => {
    const result = await getLocalProfile(id, options);
    if (!result.ok) {
      setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
      return;
    }
    const snapshot = result.value[kind];
    if (!snapshot) return;
    const file = createProfileBackupFile({
      kind,
      profile: snapshot.profile,
      suggestedTags: result.value.suggestedTags,
      recordId: id,
      now: new Date().toISOString(),
    });
    if (!file.ok || !downloadTextFile(file.value, { bom: false }).ok)
      setError("JSON 백업을 내려받지 못했습니다. 다시 시도해 주세요.");
  };
  if (availability === "unknown")
    return <p role="status">로컬 저장 상태 확인 중…</p>;
  return (
    <div className="space-y-6">
      {availability === "disabled" ? (
        <section className="space-y-4 rounded-2xl border p-5">
          <h2 className="text-xl font-bold">이 브라우저에 보관하기</h2>
          <p>
            교사가 켠 경우에만 이 브라우저에 저장하며 서버로 보내지 않습니다.
            공용 기기에서는 주의해 주세요. 브라우저 데이터 삭제 시 사라질 수
            있으니 JSON 백업을 권장합니다.
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            로컬 저장을 켜는 데 동의합니다.
          </label>
          <Button
            disabled={!consent}
            onClick={() => {
              void enableLocalProfiles(options).then(async (result) => {
                if (!result.ok)
                  setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
                await refresh();
              });
            }}
          >
            로컬 저장 켜기
          </Button>
        </section>
      ) : availability === "enabled" ? (
        <>
          <p>
            저장한 프로파일 {items.length}개 / {MAX_LOCAL_PROFILES}개
          </p>
          <ul className="space-y-4">
            {items.map((item, index) => (
              <li
                key={item.id ?? `unknown-${index}`}
                className="space-y-3 rounded-2xl border p-5"
              >
                {item.kind === "record" ? (
                  <>
                    <h2 className="text-xl font-bold break-words">
                      {item.title || "제목 없는 초안"}
                    </h2>
                    <p>
                      {SCHOOL_LEVEL_DISPLAY_LABELS[item.schoolLevel]} ·{" "}
                      {TEACHER_ROLE_LABELS[item.role as TeacherRole] ??
                        item.role}
                    </p>
                    <p className="text-sm">
                      확정:{" "}
                      {item.confirmedAt
                        ? new Date(item.confirmedAt).toLocaleString("ko-KR")
                        : "확정 전"}{" "}
                      · 마지막 수정:{" "}
                      {new Date(item.updatedAt).toLocaleString("ko-KR")}
                    </p>
                    <p className="text-sm">
                      처음 저장{" "}
                      {new Date(item.createdAt).toLocaleString("ko-KR")}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span>버전 {item.versionCount}개</span>
                      {item.confirmedAt ? (
                        <Link
                          className="text-primary inline-flex min-h-10 items-center font-semibold underline"
                          href={`/profiles/versions?record=${item.id}`}
                        >
                          버전 기록
                        </Link>
                      ) : null}
                    </p>
                    {item.lastExport ? (
                      <p className="text-sm break-words">
                        최근 내보낸 기록:{" "}
                        {exportTargetLabel(item.lastExport.target)} ·{" "}
                        {EXPORT_FORMAT_LABELS[item.lastExport.format]} ·{" "}
                        {new Date(item.lastExport.exportedAt).toLocaleString(
                          "ko-KR",
                        )}
                      </p>
                    ) : null}
                    {item.outdatedExportTargets.length > 0 ? (
                      <p className="text-sm">
                        이전 버전을 내보낸 곳{" "}
                        {item.outdatedExportTargets.length}곳
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 text-sm">
                      {item.hasDraft ? <span>편집 중 초안</span> : null}
                      {item.privacyStatus === "warning" ||
                      item.privacyStatus === "unverified" ? (
                        <span>개인정보 경고 문서</span>
                      ) : null}
                      {item.origin === "import" ? (
                        <span>
                          {item.confirmedAt
                            ? "가져온 문서"
                            : "가져온 문서·확정 전"}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={!item.confirmedAt}
                        onClick={() => void load(item.id, "view")}
                      >
                        보기
                      </Button>
                      <Button onClick={() => void load(item.id, "edit")}>
                        수정하기
                      </Button>
                      {item.confirmedAt ? (
                        <Button
                          variant="outline"
                          onClick={() => void backup(item.id, "confirmed")}
                        >
                          확정본 백업
                        </Button>
                      ) : null}
                      {item.hasDraft ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => void backup(item.id, "draft")}
                          >
                            초안 백업
                          </Button>
                          <ConfirmLocalAction
                            label="초안 버리기"
                            confirmLabel="초안 버리기"
                            destructive
                            description="편집 초안을 버립니다. 확정본이 없으면 이 항목도 삭제됩니다."
                            onConfirm={() => void discard(item)}
                          />
                        </>
                      ) : null}
                      <ConfirmLocalAction
                        label="프로파일 삭제"
                        confirmLabel="삭제"
                        destructive
                        description="이 프로파일과 편집 초안을 삭제합니다. 필요한 경우 JSON 백업을 먼저 내려받아 주세요."
                        onConfirm={() => void remove(item.id)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      {item.kind === "corrupted"
                        ? "손상된 기록"
                        : "지원하지 않는 버전의 기록"}
                    </p>
                    {item.id !== null ? (
                      <ConfirmLocalAction
                        label="기록 삭제"
                        confirmLabel="삭제"
                        destructive
                        description="읽을 수 없는 기록을 삭제합니다. 복구할 수 없으므로 필요한 백업이 있는지 확인해 주세요."
                        onConfirm={() => void remove(item.id!)}
                      />
                    ) : (
                      <p>
                        이 기록은 개별 삭제할 수 없습니다. 아래 전체 삭제를
                        이용해 주세요.
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          <LocalProfileDeleteControls />
        </>
      ) : (
        <>
          <p role="status">{LOCAL_PROFILE_ERROR_MESSAGES[availability]}</p>
          <LocalProfileDeleteControls />
        </>
      )}
      <BackupImport onOpen={requestOpen} />
      {error ? <p role="alert">{error}</p> : null}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(value) => {
          if (!value) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 문서를 닫을까요?</AlertDialogTitle>
            <AlertDialogDescription>
              현재 탭에 저장하지 않은 문서가 있습니다. 다른 문서를 열면 현재
              문서는 사라집니다. 필요한 경우 먼저 다운로드해 주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) open(pending);
                setPending(null);
              }}
            >
              다른 문서 열기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
