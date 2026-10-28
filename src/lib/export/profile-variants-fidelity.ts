import {
  AS_OF_NOTICE,
  CLAIM_GROUPS,
  CLAIM_REVIEW_WARNING,
  CORE_CLAIM_LABELS,
  CORE_EXCLUDED_NOTICE,
  CORE_USAGE_RULES,
  EMPTY_SECTION_LINE,
  EVIDENCE_GUIDE_LINES,
  MODULE_SCOPE_NOTICE,
  PRIVACY_REVIEW_WARNING,
  PRIVACY_UNVERIFIED_WARNING,
  VARIANT_SECTION_TITLES,
} from "@/content/export-variants";
import {
  PROFILE_MODULE_IDS,
  teacherContextProfileSchema,
  type ProfileClaim,
  type ProfileModuleId,
  type TeacherContextProfile,
} from "@/types/profile";
import type { ContextAsOf, OptionalSectionId } from "./profile-variants";
import { sanitizeMarkdownText } from "./sanitize";

export type FidelityRule =
  "unknown_line" | "claim_coverage" | "constraints" | "ai_label" | "as_of";
export type FidelityIssue = { rule: FidelityRule; detail: string };

type SectionId = OptionalSectionId | "aiCollaborationInstructions";
type Item = {
  raw: string;
  module: ProfileModuleId | null;
  section: string;
  group: ProfileClaim["basis"] | null;
};
const sectionIds = Object.keys(VARIANT_SECTION_TITLES) as SectionId[];
const safe = sanitizeMarkdownText;
const list = (text: string) => `- ${safe(text).replaceAll("\n", "\n  ")}`;
const eligible = (claim: ProfileClaim) =>
  claim.confirmedByUser && claim.basis !== "needs_confirmation";
const coreClaim = (claim: ProfileClaim) =>
  `- ${claim.basis === "inferred" ? CORE_CLAIM_LABELS.inferred : CORE_CLAIM_LABELS.direct} ${safe(claim.text).replaceAll("\n", "\n  ")}`;
const moduleClaim = (claim: ProfileClaim) =>
  `${list(claim.text)}${claim.confirmedByUser ? "" : " **[검토 전]**"}`;
const sameCounts = (left: readonly string[], right: readonly string[]) => {
  const counts = new Map<string, number>();
  for (const value of left) counts.set(value, (counts.get(value) ?? 0) + 1);
  for (const value of right) counts.set(value, (counts.get(value) ?? 0) - 1);
  return [...counts.values()].every((count) => count === 0);
};

/** Checks canonical provenance independently of the Markdown generators. */
export function verifyVariantFidelity(input: {
  profile: TeacherContextProfile;
  variant: "core" | "modules";
  markdown: string;
  modules?: readonly ProfileModuleId[];
  sections?: readonly OptionalSectionId[];
  asOf: ContextAsOf;
}): FidelityIssue[] {
  const parsed = teacherContextProfileSchema.safeParse(input.profile);
  if (!parsed.success)
    return [{ rule: "unknown_line", detail: "Invalid canonical profile." }];
  const profile = parsed.data;
  const issues: FidelityIssue[] = [];
  const add = (rule: FidelityRule, detail: string) => {
    if (!issues.some((issue) => issue.rule === rule && issue.detail === detail))
      issues.push({ rule, detail });
  };
  const core = input.variant === "core";
  const modules = PROFILE_MODULE_IDS.map((id) =>
    profile.modules.find((profileModule) => profileModule.id === id)!,
  );
  const selected = new Set(core ? PROFILE_MODULE_IDS : (input.modules ?? []));
  const selectedModules = modules.filter((profileModule) =>
    selected.has(profileModule.id),
  );
  const includedSections = new Set<SectionId>(
    core
      ? sectionIds
      : [...(input.sections ?? []), "aiCollaborationInstructions"],
  );
  const excluded = modules
    .flatMap((profileModule) => profileModule.claims)
    .filter((claim) => !eligible(claim)).length;
  const emptyTitles = modules
    .filter((profileModule) => !profileModule.claims.some(eligible))
    .map((profileModule) => safe(profileModule.title));
  const excludedNotice = CORE_EXCLUDED_NOTICE(excluded, emptyTitles);
  const asOfNotice = AS_OF_NOTICE(input.asOf.date, input.asOf.source);
  const scopeNotice = MODULE_SCOPE_NOTICE(
    selectedModules.map((profileModule) => safe(profileModule.title)).join("·"),
  );

  // Build expected coverage directly from canonical records, retaining source locations.
  const seen = new Set<string>();
  const first = (text: string) => {
    const key = safe(text).replace(/\s+/gu, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  const expectedClaims = new Map<ProfileModuleId, ProfileClaim[]>();
  for (const profileModule of modules) {
    expectedClaims.set(
      profileModule.id,
      !selected.has(profileModule.id)
        ? []
        : core
          ? profileModule.claims
              .filter(eligible)
              .filter((claim) => first(claim.text))
          : profileModule.claims,
    );
  }
  const expectedSections = new Map<SectionId, string[]>();
  for (const id of sectionIds) {
    const values = !includedSections.has(id)
      ? []
      : core &&
          (id === "teachingDesignPrinciples" ||
            id === "classSupportConsiderations")
        ? profile[id].filter(first)
        : profile[id];
    expectedSections.set(id, values.map(list));
  }

  const raw = input.markdown.replaceAll("\r\n", "\n");
  const header = raw.match(/^---\n[\s\S]*?\n---(?:\n|$)/u);
  if (!header) add("unknown_line", "Missing or malformed front matter.");
  const body = header ? raw.slice(header[0].length) : raw;
  const lines = body.split("\n");
  const matches = (at: number, text: string) =>
    text.length > 0 &&
    text.split("\n").every((line, offset) => lines[at + offset] === line);

  // Whole multiline fragments prevent a truncated sentence from passing as a known prefix.
  const fragments = new Set<string>([
    ...CORE_USAGE_RULES.map((rule) => `- ${rule}`),
    ...EVIDENCE_GUIDE_LINES,
    PRIVACY_UNVERIFIED_WARNING,
    PRIVACY_REVIEW_WARNING,
    CLAIM_REVIEW_WARNING,
    EMPTY_SECTION_LINE,
    "- 작성된 내용이 없습니다.",
    asOfNotice,
    excludedNotice,
    "## 이 문서를 사용하는 방법",
    "## 확인된 교사 맥락",
    "## 요약",
    "## 이 문서의 범위",
    "## 근거 표시를 읽는 법",
    scopeNotice,
    `# ${safe(profile.profileTitle)}`,
    ...sectionIds.map((id) => `## ${VARIANT_SECTION_TITLES[id]}`),
    ...CLAIM_GROUPS.map((group) => `### ${group.title}`),
  ]);
  const canonicalTexts = [
    profile.profileTitle,
    profile.shortSummary,
    ...modules.flatMap((profileModule) => [
      profileModule.title,
      profileModule.summary,
      ...profileModule.claims.map((claim) => claim.text),
    ]),
    ...sectionIds.flatMap((id) => profile[id]),
  ];
  for (const text of [
    profile.profileTitle,
    profile.shortSummary,
    ...modules.map((profileModule) => profileModule.summary),
  ]) {
    if (safe(text)) fragments.add(safe(text));
  }
  for (const text of canonicalTexts) {
    if (!safe(text)) continue;
    fragments.add(list(text));
    fragments.add(`${list(text)} **[검토 전]**`);
    for (const label of Object.values(CORE_CLAIM_LABELS))
      fragments.add(`- ${label} ${safe(text).replaceAll("\n", "\n  ")}`);
  }
  for (const profileModule of modules) {
    fragments.add(`### ${safe(profileModule.title)}`);
    fragments.add(
      `## M${PROFILE_MODULE_IDS.indexOf(profileModule.id) + 1}. ${safe(profileModule.title)}`,
    );
  }
  const allowed = [...fragments]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (let at = 0; at < lines.length;) {
    if (!lines[at]!.trim()) {
      at++;
      continue;
    }
    const fragment = allowed.find((candidate) => matches(at, candidate));
    if (fragment) at += fragment.split("\n").length;
    else {
      add("unknown_line", `Unknown content at body line ${at + 1}.`);
      at++;
    }
  }

  const items: Item[] = [];
  const notices = new Set<string>();
  const actualModules = new Set<ProfileModuleId>();
  const actualSections = new Set<string>();
  let moduleId: ProfileModuleId | null = null;
  let section = "overview";
  let group: ProfileClaim["basis"] | null = null;
  let lastCoreModule = -1;
  let summaryPending = false;
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at]!;
    if (!line.trim()) continue;
    // Summaries can contain multiple lines; do not mistake their text for structure.
    const summary = moduleId
      ? modules.find((profileModule) => profileModule.id === moduleId)!.summary
      : section === "summary"
        ? profile.shortSummary
        : "";
    if (summaryPending) {
      summaryPending = false;
      if (summary && matches(at, safe(summary))) {
        at += safe(summary).split("\n").length - 1;
        continue;
      }
    }
    if (matches(at, `# ${safe(profile.profileTitle)}`)) {
      at += safe(profile.profileTitle).split("\n").length - 1;
      continue;
    }
    if (moduleId === null) {
      const notice = [
        scopeNotice,
        excludedNotice,
        PRIVACY_UNVERIFIED_WARNING,
        PRIVACY_REVIEW_WARNING,
        CLAIM_REVIEW_WARNING,
      ].find((value) => matches(at, value));
      if (notice) {
        at += notice.split("\n").length - 1;
        continue;
      }
    }
    const numbered = modules.find((profileModule) =>
      matches(
        at,
        `## M${PROFILE_MODULE_IDS.indexOf(profileModule.id) + 1}. ${safe(profileModule.title)}`,
      ),
    );
    const coreModule =
      core && section === "context"
        ? modules.find(
            (profileModule, index) =>
              index > lastCoreModule &&
              matches(at, `### ${safe(profileModule.title)}`),
          )
        : undefined;
    if (numbered || coreModule) {
      const profileModule = (numbered ?? coreModule)!;
      moduleId = profileModule.id;
      group = null;
      summaryPending = true;
      actualModules.add(profileModule.id);
      if (coreModule)
        lastCoreModule = PROFILE_MODULE_IDS.indexOf(profileModule.id);
      at += safe(profileModule.title).split("\n").length - 1;
      continue;
    }
    if (line.startsWith("## ")) {
      moduleId = null;
      group = null;
      section =
        sectionIds.find((id) => line === `## ${VARIANT_SECTION_TITLES[id]}`) ??
        (line === "## 확인된 교사 맥락"
          ? "context"
          : line === "## 요약"
            ? "summary"
            : "overview");
      actualSections.add(section);
      summaryPending = section === "summary";
      continue;
    }
    const claimGroup = CLAIM_GROUPS.find(
      (entry) => line === `### ${entry.title}`,
    );
    if (claimGroup) {
      group = claimGroup.basis;
      continue;
    }
    if (line === asOfNotice) {
      notices.add(moduleId ?? section);
      continue;
    }
    if (!line.startsWith("- ")) continue;
    let item = line;
    while (lines[at + 1]?.startsWith("  ")) item += `\n${lines[++at]}`;
    items.push({ raw: item, module: moduleId, section, group });
  }

  for (const profileModule of modules) {
    const expected = expectedClaims.get(profileModule.id)!;
    const actual = items.filter(
      (item) =>
        item.module === profileModule.id &&
        (expected.length > 0 || item.raw !== "- 작성된 내용이 없습니다."),
    );
    if (
      !sameCounts(
        expected.map(core ? coreClaim : moduleClaim),
        actual.map((item) => item.raw),
      )
    )
      add("claim_coverage", `Claim coverage differs in ${profileModule.id}.`);
    for (const claim of expected.filter(
      (claim) => claim.basis === "inferred",
    )) {
      const expectedItem = core ? coreClaim(claim) : moduleClaim(claim);
      if (
        !actual.some(
          (item) =>
            item.raw === expectedItem && (core || item.group === "inferred"),
        )
      )
        add(
          "ai_label",
          `Missing inference attribution in ${profileModule.id}.`,
        );
    }
  }
  if (
    core &&
    (excluded > 0
      ? !body.includes(excludedNotice)
      : /확인되지 않은 문장 \d+개는 이 핵심본에서 제외/u.test(body))
  )
    add(
      "claim_coverage",
      "Excluded claim notice differs from canonical counts.",
    );

  // A canonical claim inserted into an unrelated location is still a leak.
  const claimItems = new Set(
    modules.flatMap((profileModule) =>
      profileModule.claims.flatMap((claim) => [
        list(claim.text),
        coreClaim(claim),
        moduleClaim(claim),
      ]),
    ),
  );
  const fixedOverviewItems = new Set<string>([
    ...CORE_USAGE_RULES.map((rule) => `- ${rule}`),
    ...EVIDENCE_GUIDE_LINES,
    EMPTY_SECTION_LINE,
  ]);
  for (const item of items.filter((item) => item.module === null)) {
    if (
      claimItems.has(item.raw) &&
      !fixedOverviewItems.has(item.raw) &&
      !expectedSections.get(item.section as SectionId)?.includes(item.raw)
    )
      add(
        "claim_coverage",
        "Claim appears outside its selected module or canonical synthesis section.",
      );
  }
  for (const id of [
    "realisticConstraints",
    "aiCollaborationInstructions",
  ] as const) {
    const expected = expectedSections.get(id)!;
    const actual = items.filter(
      (item) =>
        item.module === null &&
        item.section === id &&
        (expected.length > 0 || item.raw !== EMPTY_SECTION_LINE),
    );
    if (
      actualSections.has(id) !== includedSections.has(id) ||
      !sameCounts(
        expected,
        actual.map((item) => item.raw),
      )
    )
      add("constraints", `Protected section differs: ${id}.`);
  }
  const protectedItems = new Set(
    [
      ...profile.realisticConstraints,
      ...profile.aiCollaborationInstructions,
    ].flatMap((text) => [
      list(text),
      `${list(text)} **[검토 전]**`,
      ...Object.values(CORE_CLAIM_LABELS).map(
        (label) => `- ${label} ${safe(text).replaceAll("\n", "\n  ")}`,
      ),
    ]),
  );
  for (const item of items) {
    if (!protectedItems.has(item.raw)) continue;
    const allowedHere =
      item.module !== null
        ? expectedClaims
            .get(item.module)!
            .some(
              (claim) =>
                (core ? coreClaim(claim) : moduleClaim(claim)) === item.raw,
            )
        : expectedSections.get(item.section as SectionId)?.includes(item.raw) ||
          ((item.section === "overview" || item.section === "context") &&
            fixedOverviewItems.has(item.raw));
    if (!allowedHere)
      add(
        "constraints",
        "Protected content appears outside a permitted canonical location.",
      );
  }
  if (actualModules.has("class_context") && !notices.has("class_context"))
    add("as_of", "Missing class context reference date.");
  if (
    includedSections.has("classSupportConsiderations") &&
    !notices.has("classSupportConsiderations")
  )
    add("as_of", "Missing class support reference date.");
  return issues;
}
