import type { ReactNode } from "react";
import { EvidenceBadge } from "@/components/profile/evidence-badge";
import { Badge } from "@/components/ui/badge";
import { VARIANT_SECTION_TITLES } from "@/content/export-variants";
import { diffProfiles, type ProfileChanges } from "@/lib/profile/changes";
import { changedAreas, type ChangedArea } from "@/lib/profile/versions";
import {
  PROFILE_MODULE_TITLES,
  isPendingPrivacyReview,
  isUnverifiedPrivacyReview,
  type PrivacyReview,
  type ProfileModule,
  type TeacherContextProfile,
} from "@/types/profile";

export function changedAreaLabel(area: ChangedArea): string {
  if (area.kind === "profile")
    return area.field === "profileTitle" ? "문서 제목" : "전체 요약";
  if (area.kind === "module") return PROFILE_MODULE_TITLES[area.id];
  return VARIANT_SECTION_TITLES[area.id];
}

function ComparisonArea({
  title,
  before,
  after,
}: {
  title: string;
  before: ReactNode;
  after: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 space-y-3">
      <h3 className="font-bold break-words">{title}</h3>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {[
          { title: "이전 버전", content: before },
          { title: "현재 확정본", content: after },
        ].map((column) => (
          <section
            key={column.title}
            aria-label={column.title}
            className="min-w-0 space-y-3 rounded-xl border p-3 text-sm leading-6 [overflow-wrap:anywhere] break-words"
          >
            <h4 className="font-semibold">{column.title}</h4>
            {column.content}
          </section>
        ))}
      </div>
    </section>
  );
}

function ModuleContent({
  module,
  other,
  changes,
  side,
}: {
  module: ProfileModule;
  other: ProfileModule;
  changes: ProfileChanges["modules"][ProfileModule["id"]];
  side: "before" | "after";
}) {
  const otherIds = new Set(other.claims.map((claim) => claim.id));
  return (
    <>
      <h5 className="font-semibold whitespace-pre-wrap">{module.title}</h5>
      <p className="whitespace-pre-wrap">{module.summary}</p>
      <ul className="space-y-3">
        {module.claims.map((claim) => {
          const change =
            side === "before" && !otherIds.has(claim.id)
              ? "삭제"
              : side === "after" && changes.added.includes(claim.id)
                ? "추가"
                : changes.edited.includes(claim.id)
                  ? "수정"
                  : null;
          return (
            <li key={claim.id} className="space-y-1">
              <div className="flex flex-wrap items-center gap-1">
                <EvidenceBadge basis={claim.basis} />
                {!claim.confirmedByUser ? (
                  <Badge variant="outline">검토 전</Badge>
                ) : null}
                {change ? <Badge variant="secondary">{change}</Badge> : null}
              </div>
              <p className="whitespace-pre-wrap">{claim.text}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SynthesisContent({ values }: { values: readonly string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {values.map((text, index) => (
        <li key={index} className="whitespace-pre-wrap">
          {text}
        </li>
      ))}
    </ul>
  );
}

function privacyStatusLabel(review: PrivacyReview): string {
  if (review.status === "clear") return "검사 통과";
  if (isPendingPrivacyReview(review)) return "검사 대기";
  if (isUnverifiedPrivacyReview(review)) return "확인 안 됨";
  return "확인 필요";
}

export function VersionCompare({
  before,
  after,
}: {
  before: TeacherContextProfile;
  after: TeacherContextProfile;
}) {
  const areas = changedAreas(before, after);
  const changes = diffProfiles(before, after);
  const beforePrivacy = privacyStatusLabel(before.privacyReview);
  const afterPrivacy = privacyStatusLabel(after.privacyReview);
  const privacyChanged = beforePrivacy !== afterPrivacy;
  if (areas.length === 0 && !privacyChanged)
    return <p className="text-sm">현재 확정본과 내용이 같습니다</p>;
  return (
    <div className="min-w-0 space-y-5">
      {areas.map((area) => {
        const title = changedAreaLabel(area);
        if (area.kind === "profile")
          return (
            <ComparisonArea
              key={area.field}
              title={title}
              before={
                <p className="whitespace-pre-wrap">{before[area.field]}</p>
              }
              after={<p className="whitespace-pre-wrap">{after[area.field]}</p>}
            />
          );
        if (area.kind === "synthesis")
          return (
            <ComparisonArea
              key={area.id}
              title={title}
              before={<SynthesisContent values={before[area.id]} />}
              after={<SynthesisContent values={after[area.id]} />}
            />
          );
        const previous = before.modules.find(
          (module) => module.id === area.id,
        )!;
        const current = after.modules.find((module) => module.id === area.id)!;
        return (
          <ComparisonArea
            key={area.id}
            title={title}
            before={
              <ModuleContent
                module={previous}
                other={current}
                changes={changes.modules[area.id]}
                side="before"
              />
            }
            after={
              <ModuleContent
                module={current}
                other={previous}
                changes={changes.modules[area.id]}
                side="after"
              />
            }
          />
        );
      })}
      {privacyChanged ? (
        <ComparisonArea
          title="개인정보 상태"
          before={<p>{beforePrivacy}</p>}
          after={<p>{afterPrivacy}</p>}
        />
      ) : null}
    </div>
  );
}
