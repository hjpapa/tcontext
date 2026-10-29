// @vitest-environment node
import { expect, it } from "vitest";
import {
  AS_OF_NOTICE,
  CLAIM_REVIEW_WARNING,
  CORE_AS_OF_NOTICE,
  CORE_USAGE_RULES,
  EMPTY_SECTION_LINE,
  EVIDENCE_GUIDE_LINES,
  MODULE_SCOPE_NOTICE,
  PRIVACY_REVIEW_WARNING,
  PRIVACY_UNVERIFIED_WARNING,
} from "@/content/export-variants";
import { FICTIONAL_PROFILES } from "@/content/examples";
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

it("writes the exact core 2.0 metadata and section order without individual claims", () => {
  const profile = MAX_VARIANT_PROFILE;
  const markdown = variantMarkdown(
    profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
  );
  const header = frontmatter(markdown);
  expect(Object.keys(header)).toEqual([
    "document_type",
    "export_variant",
    "variant_format_version",
    "profile_title",
    "school_level",
    "role",
    ...(profile.metadata.teachingSubject === undefined
      ? []
      : ["teaching_subject"]),
    "context_as_of",
    "context_as_of_source",
    "privacy_review",
  ]);
  expect(header).toMatchObject({
    document_type: "teacher_profile_context",
    export_variant: "core",
    variant_format_version: "2.0",
    profile_title: profile.profileTitle,
    context_as_of: TEST_AS_OF.date,
    context_as_of_source: "confirmed",
    privacy_review: "clear",
  });
  for (const key of [
    "title",
    "service",
    "language",
    "schema_version",
    "created_at",
    "privacy_rule",
    "needs_claim_review",
    "document_format_version",
  ])
    expect(header).not.toHaveProperty(key);
  expect(markdown.match(/^## .+$/gm)).toEqual([
    "## 이 문서를 사용하는 방법",
    "## 요약",
    "## 영역별 요약",
    "## 수업 설계 원칙",
    "## 학급 지원 고려사항",
    "## 현실적인 제약과 대체안",
    "## AI 협업 지침과 판단 경계",
  ]);
  const notice = CORE_AS_OF_NOTICE(TEST_AS_OF.date, TEST_AS_OF.source);
  expect(section(markdown, "이 문서를 사용하는 방법").trimEnd()).toBe(
    [
      "## 이 문서를 사용하는 방법",
      "",
      ...CORE_USAGE_RULES.map((rule) => `- ${rule}`),
      "",
      notice,
    ].join("\n"),
  );
  expect(markdown.match(/^### .+$/gm)).toEqual(
    PROFILE_MODULE_IDS.map(
      (id) =>
        `### ${profile.modules.find((profileModule) => profileModule.id === id)!.title}`,
    ),
  );
  const synthesisTexts = new Set(
    [
      profile.shortSummary,
      ...profile.modules.map((profileModule) => profileModule.summary),
      ...profile.teachingDesignPrinciples,
      ...profile.classSupportConsiderations,
      ...profile.realisticConstraints,
      ...profile.aiCollaborationInstructions,
    ].map(sanitizeMarkdownText),
  );
  for (const profileModule of profile.modules)
    for (const claim of profileModule.claims) {
      if (!synthesisTexts.has(sanitizeMarkdownText(claim.text)))
        expect(markdown).not.toContain(sanitizeMarkdownText(claim.text));
    }
  for (const excluded of [
    "[직접]",
    "[AI 해석",
    "[검토 전]",
    "### 교사가 직접 말한 내용",
    "## 근거 표시를 읽는 법",
    "## 확인된 교사 맥락",
    CLAIM_REVIEW_WARNING,
    "확인되지 않은 문장 제외",
    "# 수업마다 추가할 작업 컨텍스트",
    "# AI에게 바로 전달할 실행 프롬프트",
    "## 생성 결과 자기 점검",
  ])
    expect(markdown).not.toContain(excluded);
  expect(markdown.split(notice)).toHaveLength(2);
  expect(markdown.indexOf(notice)).toBeLessThan(markdown.indexOf("## 요약"));
  expect(markdown).not.toContain(
    AS_OF_NOTICE(TEST_AS_OF.date, TEST_AS_OF.source),
  );
  expect(markdown.endsWith("\n")).toBe(true);
  expect(markdown.endsWith("\n\n")).toBe(false);
});

it("preserves ordered summaries and every synthesis item including duplicates and multiple lines", () => {
  const profile = structuredClone(MAX_VARIANT_PROFILE);
  profile.shortSummary = "전체 요약 첫 줄\n전체 요약 둘째 줄";
  profile.modules[1]!.summary =
    "요약 <선택> & 확인\njavascript: 대신 안전한 안내";
  profile.teachingDesignPrinciples[2] = "첫 번째 원칙\n두 번째 줄";
  profile.teachingDesignPrinciples[3] = profile.teachingDesignPrinciples[2]!;
  profile.classSupportConsiderations[1] = profile.teachingDesignPrinciples[2]!;
  profile.modules.reverse();
  const markdown = variantMarkdown(
    profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
  );
  expect(section(markdown, "요약").trimEnd()).toBe(
    `## 요약\n\n${sanitizeMarkdownText(profile.shortSummary)}`,
  );
  expect(section(markdown, "영역별 요약").trimEnd()).toBe(
    "## 영역별 요약" +
      PROFILE_MODULE_IDS.map((id) => {
        const profileModule = profile.modules.find((item) => item.id === id)!;
        return `\n\n### ${sanitizeMarkdownText(profileModule.title)}\n\n${sanitizeMarkdownText(profileModule.summary)}`;
      }).join(""),
  );
  for (const [title, values] of [
    ["수업 설계 원칙", profile.teachingDesignPrinciples],
    ["학급 지원 고려사항", profile.classSupportConsiderations],
    ["현실적인 제약과 대체안", profile.realisticConstraints],
    ["AI 협업 지침과 판단 경계", profile.aiCollaborationInstructions],
  ] as const) {
    expect(section(markdown, title).trimEnd()).toBe(
      `## ${title}\n\n${values.map((text) => `- ${bulletText(text)}`).join("\n")}`,
    );
  }
  expect(markdown).toContain("&lt;선택&gt; &amp;");
  expect(markdown).toContain("javascript&#58;");
  expect(markdown).not.toContain("javascript:");
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
  expect(core).not.toContain("## 영역별 요약");
  for (const title of [
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

it("omits sanitized-empty summaries and keeps only nonempty module summaries", () => {
  const profile = structuredClone(MAX_VARIANT_PROFILE);
  profile.shortSummary = "\u0000 \r\n \u0001";
  profile.modules.forEach((profileModule) => {
    profileModule.summary = " \u0000\r\n ";
  });
  profile.modules[1]!.summary = "  남겨 둘 첫 줄\r\n둘째 줄  ";
  const core = variantMarkdown(
    profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
  );
  expect(core).not.toContain("## 요약");
  expect(section(core, "영역별 요약").trimEnd()).toBe(
    `## 영역별 요약\n\n### ${profile.modules[1]!.title}\n\n남겨 둘 첫 줄\n둘째 줄`,
  );
  expect(core.match(/^### .+$/gm)).toEqual([
    `### ${profile.modules[1]!.title}`,
  ]);
  const notice = CORE_AS_OF_NOTICE(TEST_AS_OF.date, TEST_AS_OF.source);
  expect(core.split(notice)).toHaveLength(2);
  expect(core.indexOf(notice)).toBeLessThan(core.indexOf("## 영역별 요약"));
});

it.each(FICTIONAL_PROFILES)(
  "keeps the $metadata.schoolLevel fictional core within 35 percent of the full export",
  (profile) => {
    const full = profileToMarkdown(profile);
    const core = variantMarkdown(
      profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
    );
    expect(core.length).toBeLessThanOrEqual(full.length * 0.35);
    expect(core).toContain(sanitizeMarkdownText(profile.shortSummary));
    for (const profileModule of profile.modules)
      expect(core).toContain(
        `### ${sanitizeMarkdownText(profileModule.title)}\n\n${sanitizeMarkdownText(profileModule.summary)}`,
      );
  },
);

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
