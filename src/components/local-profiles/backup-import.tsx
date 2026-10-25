"use client";
import { SCHOOL_LEVEL_LABELS } from "@/lib/admin/presentation";
import { TEACHER_ROLE_LABELS, type TeacherRole } from "@/types/interview";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { OpenProfileInput } from "@/components/layout/interview-session-provider";
import {
  BACKUP_IMPORT_ERROR_MESSAGES,
  parseProfileBackupFile,
  type BackupImportPreview,
} from "@/lib/storage/profiles/backup";
import {
  createLocalProfile,
  enableLocalProfiles,
  getLocalProfile,
  saveDraft,
} from "@/lib/storage/profiles/repository";
import {
  MAX_LOCAL_PROFILES,
  type LocalProfileRecord,
} from "@/lib/storage/profiles/schema";
import {
  toDraftSnapshot,
  toEditableSession,
} from "@/lib/storage/profiles/serialize";
import {
  selectedTagKeysFromConfirmedTags,
  mergeSuggestedTags,
  suggestedTagsFromConfirmedTags,
} from "@/lib/profile/tags";
import { useLocalProfiles } from "./local-profiles-provider";
import { LOCAL_PROFILE_ERROR_MESSAGES } from "./local-save-panel";
import { ConfirmLocalAction } from "./local-profile-delete-controls";

export function BackupImport({
  onOpen,
}: {
  onOpen: (input: OpenProfileInput) => void;
}) {
  const { availability, options, items, refresh } = useLocalProfiles();
  const [preview, setPreview] = useState<BackupImportPreview | null>(null);
  const [matched, setMatched] = useState<LocalProfileRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const choose = async (file: File) => {
    setBusy(true);
    setError(null);
    setPreview(null);
    setMatched(null);
    const result = await parseProfileBackupFile(file, new Date().toISOString());
    if (!result.ok) {
      setError(BACKUP_IMPORT_ERROR_MESSAGES[result.error]);
      setBusy(false);
      return;
    }
    setPreview(result.value);
    if (availability === "enabled" && result.value.recordId) {
      const existing = await getLocalProfile(result.value.recordId, options);
      if (existing.ok) setMatched(existing.value);
    }
    setBusy(false);
  };
  const openMemory = () => {
    if (!preview) return;
    onOpen({
      profile: preview.profile,
      suggestedTags: mergeSuggestedTags(
        preview.suggestedTags,
        suggestedTagsFromConfirmedTags(preview.profile.confirmedTags),
      ),
      mode: "edit",
      link: null,
    });
  };
  const save = async (replace: boolean) => {
    if (!preview || busy || (availability === "disabled" && !consent)) return;
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
      const snapshot = toDraftSnapshot({
        profile: preview.profile,
        suggestedTags: preview.suggestedTags,
        selectedTagKeys: selectedTagKeysFromConfirmedTags(
          preview.profile.confirmedTags,
        ),
        baseConfirmedAt: replace
          ? (matched?.confirmed?.confirmedAt ?? null)
          : null,
        now: new Date().toISOString(),
      });
      if (!snapshot.ok) {
        setError(LOCAL_PROFILE_ERROR_MESSAGES.invalid);
        return;
      }
      if (replace && matched) {
        const result = await saveDraft(
          matched.id,
          {
            draft: snapshot.snapshot,
            expectedRevision: matched.revision,
            suggestedTags: preview.suggestedTags,
          },
          options,
        );
        if (!result.ok) {
          setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
          return;
        }
        const read = await getLocalProfile(matched.id, options);
        if (!read.ok) {
          setError(LOCAL_PROFILE_ERROR_MESSAGES[read.error]);
          return;
        }
        const session = toEditableSession(read.value);
        onOpen({
          profile: session.profile,
          suggestedTags: session.suggestedTags,
          mode: "edit",
          link: {
            recordId: session.recordId,
            revision: session.revision,
            baseline: session.baseline,
          },
        });
      } else {
        const result = await createLocalProfile(
          {
            origin: "import",
            draft: snapshot.snapshot,
            suggestedTags: preview.suggestedTags,
          },
          options,
        );
        if (!result.ok) {
          setError(LOCAL_PROFILE_ERROR_MESSAGES[result.error]);
          return;
        }
        onOpen({
          profile: snapshot.snapshot.profile,
          suggestedTags: mergeSuggestedTags(
            preview.suggestedTags,
            suggestedTagsFromConfirmedTags(
              snapshot.snapshot.profile.confirmedTags,
            ),
          ),
          mode: "edit",
          link: { recordId: result.value.id, revision: 1, baseline: null },
        });
      }
    } finally {
      setBusy(false);
      await refresh();
    }
  };
  return (
    <section
      className="space-y-4 rounded-2xl border p-5"
      aria-labelledby="backup-import-title"
    >
      <h2 id="backup-import-title" className="text-xl font-bold">
        JSON 불러와 저장하지 않고 열기
      </h2>
      <label className="block space-y-2">
        <span>JSON 백업 파일 선택</span>
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          className="block w-full min-w-0 text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void choose(file);
            event.target.value = "";
          }}
        />
      </label>
      {preview ? (
        <div className="space-y-3">
          <h3 className="font-bold break-words">
            {preview.title || "제목 없는 초안"}
          </h3>
          <p>
            {SCHOOL_LEVEL_LABELS[preview.schoolLevel]} ·{" "}
            {TEACHER_ROLE_LABELS[preview.role as TeacherRole] ?? preview.role} ·{" "}
            {preview.kind === "confirmed" ? "확정본 백업" : "초안 백업"} ·{" "}
            {preview.source === "bare_profile" ? "순수 프로파일" : "백업 v1"}
          </p>
          <p>
            미확인 문장 {preview.unconfirmedCount}개 · 개인정보 경고{" "}
            {preview.warningCount}개
          </p>
          <ul className="text-sm">
            {preview.modules.map((module) => (
              <li key={module.id}>
                {module.title || module.id}: {module.claimCount}문장
              </li>
            ))}
          </ul>
          <p className="text-sm">
            파일의 개인정보 검사 결과는 그대로 신뢰하지 않습니다. 다시 검토하고
            최종 검사를 받아 주세요.
          </p>
          {availability === "disabled" ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              이 브라우저에만 저장하며 서버로 보내지 않습니다. 공용 기기에
              주의하고 JSON 백업을 보관하겠습니다. 로컬 저장을 켜는 데
              동의합니다.
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openMemory} disabled={busy}>
              저장하지 않고 열기
            </Button>
            <Button
              disabled={
                busy ||
                items.length >= MAX_LOCAL_PROFILES ||
                (availability !== "enabled" &&
                  !(availability === "disabled" && consent))
              }
              onClick={() => void save(false)}
            >
              새 항목으로 저장
            </Button>
            {matched ? (
              <ConfirmLocalAction
                label="기존 프로파일의 편집 초안으로 불러오기"
                description={
                  matched.draft
                    ? "기존 편집 초안을 대체합니다. 확정본은 그대로 유지됩니다."
                    : "기존 확정본은 유지하고 가져온 내용을 편집 초안으로 저장합니다."
                }
                onConfirm={() => void save(true)}
              />
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setMatched(null);
              }}
            >
              취소
            </Button>
          </div>
          {items.length >= MAX_LOCAL_PROFILES ? (
            <p>{LOCAL_PROFILE_ERROR_MESSAGES.limit_reached}</p>
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
