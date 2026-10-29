"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
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
import { changedAreas } from "@/lib/profile/versions";
import {
  deleteVersion,
  getLocalProfile,
  restoreVersion,
} from "@/lib/storage/profiles/repository";
import type { LocalProfileRecord } from "@/lib/storage/profiles/schema";
import type { TeacherContextProfile } from "@/types/profile";
import { ConfirmLocalAction } from "./local-profile-delete-controls";
import { useLocalProfiles } from "./local-profiles-provider";
import { LOCAL_PROFILE_ERROR_MESSAGES } from "./local-save-panel";
import { toViewSession } from "./profile-library";
import { changedAreaLabel, VersionCompare } from "./version-compare";

const recordIdSchema = z.uuid();
const draftReason = "편집 중인 초안을 확정하거나 버린 뒤 복원할 수 있습니다";
const dateLabel = (date: string) => new Date(date).toLocaleString("ko-KR");

function ChangedAreas({
  before,
  after,
}: {
  before: TeacherContextProfile;
  after: TeacherContextProfile;
}) {
  const labels = changedAreas(before, after).map(changedAreaLabel);
  return (
    <p className="text-sm break-words">
      {labels.length > 0
        ? `바뀐 영역: ${labels.join(" · ")}`
        : "내용 변화 없음(분석 태그만 바뀜)"}
    </p>
  );
}

function MissingRecord() {
  return (
    <div className="space-y-3">
      <p role="status">기록을 찾을 수 없습니다</p>
      <Link
        href="/profiles"
        className="text-primary inline-flex min-h-11 items-center font-semibold underline"
      >
        내 프로파일
      </Link>
    </div>
  );
}

export function ProfileVersions() {
  const search = useSearchParams();
  const { availability } = useLocalProfiles();
  const id = search.get("record");
  if (availability === "unknown")
    return <p role="status">로컬 저장 상태 확인 중…</p>;
  if (
    availability !== "enabled" ||
    !recordIdSchema.safeParse(id).success ||
    !id
  )
    return <MissingRecord />;
  return <LoadedProfileVersions key={id} id={id} />;
}

function LoadedProfileVersions({ id }: { id: string }) {
  const { items, options, refresh } = useLocalProfiles();
  const { profile, localProfileLink, openProfile } = useInterviewSession();
  const router = useRouter();
  const regionId = useId();
  const [record, setRecord] = useState<LocalProfileRecord | null>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedAt, setExpandedAt] = useState<string | null>(null);
  const [pending, setPending] = useState<OpenProfileInput | null>(null);
  const active = useRef(true);
  const request = useRef(0);
  const latestLink = useRef(localProfileLink);
  const latestOptions = useRef(options);
  const invalidateRead = useCallback(() => {
    request.current++;
  }, []);
  useEffect(() => {
    latestLink.current = localProfileLink;
    latestOptions.current = options;
  }, [localProfileLink, options]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      invalidateRead();
    };
  }, [invalidateRead]);
  const load = useCallback(async () => {
    const generation = ++request.current;
    const result = await getLocalProfile(id, options);
    if (!active.current || latestOptions.current !== options) return null;
    const next = result.ok ? result.value : null;
    if (generation === request.current) setRecord(next);
    return next;
  }, [id, options]);
  useEffect(() => {
    void load();
    return invalidateRead;
  }, [load, items, invalidateRead]);

  const changeVersion = async (
    confirmedAt: string,
    action: "restore" | "delete",
  ) => {
    if (!record || busy) return;
    setBusy(true);
    setError(null);
    const result =
      action === "restore"
        ? await restoreVersion(
            id,
            { confirmedAt, expectedRevision: record.revision },
            options,
          )
        : await deleteVersion(id, { confirmedAt }, options);
    if (!active.current) return;
    if (latestOptions.current !== options) {
      setBusy(false);
      return;
    }
    if (!result.ok) {
      setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
    } else {
      const next = await load();
      if (!active.current) return;
      if (latestOptions.current !== options) {
        setBusy(false);
        return;
      }
      if (action === "restore" && next && latestLink.current?.recordId === id) {
        const input = toViewSession(next, id);
        if (input) openProfile(input);
      }
      setExpandedAt(null);
      await refresh();
    }
    if (active.current) setBusy(false);
  };

  if (record === undefined)
    return <p role="status">버전 기록을 불러오는 중…</p>;
  if (!record?.confirmed) return <MissingRecord />;
  const current = record.confirmed;
  const open = (input: OpenProfileInput) => {
    openProfile(input);
    router.push("/result");
  };
  return (
    <div className="min-w-0 space-y-5">
      <header className="space-y-2">
        <h2 className="text-2xl font-bold break-words">
          {current.profile.profileTitle}
        </h2>
        <p className="text-sm">처음 저장 {dateLabel(record.createdAt)}</p>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      {record.draft ? (
        <p id={`${regionId}-draft`} className="text-sm">
          {draftReason}
        </p>
      ) : null}
      <ol aria-label="확정 버전 기록" className="space-y-4">
        <li className="min-w-0 space-y-3 rounded-2xl border p-4 sm:p-5">
          <h3 className="text-lg font-bold">현재 확정본</h3>
          <p className="text-sm">{dateLabel(current.confirmedAt)}에 확정</p>
          {record.history[0] ? (
            <ChangedAreas
              before={record.history[0].profile}
              after={current.profile}
            />
          ) : null}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              const input = toViewSession(record, id);
              if (!input) return;
              if (profile && !localProfileLink) setPending(input);
              else open(input);
            }}
          >
            보기
          </Button>
        </li>
        {record.history.map((entry, index) => {
          const newer = index === 0 ? current : record.history[index - 1]!;
          const expanded = expandedAt === entry.confirmedAt;
          const comparisonId = `${regionId}-comparison-${index}`;
          return (
            <li
              key={entry.confirmedAt}
              className="min-w-0 space-y-3 rounded-2xl border p-4 sm:p-5"
            >
              <h3 className="text-lg font-bold">이전 버전</h3>
              <p className="text-sm">
                {dateLabel(entry.confirmedAt)}에 확정 ·{" "}
                {dateLabel(entry.replacedAt)}까지 사용
              </p>
              <ChangedAreas before={entry.profile} after={newer.profile} />
              <fieldset
                disabled={busy}
                aria-label={`${dateLabel(entry.confirmedAt)}에 확정한 버전 작업`}
                className="flex min-w-0 flex-wrap gap-2"
              >
                <Button
                  variant="outline"
                  aria-expanded={expanded}
                  aria-controls={comparisonId}
                  onClick={() =>
                    setExpandedAt(expanded ? null : entry.confirmedAt)
                  }
                >
                  현재와 비교
                </Button>
                {record.draft ? (
                  <Button
                    variant="outline"
                    disabled
                    aria-describedby={`${regionId}-draft`}
                  >
                    이 버전으로 복원
                  </Button>
                ) : (
                  <ConfirmLocalAction
                    label="이 버전으로 복원"
                    confirmLabel="복원"
                    description="이 버전을 현재 확정본으로 되돌립니다. 지금 확정본은 버전 기록에 남습니다."
                    onConfirm={() =>
                      void changeVersion(entry.confirmedAt, "restore")
                    }
                  />
                )}
                <ConfirmLocalAction
                  label="삭제"
                  confirmLabel="삭제"
                  destructive
                  description="이 이전 버전을 지웁니다. 되돌릴 수 없습니다."
                  onConfirm={() =>
                    void changeVersion(entry.confirmedAt, "delete")
                  }
                />
              </fieldset>
              {expanded ? (
                <div id={comparisonId}>
                  <VersionCompare
                    before={entry.profile}
                    after={current.profile}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Link
        href="/profiles"
        className="text-primary inline-flex min-h-11 items-center font-semibold underline"
      >
        내 프로파일
      </Link>
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
