"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocalProfiles } from "@/components/local-profiles/local-profiles-provider";
import {
  EXPORT_FORMAT_LABELS,
  exportTargetLabel,
} from "@/components/local-profiles/profile-library";
import { findPlatformGuide } from "@/content/platform-guides";
import {
  getLocalProfile,
  type LocalProfileListItem,
  type LocalProfileRepositoryOptions,
} from "@/lib/storage/profiles/repository";
import type { LocalProfileRecord } from "@/lib/storage/profiles/schema";

type LoadedRecord = {
  recordId: string;
  options: LocalProfileRepositoryOptions;
  items: LocalProfileListItem[];
  record: LocalProfileRecord;
};

export function ExportRefreshNotice({
  recordId,
  mode = "outdated",
}: {
  recordId: string;
  mode?: "outdated" | "all";
}) {
  const { availability, options, items } = useLocalProfiles();
  const [loaded, setLoaded] = useState<LoadedRecord | null>(null);
  useEffect(() => {
    if (availability !== "enabled") return;
    let active = true;
    void getLocalProfile(recordId, options)
      .then((result) => {
        if (active)
          setLoaded(
            result.ok
              ? { recordId, options, items, record: result.value }
              : null,
          );
      })
      .catch(() => {
        if (active) setLoaded(null);
      });
    return () => {
      active = false;
    };
  }, [recordId, availability, options, items]);

  if (
    availability !== "enabled" ||
    loaded?.recordId !== recordId ||
    loaded.options !== options ||
    loaded.items !== items ||
    !loaded.record.confirmed
  )
    return null;

  const record = loaded.record;
  const confirmedAt = record.confirmed!.confirmedAt;
  const outdated = record.exports.filter(
    (entry) => entry.confirmedAt !== confirmedAt,
  );
  if (mode === "outdated" && outdated.length === 0) return null;
  const entries = [...(mode === "all" ? record.exports : outdated)].sort(
    (a, b) => Date.parse(b.exportedAt) - Date.parse(a.exportedAt),
  );
  return (
    <section
      aria-label={mode === "all" ? "내보내기 기록" : "이전 버전 내보내기 안내"}
      className="min-w-0 space-y-3 rounded-2xl border p-4 sm:p-5"
    >
      {mode === "all" ? (
        <h3 className="text-lg font-bold">내보내기 기록</h3>
      ) : null}
      {outdated.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-bold">이전 버전을 내보낸 곳이 있습니다</h3>
          <p className="text-sm leading-6">
            프로파일을 고친 뒤에는 외부 AI에 등록한 문서도 새 문서로 바꿔
            주세요. TContext는 내보낸 기록만 알고, 실제로 등록했는지는 알 수
            없습니다.
          </p>
        </div>
      ) : null}
      {entries.length === 0 ? (
        <p className="text-sm">아직 내보낸 기록이 없습니다.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {entries.map((entry) => (
            <li
              key={entry.target}
              className="min-w-0 space-y-1 [overflow-wrap:anywhere] break-words"
            >
              <p>
                {exportTargetLabel(entry.target)} ·{" "}
                {EXPORT_FORMAT_LABELS[entry.format]} ·{" "}
                {new Date(entry.exportedAt).toLocaleString("ko-KR")}
              </p>
              {mode === "all" && entry.confirmedAt === confirmedAt ? (
                <p className="font-semibold">최신 버전</p>
              ) : null}
              {findPlatformGuide(entry.target) ? (
                <Link
                  href={`/ai-guide/${entry.target}`}
                  className="text-primary inline-flex min-h-10 items-center font-semibold underline"
                >
                  바꾸는 방법 보기
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
