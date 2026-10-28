import { z } from "zod";
import {
  CONTEXT_DOCUMENT_TITLE,
  SCHOOL_LEVEL_DISPLAY_LABELS,
} from "@/content/profile-document";
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
  VARIANT_FORMAT_VERSION,
  VARIANT_SECTION_TITLES,
} from "@/content/export-variants";
import { TEACHER_ROLE_LABELS, teacherRoleSchema } from "@/types/interview";
import {
  PROFILE_MODULE_IDS,
  TEACHING_SUBJECT_LABELS,
  isPendingPrivacyReview,
  isUnverifiedPrivacyReview,
  profileModuleIdSchema,
  teacherContextProfileSchema,
  type ProfileClaim,
  type ProfileModule,
  type ProfileModuleId,
  type SchoolLevel,
  type TeacherContextProfile,
} from "@/types/profile";
import { profileMarkdownFilename } from "./download";
import { sanitizeMarkdownText, yamlQuoted } from "./sanitize";

export type ContextAsOf = { date: string; source: "confirmed" | "generated" };
export type OptionalSectionId =
  | "teachingDesignPrinciples"
  | "classSupportConsiderations"
  | "realisticConstraints";
export const OPTIONAL_SECTION_IDS: readonly OptionalSectionId[] = [
  "teachingDesignPrinciples",
  "classSupportConsiderations",
  "realisticConstraints",
];
export type VariantResult =
  | { ok: true; markdown: string }
  | { ok: false; error: "invalid" | "pending_review" | "no_modules" };

const asOfSchema = z
  .object({ date: z.iso.date(), source: z.enum(["confirmed", "generated"]) })
  .strict();
const coreOptionsSchema = z.object({ asOf: asOfSchema }).strict();
const moduleOptionsSchema = coreOptionsSchema.extend({
  modules: z.array(profileModuleIdSchema),
  sections: z.array(
    z.enum([
      "teachingDesignPrinciples",
      "classSupportConsiderations",
      "realisticConstraints",
    ]),
  ),
});

export function contextAsOf(
  profile: TeacherContextProfile,
  confirmedAt?: string | null,
): ContextAsOf {
  const confirmed = z.iso.datetime({ offset: true }).safeParse(confirmedAt);
  const date = new Date(
    confirmed.success ? confirmed.data : profile.metadata.generatedAt,
  );
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  return {
    date: `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`,
    source: confirmed.success ? "confirmed" : "generated",
  };
}

const safe = sanitizeMarkdownText;
const listText = (text: string) => safe(text).replaceAll("\n", "\n  ");
const confirmedClaim = (claim: ProfileClaim) =>
  claim.confirmedByUser && claim.basis !== "needs_confirmation";
function orderedModules(profile: TeacherContextProfile): ProfileModule[] {
  return PROFILE_MODULE_IDS.map((id) =>
    profile.modules.find((module) => module.id === id)!,
  );
}

function frontMatter(
  profile: TeacherContextProfile,
  variant: "core" | "modules",
  asOf: ContextAsOf,
  modules: readonly ProfileModule[],
  sections: readonly OptionalSectionId[],
): string {
  const role = teacherRoleSchema.safeParse(profile.metadata.role);
  const needsReview =
    variant === "modules" &&
    modules.some((module) =>
      module.claims.some((claim) => !confirmedClaim(claim)),
    );
  return [
    "---",
    `document_type: ${yamlQuoted("teacher_profile_context")}`,
    `export_variant: ${yamlQuoted(variant)}`,
    `variant_format_version: ${yamlQuoted(VARIANT_FORMAT_VERSION)}`,
    `title: ${yamlQuoted(CONTEXT_DOCUMENT_TITLE)}`,
    `profile_title: ${yamlQuoted(profile.profileTitle)}`,
    `service: ${yamlQuoted("TContext")}`,
    `language: ${yamlQuoted("ko-KR")}`,
    `school_level: ${yamlQuoted(SCHOOL_LEVEL_DISPLAY_LABELS[profile.metadata.schoolLevel])}`,
    `role: ${yamlQuoted(role.success ? TEACHER_ROLE_LABELS[role.data] : profile.metadata.role)}`,
    ...(profile.metadata.teachingSubject === undefined
      ? []
      : [
          `teaching_subject: ${yamlQuoted(TEACHING_SUBJECT_LABELS[profile.metadata.teachingSubject])}`,
        ]),
    `schema_version: ${yamlQuoted(profile.metadata.schemaVersion)}`,
    `created_at: ${yamlQuoted(profile.metadata.generatedAt)}`,
    `context_as_of: ${yamlQuoted(asOf.date)}`,
    `context_as_of_source: ${yamlQuoted(asOf.source)}`,
    `privacy_rule: ${yamlQuoted("이름·학교명·특정 학급명·개별 학생 정보는 포함하지 않음")}`,
    `privacy_review: ${yamlQuoted(profile.privacyReview.status)}`,
    `needs_claim_review: ${needsReview}`,
    ...(variant === "modules"
      ? [
          `included_modules: [${modules.map((module) => yamlQuoted(module.id)).join(", ")}]`,
          `included_sections: [${sections.map(yamlQuoted).join(", ")}]`,
        ]
      : []),
    "---",
  ].join("\n");
}

function privacyWarning(profile: TeacherContextProfile): string[] {
  if (isUnverifiedPrivacyReview(profile.privacyReview))
    return ["", PRIVACY_UNVERIFIED_WARNING];
  return profile.privacyReview.status === "needs_review"
    ? ["", PRIVACY_REVIEW_WARNING]
    : [];
}

function appendSection(
  lines: string[],
  id: OptionalSectionId | "aiCollaborationInstructions",
  values: readonly string[],
  asOf: ContextAsOf,
) {
  lines.push("", `## ${VARIANT_SECTION_TITLES[id]}`, "");
  if (id === "classSupportConsiderations")
    lines.push(AS_OF_NOTICE(asOf.date, asOf.source), "");
  lines.push(
    values.length
      ? values.map((value) => `- ${listText(value)}`).join("\n")
      : EMPTY_SECTION_LINE,
  );
}

export function profileToCoreMarkdown(
  profile: unknown,
  options: { asOf: ContextAsOf },
): VariantResult {
  const parsed = teacherContextProfileSchema.safeParse(profile);
  const config = coreOptionsSchema.safeParse(options);
  if (!parsed.success || !config.success)
    return { ok: false, error: "invalid" };
  const data = parsed.data;
  if (isPendingPrivacyReview(data.privacyReview))
    return { ok: false, error: "pending_review" };
  const { asOf } = config.data;
  const modules = orderedModules(data);
  const excluded = modules
    .flatMap((module) => module.claims)
    .filter((claim) => !confirmedClaim(claim)).length;
  const empty = modules
    .filter((module) => !module.claims.some(confirmedClaim))
    .map((module) => safe(module.title));
  const lines = [
    frontMatter(data, "core", asOf, modules, []),
    "",
    `# ${safe(data.profileTitle)}`,
    "",
    "## 이 문서를 사용하는 방법",
    "",
    ...CORE_USAGE_RULES.map((rule) => `- ${rule}`),
    ...privacyWarning(data),
  ];
  if (excluded) lines.push("", CORE_EXCLUDED_NOTICE(excluded, empty));
  if (data.shortSummary) lines.push("", "## 요약", "", safe(data.shortSummary));
  lines.push("", "## 확인된 교사 맥락");
  const seen = new Set<string>();
  const first = (text: string) => {
    const key = safe(text).replace(/\s+/gu, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  let hasConfirmed = false;
  for (const profileModule of modules) {
    const claims = profileModule.claims.filter(confirmedClaim);
    if (!claims.length) continue;
    hasConfirmed = true;
    lines.push("", `### ${safe(profileModule.title)}`);
    if (profileModule.summary) lines.push("", safe(profileModule.summary));
    if (profileModule.id === "class_context")
      lines.push("", AS_OF_NOTICE(asOf.date, asOf.source));
    lines.push("");
    for (const claim of claims) {
      if (claim.basis !== "needs_confirmation" && first(claim.text))
        lines.push(
          `- ${CORE_CLAIM_LABELS[claim.basis]} ${listText(claim.text)}`,
        );
    }
  }
  if (!hasConfirmed) lines.push("", EMPTY_SECTION_LINE);
  appendSection(
    lines,
    "teachingDesignPrinciples",
    data.teachingDesignPrinciples.filter(first),
    asOf,
  );
  appendSection(
    lines,
    "classSupportConsiderations",
    data.classSupportConsiderations.filter(first),
    asOf,
  );
  appendSection(lines, "realisticConstraints", data.realisticConstraints, asOf);
  appendSection(
    lines,
    "aiCollaborationInstructions",
    data.aiCollaborationInstructions,
    asOf,
  );
  return { ok: true, markdown: lines.join("\n") + "\n" };
}

// Kept local so the canonical exporter and its output contract stay untouched.
function moduleBlock(module: ProfileModule): string[] {
  const lines = [
    `## M${PROFILE_MODULE_IDS.indexOf(module.id) + 1}. ${safe(module.title)}`,
    "",
    safe(module.summary),
  ];
  let hasClaims = false;
  for (const group of CLAIM_GROUPS) {
    const claims = module.claims.filter((claim) => claim.basis === group.basis);
    if (!claims.length) continue;
    hasClaims = true;
    lines.push("", `### ${group.title}`, "");
    for (const claim of claims)
      lines.push(
        `- ${listText(claim.text)}${claim.confirmedByUser ? "" : " **[검토 전]**"}`,
      );
  }
  if (!hasClaims) lines.push("", "- 작성된 내용이 없습니다.");
  return lines;
}

export function profileToModuleMarkdown(
  profile: unknown,
  options: {
    asOf: ContextAsOf;
    modules: readonly ProfileModuleId[];
    sections: readonly OptionalSectionId[];
  },
): VariantResult {
  const parsed = teacherContextProfileSchema.safeParse(profile);
  const config = moduleOptionsSchema.safeParse(options);
  if (!parsed.success || !config.success)
    return { ok: false, error: "invalid" };
  const data = parsed.data;
  if (isPendingPrivacyReview(data.privacyReview))
    return { ok: false, error: "pending_review" };
  if (!config.data.modules.length) return { ok: false, error: "no_modules" };
  const { asOf } = config.data;
  const modules = orderedModules(data).filter((module) =>
    config.data.modules.includes(module.id),
  );
  const sections = OPTIONAL_SECTION_IDS.filter((id) =>
    config.data.sections.includes(id),
  );
  const lines = [
    frontMatter(data, "modules", asOf, modules, sections),
    "",
    `# ${safe(data.profileTitle)}`,
    "",
    "## 이 문서의 범위",
    "",
    MODULE_SCOPE_NOTICE(modules.map((module) => safe(module.title)).join("·")),
    "",
    ...CORE_USAGE_RULES.map((rule) => `- ${rule}`),
    "",
    "## 근거 표시를 읽는 법",
    "",
    ...EVIDENCE_GUIDE_LINES,
    ...privacyWarning(data),
  ];
  if (
    modules.some((module) =>
      module.claims.some((claim) => !confirmedClaim(claim)),
    )
  )
    lines.push("", CLAIM_REVIEW_WARNING);
  for (const profileModule of modules) {
    lines.push("", ...moduleBlock(profileModule));
    if (profileModule.id === "class_context")
      lines.push("", AS_OF_NOTICE(asOf.date, asOf.source));
  }
  for (const id of sections) appendSection(lines, id, data[id], asOf);
  appendSection(
    lines,
    "aiCollaborationInstructions",
    data.aiCollaborationInstructions,
    asOf,
  );
  return { ok: true, markdown: lines.join("\n") + "\n" };
}

export function variantMarkdownFilename(
  schoolLevel: SchoolLevel,
  variant: "core" | "modules",
  date?: Date,
): string {
  return profileMarkdownFilename(schoolLevel, date).replace(
    /\.md$/u,
    `-${variant}.md`,
  );
}
