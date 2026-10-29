// @vitest-environment node
import { expect, it } from "vitest";
import {
  AS_OF_NOTICE,
  CORE_AS_OF_NOTICE,
  CORE_USAGE_RULES,
} from "@/content/export-variants";
import { PROFILE_MODULE_IDS, type ProfileModuleId } from "@/types/profile";
import {
  verifyVariantFidelity,
  type FidelityRule,
} from "./profile-variants-fidelity";
import {
  OPTIONAL_SECTION_IDS,
  profileToCoreMarkdown,
  profileToModuleMarkdown,
} from "./profile-variants";
import {
  MAX_VARIANT_PROFILE,
  TEST_AS_OF,
  VARIANT_FIXTURES,
  variantMarkdown,
} from "./profile-variants.test-fixtures";
import { sanitizeMarkdownText } from "./sanitize";

const selections: ReadonlyArray<readonly ProfileModuleId[]> = [
  ["identity_and_role"],
  ["identity_and_role", "class_context", "environment_and_ai"],
  PROFILE_MODULE_IDS,
];

it.each(VARIANT_FIXTURES)(
  "accepts core and all six selection combinations without fidelity issues: $name",
  ({ profile }) => {
    const core = variantMarkdown(
      profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
    );
    expect(
      verifyVariantFidelity({
        profile,
        variant: "core",
        markdown: core,
        asOf: TEST_AS_OF,
      }),
    ).toEqual([]);
    for (const modules of selections)
      for (const sections of [OPTIONAL_SECTION_IDS, []] as const) {
        const markdown = variantMarkdown(
          profileToModuleMarkdown(profile, {
            asOf: TEST_AS_OF,
            modules,
            sections,
          }),
        );
        expect(
          verifyVariantFidelity({
            profile,
            variant: "modules",
            markdown,
            modules,
            sections,
            asOf: TEST_AS_OF,
          }),
          `${modules.length} modules, ${sections.length} sections`,
        ).toEqual([]);
      }
  },
);

it("accepts repeated synthesis items and multiline summaries without deduplication", () => {
  const profile = structuredClone(MAX_VARIANT_PROFILE);
  profile.modules[4]!.summary =
    "교사가 확인한 요약 첫 줄입니다.\n교사가 확인한 요약 둘째 줄입니다.";
  profile.teachingDesignPrinciples[1] = profile.teachingDesignPrinciples[0]!;
  profile.classSupportConsiderations[0] = profile.teachingDesignPrinciples[0]!;
  const markdown = variantMarkdown(
    profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
  );
  expect(
    verifyVariantFidelity({
      profile,
      variant: "core",
      markdown,
      asOf: TEST_AS_OF,
    }),
  ).toEqual([]);
});

const profile = MAX_VARIANT_PROFILE;
const direct = profile.modules[0]!.claims[0]!.text;
const inferred = profile.modules[0]!.claims[1]!.text;
const notice = AS_OF_NOTICE(TEST_AS_OF.date, TEST_AS_OF.source);
const coreNotice = CORE_AS_OF_NOTICE(TEST_AS_OF.date, TEST_AS_OF.source);
const coreMutations: ReadonlyArray<{
  name: string;
  rule: FidelityRule;
  mutate: (markdown: string) => string;
}> = [
  {
    name: "truncated principle",
    rule: "claim_coverage",
    mutate: (md) =>
      md.replace(
        profile.teachingDesignPrinciples[1]!,
        profile.teachingDesignPrinciples[1]!.slice(0, -10),
      ),
  },
  {
    name: "missing synthesis attribution rule",
    rule: "ai_label",
    mutate: (md) => md.replace(`- ${CORE_USAGE_RULES[1]}\n`, ""),
  },
  {
    name: "missing constraint",
    rule: "constraints",
    mutate: (md) => md.replace(`- ${profile.realisticConstraints[1]}\n`, ""),
  },
  {
    name: "missing AI instruction",
    rule: "constraints",
    mutate: (md) =>
      md.replace(`- ${profile.aiCollaborationInstructions[1]}\n`, ""),
  },
  {
    name: "missing document date",
    rule: "as_of",
    mutate: (md) => md.replace(coreNotice, ""),
  },
  {
    name: "document date moved after synthesis",
    rule: "as_of",
    mutate: (md) => `${md.replace(coreNotice, "")}\n${coreNotice}\n`,
  },
  {
    name: "invented list item",
    rule: "unknown_line",
    mutate: (md) => `${md}\n- 이 문장은 교사 원문에 없는 새로운 주장입니다.\n`,
  },
  {
    name: "claim inserted as a list inside module summaries",
    rule: "claim_coverage",
    mutate: (md) =>
      md.replace(
        "## 영역별 요약",
        `## 영역별 요약\n\n- ${profile.modules[0]!.claims[2]!.text}`,
      ),
  },
  {
    name: "missing module summary paragraph",
    rule: "claim_coverage",
    mutate: (md) => md.replace(profile.modules[0]!.summary, ""),
  },
  {
    name: "reordered module summary blocks",
    rule: "claim_coverage",
    mutate: (md) => {
      const first = `### ${profile.modules[0]!.title}\n\n${profile.modules[0]!.summary}`;
      const second = `### ${profile.modules[1]!.title}\n\n${profile.modules[1]!.summary}`;
      return md.replace(`${first}\n\n${second}`, `${second}\n\n${first}`);
    },
  },
];
it.each(coreMutations)("detects core mutation: $name", ({ rule, mutate }) => {
  const good = variantMarkdown(
    profileToCoreMarkdown(profile, { asOf: TEST_AS_OF }),
  );
  const bad = mutate(good);
  expect(bad).not.toBe(good);
  expect(
    verifyVariantFidelity({
      profile,
      variant: "core",
      markdown: bad,
      asOf: TEST_AS_OF,
    }).map((issue) => issue.rule),
  ).toContain(rule);
});

const moduleMutations: ReadonlyArray<{
  name: string;
  rule: FidelityRule;
  mutate: (markdown: string) => string;
}> = [
  {
    name: "truncated selected claim",
    rule: "claim_coverage",
    mutate: (md) => md.replace(direct, direct.slice(0, -10)),
  },
  {
    name: "inference under direct group",
    rule: "ai_label",
    mutate: (md) =>
      md.replace(
        "### AI가 답변을 종합해 해석한 내용",
        "### 교사가 직접 말한 내용",
      ),
  },
  {
    name: "removed enabled constraint",
    rule: "constraints",
    mutate: (md) => md.replace(`- ${profile.realisticConstraints[1]}\n`, ""),
  },
  {
    name: "removed AI instruction",
    rule: "constraints",
    mutate: (md) =>
      md.replace(`- ${profile.aiCollaborationInstructions[1]}\n`, ""),
  },
  {
    name: "removed class date while support date remains",
    rule: "as_of",
    mutate: (md) => md.replace(notice, ""),
  },
  {
    name: "invented paragraph",
    rule: "unknown_line",
    mutate: (md) => `${md}\n교사가 말하지 않은 새로운 설명을 덧붙입니다.\n`,
  },
  {
    name: "unselected module claim leaked",
    rule: "claim_coverage",
    mutate: (md) =>
      md.replace(
        `- ${direct}`,
        `- ${direct}\n- ${sanitizeMarkdownText(profile.modules[4]!.claims[0]!.text)}`,
      ),
  },
];
it.each(moduleMutations)(
  "detects selected-module mutation: $name",
  ({ rule, mutate }) => {
    const modules: ProfileModuleId[] = ["identity_and_role", "class_context"];
    const sections = OPTIONAL_SECTION_IDS;
    const good = variantMarkdown(
      profileToModuleMarkdown(profile, { asOf: TEST_AS_OF, modules, sections }),
    );
    const bad = mutate(good);
    expect(bad).not.toBe(good);
    expect(
      verifyVariantFidelity({
        profile,
        variant: "modules",
        markdown: bad,
        modules,
        sections,
        asOf: TEST_AS_OF,
      }).map((issue) => issue.rule),
    ).toContain(rule);
  },
);

it("rejects constraints inserted into a variant where that section is disabled", () => {
  const modules: ProfileModuleId[] = ["identity_and_role"];
  const good = variantMarkdown(
    profileToModuleMarkdown(profile, {
      asOf: TEST_AS_OF,
      modules,
      sections: [],
    }),
  );
  const markdown = good.replace(
    "## AI 협업 지침과 판단 경계",
    `## 현실적인 제약과 대체안\n\n- ${profile.realisticConstraints[1]}\n\n## AI 협업 지침과 판단 경계`,
  );
  expect(
    verifyVariantFidelity({
      profile,
      variant: "modules",
      markdown,
      modules,
      sections: [],
      asOf: TEST_AS_OF,
    }).map((issue) => issue.rule),
  ).toContain("constraints");
});

it.each([false, true])(
  "retains legacy module-checker recognition of excluded-claim notices, all confirmed: %s",
  (allConfirmed) => {
    const source = structuredClone(MAX_VARIANT_PROFILE);
    if (allConfirmed)
      for (const profileModule of source.modules)
        for (const claim of profileModule.claims) {
          claim.confirmedByUser = true;
          claim.basis = "direct";
        }
    const legacyNotice = allConfirmed
      ? "> **확인되지 않은 문장 제외:** 확인되지 않은 문장 0개는 이 핵심본에서 제외했습니다. 전체본에서 확인하고 검토를 마쳐 주세요."
      : `> **확인되지 않은 문장 제외:** 확인되지 않은 문장 16개는 이 핵심본에서 제외했습니다. 전체본에서 확인하고 검토를 마쳐 주세요. 확인된 문장이 없는 영역: ${source.modules[6]!.title}.`;
    const modules: ProfileModuleId[] = ["identity_and_role"];
    const good = variantMarkdown(
      profileToModuleMarkdown(source, {
        asOf: TEST_AS_OF,
        modules,
        sections: [],
      }),
    );
    const markdown = good.replace(
      "## 이 문서의 범위",
      `${legacyNotice}\n\n## 이 문서의 범위`,
    );
    expect(markdown).not.toBe(good);
    expect(
      verifyVariantFidelity({
        profile: source,
        variant: "modules",
        markdown,
        modules,
        sections: [],
        asOf: TEST_AS_OF,
      }),
    ).toEqual([]);
  },
);

it("requires the support date at its own location even when the class module has one", () => {
  for (const variant of ["modules"] as const) {
    const modules: ProfileModuleId[] = ["class_context"];
    const sections = OPTIONAL_SECTION_IDS;
    const good = variantMarkdown(
      profileToModuleMarkdown(profile, {
        asOf: TEST_AS_OF,
        modules,
        sections,
      }),
    );
    const index = good.lastIndexOf(notice);
    expect(index).toBeGreaterThan(good.indexOf(notice));
    const markdown = good.slice(0, index) + good.slice(index + notice.length);
    expect(
      verifyVariantFidelity({
        profile,
        variant,
        markdown,
        modules,
        sections,
        asOf: TEST_AS_OF,
      }).map((issue) => issue.rule),
    ).toContain("as_of");
  }
});

it("detects duplicate dates, duplicate or empty module headings, and changed synthesis order", () => {
  const source = structuredClone(MAX_VARIANT_PROFILE);
  source.modules[6]!.summary = "";
  const good = variantMarkdown(
    profileToCoreMarkdown(source, { asOf: TEST_AS_OF }),
  );
  const firstBlock = `### ${source.modules[0]!.title}\n\n${source.modules[0]!.summary}`;
  const cases: Array<[FidelityRule, string]> = [
    ["as_of", good.replace(coreNotice, `${coreNotice}\n\n${coreNotice}`)],
    [
      "claim_coverage",
      good.replace(firstBlock, `${firstBlock}\n\n${firstBlock}`),
    ],
    [
      "claim_coverage",
      good.replace(
        "## 영역별 요약",
        `## 영역별 요약\n\n### ${source.modules[6]!.title}`,
      ),
    ],
    [
      "claim_coverage",
      good.replace(
        `- ${source.teachingDesignPrinciples[1]}\n- ${source.teachingDesignPrinciples[2]}`,
        `- ${source.teachingDesignPrinciples[2]}\n- ${source.teachingDesignPrinciples[1]}`,
      ),
    ],
    [
      "constraints",
      good.replace(
        `- ${source.realisticConstraints[1]}\n- ${source.realisticConstraints[2]}`,
        `- ${source.realisticConstraints[2]}\n- ${source.realisticConstraints[1]}`,
      ),
    ],
  ];
  for (const [rule, markdown] of cases) {
    expect(markdown).not.toBe(good);
    expect(
      verifyVariantFidelity({
        profile: source,
        variant: "core",
        markdown,
        asOf: TEST_AS_OF,
      }).map((issue) => issue.rule),
    ).toContain(rule);
  }
});

it("accepts empty summaries and synthesis lists and summaries with list-like lines", () => {
  const source = structuredClone(MAX_VARIANT_PROFILE);
  source.shortSummary = "";
  source.modules.forEach((profileModule) => {
    profileModule.summary = "";
  });
  source.teachingDesignPrinciples = [];
  source.classSupportConsiderations = [];
  source.realisticConstraints = [];
  source.aiCollaborationInstructions = [];
  for (const summary of [
    "",
    "- 교사가 확인한 문단입니다.\n## 요약 안에 포함한 글줄입니다.",
  ]) {
    source.modules[0]!.summary = summary;
    const markdown = variantMarkdown(
      profileToCoreMarkdown(source, { asOf: TEST_AS_OF }),
    );
    expect(
      verifyVariantFidelity({
        profile: source,
        variant: "core",
        markdown,
        asOf: TEST_AS_OF,
      }),
    ).toEqual([]);
  }
});

it.each(["core", "modules"] as const)(
  "rejects a canonical claim pasted as an unlabeled paragraph: %s",
  (variant) => {
    const modules: ProfileModuleId[] = ["identity_and_role"];
    const sections = OPTIONAL_SECTION_IDS;
    const good = variantMarkdown(
      variant === "core"
        ? profileToCoreMarkdown(profile, { asOf: TEST_AS_OF })
        : profileToModuleMarkdown(profile, {
            asOf: TEST_AS_OF,
            modules,
            sections,
          }),
    );
    const markdown = `${good}\n\n${sanitizeMarkdownText(inferred)}\n`;
    expect(
      verifyVariantFidelity({
        profile,
        variant,
        markdown,
        modules,
        sections,
        asOf: TEST_AS_OF,
      }).map((issue) => issue.rule),
    ).toContain("unknown_line");
  },
);

it.each(["core", "modules"] as const)(
  "preserves multiline canonical titles and summaries including heading-like text: %s",
  (variant) => {
    const multiline = structuredClone(MAX_VARIANT_PROFILE);
    multiline.modules[0]!.title =
      "역할을 설명하는 첫 번째 제목 줄\n### 제목에 포함된 두 번째 줄";
    multiline.modules[0]!.summary =
      "교사가 검토한 요약 첫 줄입니다.\n## 요약 안의 표제처럼 보이는 줄\n교사가 검토한 요약 마지막 줄입니다.";
    const modules: ProfileModuleId[] = ["identity_and_role"];
    const sections = OPTIONAL_SECTION_IDS;
    const markdown = variantMarkdown(
      variant === "core"
        ? profileToCoreMarkdown(multiline, { asOf: TEST_AS_OF })
        : profileToModuleMarkdown(multiline, {
            asOf: TEST_AS_OF,
            modules,
            sections,
          }),
    );
    expect(markdown).toContain(
      sanitizeMarkdownText(multiline.modules[0]!.title),
    );
    expect(markdown).toContain(
      sanitizeMarkdownText(multiline.modules[0]!.summary),
    );
    expect(
      verifyVariantFidelity({
        profile: multiline,
        variant,
        markdown,
        modules,
        sections,
        asOf: TEST_AS_OF,
      }),
    ).toEqual([]);
  },
);
