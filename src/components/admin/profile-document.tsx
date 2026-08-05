import { EvidenceBadge } from "@/components/profile/evidence-badge";
import { Badge } from "@/components/ui/badge";
import { TAG_CATEGORY_LABELS, TAG_LABELS } from "@/lib/admin/presentation";
import type {
  ControlledTagCategory,
  TeacherContextProfile,
} from "@/types/profile";

const SYNTHESIS_SECTIONS: ReadonlyArray<{
  key: keyof Pick<
    TeacherContextProfile,
    | "teachingDesignPrinciples"
    | "classSupportConsiderations"
    | "realisticConstraints"
    | "aiCollaborationInstructions"
  >;
  title: string;
}> = [
  { key: "teachingDesignPrinciples", title: "수업 설계 원칙" },
  { key: "classSupportConsiderations", title: "학급 지원 고려사항" },
  { key: "realisticConstraints", title: "현실적인 제약" },
  { key: "aiCollaborationInstructions", title: "AI 협업 지침" },
];

export function AdminProfileDocument({
  profile,
}: {
  profile: TeacherContextProfile;
}) {
  const tagCategories = Object.keys(
    profile.confirmedTags,
  ) as ControlledTagCategory[];
  const hasTags = tagCategories.some(
    (category) => profile.confirmedTags[category].length > 0,
  );

  return (
    <article aria-label="저장된 교사 컨텍스트 문서" className="space-y-12">
      <div className="space-y-10 border-y border-[#cfd8d0] py-10">
        {profile.modules.map((profileModule, index) => (
          <section
            key={profileModule.id}
            aria-labelledby={`admin-module-${profileModule.id}`}
          >
            <p className="text-sm font-bold text-[#28684c]">
              {index + 1} / {profile.modules.length}
            </p>
            <h2
              id={`admin-module-${profileModule.id}`}
              className="mt-1 text-2xl font-bold"
            >
              {profileModule.title}
            </h2>
            <p className="mt-3 max-w-4xl leading-7 text-[#536159]">
              {profileModule.summary}
            </p>
            <ul className="mt-4 space-y-3">
              {profileModule.claims.map((claim) => (
                <li
                  key={claim.id}
                  className="flex flex-col gap-2 border-l-2 border-[#b8c8bc] pl-4 sm:flex-row sm:items-start"
                >
                  <EvidenceBadge basis={claim.basis} />
                  <span className="leading-7 break-words">{claim.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="grid gap-8 lg:grid-cols-2">
          {SYNTHESIS_SECTIONS.map((section) => (
            <section key={section.key}>
              <h2 className="text-xl font-bold">{section.title}</h2>
              {profile[section.key].length > 0 ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
                  {profile[section.key].map((item, index) => (
                    <li key={`${section.key}-${index}`} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#536159]">확인된 항목 없음</p>
              )}
            </section>
          ))}
        </div>
      </div>

      <section aria-labelledby="confirmed-tags-title">
        <h2 id="confirmed-tags-title" className="text-2xl font-bold">
          교사가 확인한 태그
        </h2>
        {hasTags ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {tagCategories.map((category) => {
              const tags = profile.confirmedTags[category];
              if (tags.length === 0) return null;
              return (
                <section key={category}>
                  <h3 className="text-sm font-bold text-[#536159]">
                    {TAG_CATEGORY_LABELS[category]}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {TAG_LABELS[tag] ?? tag}
                      </Badge>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-[#536159]">확인된 태그가 없습니다.</p>
        )}
      </section>
    </article>
  );
}
