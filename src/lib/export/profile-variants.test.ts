// @vitest-environment node
import { expect, it } from "vitest";
import {
  AS_OF_NOTICE,
  CLAIM_REVIEW_WARNING,
  CORE_USAGE_RULES,
  EMPTY_SECTION_LINE,
  EVIDENCE_GUIDE_LINES,
  MODULE_SCOPE_NOTICE,
  PRIVACY_REVIEW_WARNING,
  PRIVACY_UNVERIFIED_WARNING,
} from "@/content/export-variants";
import { CONTEXT_DOCUMENT_TITLE } from "@/content/profile-document";
import {
  PENDING_PRIVACY_REVIEW,
  PROFILE_MODULE_IDS,
  teacherContextProfileSchema,
  type ProfileModuleId,
} from "@/types/profile";
import { profileMarkdownFilename } from "./download";
import { profileToMarkdown } from "./profile-to-markdown";
import {
  contextAsOf,
  OPTIONAL_SECTION_IDS,
  profileToCoreMarkdown,
  profileToModuleMarkdown,
  variantMarkdownFilename,
  type OptionalSectionId,
} from "./profile-variants";
import {
  MAX_VARIANT_PROFILE,
  TEST_AS_OF,
  VARIANT_FIXTURES,
  variantMarkdown,
} from "./profile-variants.test-fixtures";
import { sanitizeMarkdownText } from "./sanitize";

function frontmatter(markdown: string): Record<string, unknown> {
  const header = markdown.match(/^---\n([\s\S]*?)\n---\n/)![1]!;
  return Object.fromEntries(
    header.split("\n").map((line) => {
      const colon = line.indexOf(": ");
      return [line.slice(0, colon), JSON.parse(line.slice(colon + 2))];
    }),
  );
}
function section(markdown: string, title: string): string {
  const start = markdown.indexOf(`## ${title}\n`);
  if (start < 0) throw new Error(`Missing section: ${title}`);
  const next = markdown.indexOf("\n## ", start + 4);
  return markdown.slice(start, next < 0 ? undefined : next);
}
const bulletText = (text: string) =>
  sanitizeMarkdownText(text).replaceAll("\n", "\n  ");

it("uses valid maximal and privacy fixtures without changing canonical inputs", () => {
  for (const { profile } of VARIANT_FIXTURES)
    expect(teacherContextProfileSchema.safeParse(profile).success).toBe(true);
  expect(
    MAX_VARIANT_PROFILE.modules.map((module) => module.claims.length),
  ).toEqual(Array(7).fill(4));
  expect([
    MAX_VARIANT_PROFILE.teachingDesignPrinciples.length,
    MAX_VARIANT_PROFILE.classSupportConsiderations.length,
    MAX_VARIANT_PROFILE.realisticConstraints.length,
    MAX_VARIANT_PROFILE.aiCollaborationInstructions.length,
  ]).toEqual([6, 6, 5, 6]);
  for (const { profile } of VARIANT_FIXTURES) {
    const original = structuredClone(profile);
    const options = {
      asOf: TEST_AS_OF,
      modules: PROFILE_MODULE_IDS,
      sections: OPTIONAL_SECTION_IDS,
    };
    expect(
      variantMarkdown(profileToCoreMarkdown(profile, { asOf: TEST_AS_OF })),
    ).toBe(
      variantMarkdown(profileToCoreMarkdown(profile, { asOf: TEST_AS_OF })),
    );
    expect(variantMarkdown(profileToModuleMarkdown(profile, options))).toBe(
      variantMarkdown(profileToModuleMarkdown(profile, options)),
    );
    expect(profile).toEqual(original);
  }
});

it("writes the prescribed core metadata, section order, exclusions and unabridged confirmed claims", () => {
  const profile = MAX_VARIANT_PROFILE;
  const markdown = variantMarkdown(
    profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
  );
  const header = frontmatter(markdown);
  expect(Object.keys(header)).toEqual([
    "document_type",
    "export_variant",
    "variant_format_version",
    "title",
    "profile_title",
    "service",
    "language",
    "school_level",
    "role",
    ...(profile.metadata.teachingSubject === undefined
      ? []
      : ["teaching_subject"]),
    "schema_version",
    "created_at",
    "context_as_of",
    "context_as_of_source",
    "privacy_rule",
    "privacy_review",
    "needs_claim_review",
  ]);
  expect(header).toMatchObject({
    document_type: "teacher_profile_context",
    export_variant: "core",
    variant_format_version: "1.0",
    title: CONTEXT_DOCUMENT_TITLE,
    profile_title: profile.profileTitle,
    service: "TContext",
    language: "ko-KR",
    schema_version: profile.metadata.schemaVersion,
    created_at: profile.metadata.generatedAt,
    context_as_of: TEST_AS_OF.date,
    context_as_of_source: "confirmed",
    privacy_review: "clear",
    needs_claim_review: false,
  });
  expect(header).not.toHaveProperty("document_format_version");
  expect(markdown.match(/^## .+$/gm)).toEqual([
    "## 이 문서를 사용하는 방법",
    "## 요약",
    "## 확인된 교사 맥락",
    "## 수업 설계 원칙",
    "## 학급 지원 고려사항",
    "## 현실적인 제약과 대체안",
    "## AI 협업 지침과 판단 경계",
  ]);
  for (const rule of CORE_USAGE_RULES) expect(markdown).toContain(`- ${rule}`);
  expect(markdown).toContain(
    "> **확인되지 않은 문장 제외:** 확인되지 않은 문장 16개는 이 핵심본에서 제외했습니다. 전체본에서 확인하고 검토를 마쳐 주세요.",
  );
  expect(markdown).toContain(
    `확인된 문장이 없는 영역: ${profile.modules[6]!.title}.`,
  );
  expect(markdown).not.toContain(`### ${profile.modules[6]!.title}`);
  for (const profileModule of profile.modules)
    for (const claim of profileModule.claims) {
      if (claim.confirmedByUser && claim.basis !== "needs_confirmation") {
        const label =
          claim.basis === "direct" ? "[직접]" : "[AI 해석·교사 승인]";
        expect(markdown).toContain(`- ${label} ${bulletText(claim.text)}`);
      } else expect(markdown).not.toContain(bulletText(claim.text));
    }
  expect(markdown).toContain("&lt;선택&gt; &amp;");
  expect(markdown).toContain("javascript&#58;");
  expect(markdown).not.toContain("javascript:");
  for (const excluded of [
    "# 수업마다 추가할 작업 컨텍스트",
    "# AI에게 바로 전달할 실행 프롬프트",
    "## 생성 결과 자기 점검",
  ])
    expect(markdown).not.toContain(excluded);
  const notice = AS_OF_NOTICE(TEST_AS_OF.date, TEST_AS_OF.source);
  expect(markdown.split(notice)).toHaveLength(3);
  const classStart = markdown.indexOf(`### ${profile.modules[3]!.title}`);
  expect(markdown.indexOf(notice, classStart)).toBeLessThan(
    markdown.indexOf(`### ${profile.modules[4]!.title}`),
  );
  expect(section(markdown, "학급 지원 고려사항")).toContain(notice);
});

it("deduplicates confirmed claims, principles and supports but retains every constraint and AI instruction", () => {
  const profile = structuredClone(MAX_VARIANT_PROFILE);
  // A later confirmed claim differing only in whitespace is redundant.
  profile.modules[1]!.claims[1]!.text =
    profile.modules[0]!.claims[0]!.text.replaceAll(" ", "  ");
  const markdown = variantMarkdown(
    profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
  );
  expect(markdown).not.toContain(
    `- [AI 해석·교사 승인] ${profile.modules[1]!.claims[1]!.text}`,
  );
  expect(section(markdown, "수업 설계 원칙")).not.toContain(
    profile.teachingDesignPrinciples[0]!,
  );
  expect(section(markdown, "학급 지원 고려사항")).not.toContain(
    profile.classSupportConsiderations[0]!,
  );
  for (const text of profile.realisticConstraints)
    expect(section(markdown, "현실적인 제약과 대체안")).toContain(
      `- ${bulletText(text)}`,
    );
  for (const text of profile.aiCollaborationInstructions)
    expect(section(markdown, "AI 협업 지침과 판단 경계")).toContain(
      `- ${bulletText(text)}`,
    );
});

it("omits blank summaries and represents empty context and synthesis sections explicitly", () => {
  const profile = structuredClone(MAX_VARIANT_PROFILE);
  profile.shortSummary = "";
  profile.modules.forEach((module) => {
    module.summary = "";
    module.claims = [];
  });
  profile.teachingDesignPrinciples = [];
  profile.classSupportConsiderations = [];
  profile.realisticConstraints = [];
  profile.aiCollaborationInstructions = [];
  const core = variantMarkdown(
    profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
  );
  expect(core).not.toContain("## 요약");
  for (const title of [
    "확인된 교사 맥락",
    "수업 설계 원칙",
    "학급 지원 고려사항",
    "현실적인 제약과 대체안",
    "AI 협업 지침과 판단 경계",
  ])
    expect(section(core, title)).toContain(EMPTY_SECTION_LINE);
  const modules = variantMarkdown(
    profileToModuleMarkdown(profile, {
      asOf: TEST_AS_OF,
      modules: ["class_context"],
      sections: [],
    }),
  );
  expect(modules).toContain("- 작성된 내용이 없습니다.");
  expect(modules).toContain(AS_OF_NOTICE(TEST_AS_OF.date, TEST_AS_OF.source));
});

it.each(VARIANT_FIXTURES)(
  "preserves each complete module block and exact copied notices: $name",
  ({ profile }) => {
    const full = profileToMarkdown(profile);
    for (const line of EVIDENCE_GUIDE_LINES) expect(full).toContain(line);
    for (const [index, id] of PROFILE_MODULE_IDS.entries()) {
      const selected = variantMarkdown(
        profileToModuleMarkdown(profile, {
          asOf: TEST_AS_OF,
          modules: [id],
          sections: [],
        }),
      );
      const start = full.indexOf(`## M${index + 1}. `);
      const next =
        index === 6
          ? full.indexOf("# 수업 설계 실행 가이드", start)
          : full.indexOf(`## M${index + 2}. `, start);
      expect(start).toBeGreaterThan(-1);
      expect(selected).toContain(full.slice(start, next).trimEnd());
      expect(selected).not.toContain(profile.shortSummary);
      for (const line of EVIDENCE_GUIDE_LINES) expect(selected).toContain(line);
    }
  },
);

it("copies privacy and pending-claim warning strings exactly from full output", () => {
  for (const [name, warning] of [
    ["privacy-warning", PRIVACY_REVIEW_WARNING],
    ["privacy-unverified", PRIVACY_UNVERIFIED_WARNING],
  ] as const) {
    const profile = VARIANT_FIXTURES.find(
      (fixture) => fixture.name === name,
    )!.profile;
    expect(profileToMarkdown(profile)).toContain(warning);
    expect(profileToMarkdown(profile)).toContain(CLAIM_REVIEW_WARNING);
    expect(
      variantMarkdown(profileToCoreMarkdown(profile, { asOf: TEST_AS_OF })),
    ).toContain(warning);
    const modules = variantMarkdown(
      profileToModuleMarkdown(profile, {
        asOf: TEST_AS_OF,
        modules: ["identity_and_role"],
        sections: [],
      }),
    );
    expect(modules).toContain(warning);
    expect(modules).toContain(CLAIM_REVIEW_WARNING);
    expect(frontmatter(modules).needs_claim_review).toBe(true);
  }
});

it("orders and deduplicates selected ids, omits the whole-profile summary and respects optional sections", () => {
  const profile = MAX_VARIANT_PROFILE;
  const modules: ProfileModuleId[] = [
    "class_context",
    "identity_and_role",
    "class_context",
  ];
  const markdown = variantMarkdown(
    profileToModuleMarkdown(profile, {
      asOf: TEST_AS_OF,
      modules,
      sections: [
        "realisticConstraints",
        "teachingDesignPrinciples",
        "realisticConstraints",
      ],
    }),
  );
  expect(frontmatter(markdown)).toMatchObject({
    export_variant: "modules",
    included_modules: ["identity_and_role", "class_context"],
    included_sections: ["teachingDesignPrinciples", "realisticConstraints"],
  });
  expect(markdown).toContain(
    MODULE_SCOPE_NOTICE(
      [profile.modules[0]!.title, profile.modules[3]!.title].join("·"),
    ),
  );
  expect(markdown).not.toContain(profile.shortSummary);
  expect(markdown.match(/^## M\d\..+$/gm)).toEqual([
    `## M1. ${profile.modules[0]!.title}`,
    `## M4. ${profile.modules[3]!.title}`,
  ]);
  expect(markdown).not.toContain("## 학급 지원 고려사항");
  expect(markdown).toContain("## AI 협업 지침과 판단 경계");
  expect(section(markdown, "수업 설계 원칙")).toContain(
    `- ${profile.teachingDesignPrinciples[0]}`,
  );
  const confirmedOnly = structuredClone(profile);
  confirmedOnly.modules[0]!.claims = confirmedOnly.modules[0]!.claims.filter(
    (claim) => claim.confirmedByUser,
  );
  const confirmed = variantMarkdown(
    profileToModuleMarkdown(confirmedOnly, {
      asOf: TEST_AS_OF,
      modules: ["identity_and_role"],
      sections: [],
    }),
  );
  expect(frontmatter(confirmed).needs_claim_review).toBe(false);
  expect(confirmed).not.toContain(CLAIM_REVIEW_WARNING);
});

it("validates profile, review state, date and selected ids without accepting unknown selections", () => {
  const options = {
    asOf: TEST_AS_OF,
    modules: PROFILE_MODULE_IDS,
    sections: OPTIONAL_SECTION_IDS,
  };
  for (const profile of [null, {}, { ...MAX_VARIANT_PROFILE, modules: [] }]) {
    expect(profileToCoreMarkdown(profile, { asOf: TEST_AS_OF })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(profileToModuleMarkdown(profile, options)).toEqual({
      ok: false,
      error: "invalid",
    });
  }
  const pending = {
    ...MAX_VARIANT_PROFILE,
    privacyReview: PENDING_PRIVACY_REVIEW,
  };
  expect(profileToCoreMarkdown(pending, { asOf: TEST_AS_OF })).toEqual({
    ok: false,
    error: "pending_review",
  });
  expect(profileToModuleMarkdown(pending, options)).toEqual({
    ok: false,
    error: "pending_review",
  });
  expect(
    profileToModuleMarkdown(MAX_VARIANT_PROFILE, { ...options, modules: [] }),
  ).toEqual({ ok: false, error: "no_modules" });
  expect(
    profileToModuleMarkdown(MAX_VARIANT_PROFILE, {
      ...options,
      modules: ["unknown" as ProfileModuleId],
    }),
  ).toEqual({ ok: false, error: "invalid" });
  expect(
    profileToModuleMarkdown(MAX_VARIANT_PROFILE, {
      ...options,
      sections: ["unknown" as OptionalSectionId],
    }),
  ).toEqual({ ok: false, error: "invalid" });
  for (const date of ["", "2026-1-01", "invalid", "2026-10-27T00:00:00Z"]) {
    expect(
      profileToCoreMarkdown(MAX_VARIANT_PROFILE, {
        asOf: { ...TEST_AS_OF, date },
      }),
    ).toEqual({ ok: false, error: "invalid" });
    expect(
      profileToModuleMarkdown(MAX_VARIANT_PROFILE, {
        ...options,
        asOf: { ...TEST_AS_OF, date },
      }),
    ).toEqual({ ok: false, error: "invalid" });
  }
  const legacy = VARIANT_FIXTURES.find(
    (fixture) => fixture.name === "legacy",
  )!.profile;
  expect(
    frontmatter(
      variantMarkdown(profileToCoreMarkdown(legacy, { asOf: TEST_AS_OF })),
    ),
  ).not.toHaveProperty("teaching_subject");
});

it("uses Korea dates with a confirmed timestamp preferred over the generated timestamp", () => {
  const profile = structuredClone(MAX_VARIANT_PROFILE);
  profile.metadata.generatedAt = "2026-10-25T14:59:59.999Z";
  expect(contextAsOf(profile)).toEqual({
    date: "2026-10-25",
    source: "generated",
  });
  profile.metadata.generatedAt = "2026-10-25T15:00:00.000Z";
  expect(contextAsOf(profile)).toEqual({
    date: "2026-10-26",
    source: "generated",
  });
  expect(contextAsOf(profile, "2026-12-31T15:00:00.000Z")).toEqual({
    date: "2027-01-01",
    source: "confirmed",
  });
  for (const confirmedAt of [null, undefined, "invalid", ""])
    expect(contextAsOf(profile, confirmedAt)).toEqual({
      date: "2026-10-26",
      source: "generated",
    });
});

it("adds the variant suffix to the established Markdown filename", () => {
  const date = new Date("2026-10-25T18:00:00.000Z");
  for (const variant of ["core", "modules"] as const)
    expect(variantMarkdownFilename("elementary", variant, date)).toBe(
      profileMarkdownFilename("elementary", date).replace(
        /\.md$/,
        `-${variant}.md`,
      ),
    );
});
