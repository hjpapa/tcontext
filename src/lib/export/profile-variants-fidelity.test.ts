// @vitest-environment node
import { expect, it } from "vitest";
import { AS_OF_NOTICE } from "@/content/export-variants";
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

it("accepts deduplicated multiline claims and canonical duplicates in protected sections", () => {
  const profile = structuredClone(MAX_VARIANT_PROFILE);
  profile.modules[4]!.claims[0]!.text =
    profile.modules[2]!.claims[0]!.text.replaceAll(" ", "  ");
  profile.modules[5]!.claims[1]!.text = profile.modules[0]!.claims[1]!.text;
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
const unconfirmed = profile.modules[0]!.claims[2]!.text;
const notice = AS_OF_NOTICE(TEST_AS_OF.date, TEST_AS_OF.source);
const coreMutations: ReadonlyArray<{
  name: string;
  rule: FidelityRule;
  mutate: (markdown: string) => string;
}> = [
  {
    name: "truncated confirmed claim",
    rule: "claim_coverage",
    mutate: (md) => md.replace(direct, direct.slice(0, -10)),
  },
  {
    name: "missing inference label",
    rule: "ai_label",
    mutate: (md) => md.replace(`[AI 해석·교사 승인] ${inferred}`, inferred),
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
    name: "missing class date while support date remains",
    rule: "as_of",
    mutate: (md) => md.replace(notice, ""),
  },
  {
    name: "invented list item",
    rule: "unknown_line",
    mutate: (md) => `${md}\n- 이 문장은 교사 원문에 없는 새로운 주장입니다.\n`,
  },
  {
    name: "unconfirmed claim inserted",
    rule: "claim_coverage",
    mutate: (md) =>
      md.replace(
        `- [직접] ${direct}`,
        `- [직접] ${direct}\n- [AI 해석·교사 승인] ${unconfirmed}`,
      ),
  },
  {
    name: "incorrect excluded count",
    rule: "claim_coverage",
    mutate: (md) =>
      md.replace("확인되지 않은 문장 16개", "확인되지 않은 문장 15개"),
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

it("requires the support date at its own location even when the class module has one", () => {
  for (const variant of ["core", "modules"] as const) {
    const modules: ProfileModuleId[] = ["class_context"];
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
