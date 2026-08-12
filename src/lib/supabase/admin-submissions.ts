import "server-only";

import { z } from "zod";

import { requireAdmin } from "@/lib/admin/auth";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import { profileToLegacyMarkdownV1 } from "@/lib/export/profile-to-markdown-v1";
import { ApiError } from "@/lib/security/api-error";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { teacherRoleSchema, type TeacherRole } from "@/types/interview";
import {
  schoolLevelSchema,
  teacherContextProfileSchema,
  type SchoolLevel,
  type TeacherContextProfile,
} from "@/types/profile";

const TABLE = "teacher_context_submissions";
export const ADMIN_SUBMISSIONS_PAGE_SIZE = 20;
export const adminSubmissionIdSchema = z.uuid();

const timestampSchema = z.iso.datetime({ offset: true });
const nullableTextSchema = z.string().nullable();

const summaryRowSchema = z
  .object({
    id: adminSubmissionIdSchema,
    created_at: timestampSchema,
    retention_until: timestampSchema,
    school_level: schoolLevelSchema,
    teacher_role: teacherRoleSchema,
    model_name: z.string().trim().min(1),
    schema_version: z.string().trim().min(1),
    prompt_version: z.string().trim().min(1),
    profile_title: z.string().trim().min(1),
    short_summary: z.string(),
    privacy_status: nullableTextSchema,
    consent_version: nullableTextSchema,
    consented_at: nullableTextSchema,
  })
  .strict();

const detailRowSchema = z
  .object({
    id: adminSubmissionIdSchema,
    created_at: timestampSchema,
    schema_version: z.string().trim().min(1),
    prompt_version: z.string().trim().min(1),
    app_version: z.string().trim().min(1),
    school_level: schoolLevelSchema,
    teacher_role: teacherRoleSchema,
    profile_title: z.string().trim().min(1),
    short_summary: z.string(),
    profile_json: z.unknown(),
    profile_markdown: z.unknown(),
    model_name: z.string().trim().min(1),
    consent_version: z.unknown(),
    consented_at: z.unknown(),
    retention_until: timestampSchema,
    source: z.string().trim().min(1),
  })
  .strict();

const markdownRowSchema = z
  .object({
    id: adminSubmissionIdSchema,
    profile_json: z.unknown(),
    profile_markdown: z.unknown(),
    consent_version: z.unknown(),
    consented_at: z.unknown(),
  })
  .strict();

const idRowSchema = z.object({ id: adminSubmissionIdSchema }).strict();

export type AdminDocumentAccess = "full" | "summary";

export type AdminSubmissionAccessReason =
  | "consent_missing"
  | "privacy_not_clear"
  | "claims_unconfirmed"
  | "profile_incomplete"
  | "markdown_unavailable";

export type AdminSubmissionSummary = {
  id: string;
  createdAt: string;
  retentionUntil: string;
  schoolLevel: SchoolLevel;
  teacherRole: TeacherRole;
  modelName: string;
  schemaVersion: string;
  promptVersion: string;
  profileTitle: string;
  shortSummary: string;
  documentAccess: AdminDocumentAccess;
};

type AdminSubmissionDetailBase = AdminSubmissionSummary & {
  appVersion: string;
  source: string;
};

export type AdminSubmissionFullDetail = AdminSubmissionDetailBase & {
  documentAccess: "full";
  consentVersion: string;
  consentedAt: string;
  profile: TeacherContextProfile;
  profileMarkdown: string;
};

export type AdminSubmissionSummaryDetail = AdminSubmissionDetailBase & {
  documentAccess: "summary";
  accessReason: AdminSubmissionAccessReason;
};

export type AdminSubmissionDetail =
  AdminSubmissionFullDetail | AdminSubmissionSummaryDetail;

export type AdminSubmissionMarkdownResult =
  { documentAccess: "full"; markdown: string } | { documentAccess: "summary" };

type AdminSubmissionPage = {
  items: AdminSubmissionSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type FullDocumentEvaluation =
  | {
      documentAccess: "full";
      profile: TeacherContextProfile;
      profileMarkdown: string;
      consentVersion: string;
      consentedAt: string;
    }
  | {
      documentAccess: "summary";
      accessReason: AdminSubmissionAccessReason;
    };

function databaseError(cause: unknown): ApiError {
  return new ApiError(
    "database_unavailable",
    503,
    "저장된 문서를 일시적으로 불러올 수 없습니다.",
    { cause },
  );
}

function normalizedPage(page: number): number {
  return Number.isFinite(page)
    ? Math.min(10_000, Math.max(1, Math.trunc(page)))
    : 1;
}

function hasText(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidConsent(
  consentVersion: unknown,
  consentedAt: unknown,
): consentVersion is string {
  return (
    z.string().trim().min(1).safeParse(consentVersion).success &&
    timestampSchema.safeParse(consentedAt).success
  );
}

function matchesCanonicalProfileMarkdown(
  profile: TeacherContextProfile,
  markdown: string,
): boolean {
  return (
    markdown === profileToMarkdown(profile) ||
    markdown === profileToLegacyMarkdownV1(profile)
  );
}

function evaluateFullDocument(input: {
  profileJson: unknown;
  profileMarkdown: unknown;
  consentVersion: unknown;
  consentedAt: unknown;
}): FullDocumentEvaluation {
  if (!hasValidConsent(input.consentVersion, input.consentedAt)) {
    return { documentAccess: "summary", accessReason: "consent_missing" };
  }

  const parsedProfile = teacherContextProfileSchema.safeParse(
    input.profileJson,
  );
  if (!parsedProfile.success) {
    return { documentAccess: "summary", accessReason: "profile_incomplete" };
  }

  if (parsedProfile.data.privacyReview.status !== "clear") {
    return { documentAccess: "summary", accessReason: "privacy_not_clear" };
  }

  const allClaimsConfirmed = parsedProfile.data.modules.every((module) =>
    module.claims.every((claim) => claim.confirmedByUser),
  );
  if (!allClaimsConfirmed) {
    return { documentAccess: "summary", accessReason: "claims_unconfirmed" };
  }

  const parsedMarkdown = z.string().safeParse(input.profileMarkdown);
  if (
    !parsedMarkdown.success ||
    !matchesCanonicalProfileMarkdown(parsedProfile.data, parsedMarkdown.data)
  ) {
    return {
      documentAccess: "summary",
      accessReason: "markdown_unavailable",
    };
  }

  return {
    documentAccess: "full",
    profile: parsedProfile.data,
    profileMarkdown: parsedMarkdown.data,
    consentVersion: input.consentVersion,
    consentedAt: input.consentedAt as string,
  };
}

function summaryFromRow(
  row: z.output<typeof summaryRowSchema>,
  unconfirmedSubmissionIds: ReadonlySet<string>,
): AdminSubmissionSummary {
  const documentAccess =
    row.privacy_status === "clear" &&
    hasText(row.consent_version) &&
    timestampSchema.safeParse(row.consented_at).success &&
    !unconfirmedSubmissionIds.has(row.id)
      ? "full"
      : "summary";

  return {
    id: row.id,
    createdAt: row.created_at,
    retentionUntil: row.retention_until,
    schoolLevel: row.school_level,
    teacherRole: row.teacher_role,
    modelName: row.model_name,
    schemaVersion: row.schema_version,
    promptVersion: row.prompt_version,
    profileTitle: row.profile_title,
    shortSummary: row.short_summary,
    documentAccess,
  };
}

async function getUnconfirmedSubmissionIds(
  submissionIds: readonly string[],
): Promise<Set<string>> {
  if (submissionIds.length === 0) return new Set();

  // JSONB containment is evaluated by Postgres. Only matching IDs cross the
  // server boundary; the list view never retrieves profile JSON or Markdown.
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select("id")
    .in("id", submissionIds)
    .contains("profile_json", {
      modules: [{ claims: [{ confirmedByUser: false }] }],
    });

  if (error) throw databaseError(error);
  try {
    return new Set(
      z
        .array(idRowSchema)
        .parse(data ?? [])
        .map((row) => row.id),
    );
  } catch (error) {
    throw databaseError(error);
  }
}

export async function listAdminSubmissions(options: {
  page: number;
  schoolLevel?: SchoolLevel;
}): Promise<AdminSubmissionPage> {
  await requireAdmin();
  const page = normalizedPage(options.page);
  const offset = (page - 1) * ADMIN_SUBMISSIONS_PAGE_SIZE;
  let query = getSupabaseAdmin()
    .from(TABLE)
    .select(
      "id,created_at,retention_until,school_level,teacher_role,model_name,schema_version,prompt_version,consent_version,consented_at,profile_title:profile_json->>profileTitle,short_summary:profile_json->>shortSummary,privacy_status:profile_json->privacyReview->>status",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + ADMIN_SUBMISSIONS_PAGE_SIZE - 1);

  if (options.schoolLevel) {
    query = query.eq("school_level", options.schoolLevel);
  }

  const { data, error, count } = await query;
  if (error) throw databaseError(error);
  try {
    const rows = z.array(summaryRowSchema).parse(data ?? []);
    const unconfirmedSubmissionIds = await getUnconfirmedSubmissionIds(
      rows.map((row) => row.id),
    );
    const total = count ?? rows.length;
    return {
      items: rows.map((row) => summaryFromRow(row, unconfirmedSubmissionIds)),
      page,
      pageSize: ADMIN_SUBMISSIONS_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / ADMIN_SUBMISSIONS_PAGE_SIZE)),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw databaseError(error);
  }
}

export async function getAdminSubmission(
  submissionId: string,
): Promise<AdminSubmissionDetail | null> {
  await requireAdmin();
  const parsedId = adminSubmissionIdSchema.safeParse(submissionId);
  if (!parsedId.success) return null;

  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select(
      "id,created_at,schema_version,prompt_version,app_version,school_level,teacher_role,profile_title:profile_json->>profileTitle,short_summary:profile_json->>shortSummary,profile_json,profile_markdown,model_name,consent_version,consented_at,retention_until,source",
    )
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error) throw databaseError(error);
  if (!data) return null;
  try {
    const row = detailRowSchema.parse(data);
    const evaluation = evaluateFullDocument({
      profileJson: row.profile_json,
      profileMarkdown: row.profile_markdown,
      consentVersion: row.consent_version,
      consentedAt: row.consented_at,
    });
    const summary: AdminSubmissionSummary = {
      id: row.id,
      createdAt: row.created_at,
      retentionUntil: row.retention_until,
      schoolLevel: row.school_level,
      teacherRole: row.teacher_role,
      modelName: row.model_name,
      schemaVersion: row.schema_version,
      promptVersion: row.prompt_version,
      profileTitle: row.profile_title,
      shortSummary: row.short_summary,
      documentAccess: evaluation.documentAccess,
    };
    const base = {
      ...summary,
      appVersion: row.app_version,
      source: row.source,
    };

    if (evaluation.documentAccess === "summary") {
      return {
        ...base,
        documentAccess: "summary",
        accessReason: evaluation.accessReason,
      };
    }

    return {
      ...base,
      documentAccess: "full",
      consentVersion: evaluation.consentVersion,
      consentedAt: evaluation.consentedAt,
      profile: evaluation.profile,
      profileMarkdown: evaluation.profileMarkdown,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw databaseError(error);
  }
}

export async function getAdminSubmissionMarkdown(
  submissionId: string,
): Promise<AdminSubmissionMarkdownResult | null> {
  await requireAdmin();
  const parsedId = adminSubmissionIdSchema.safeParse(submissionId);
  if (!parsedId.success) return null;

  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select("id,profile_json,profile_markdown,consent_version,consented_at")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error) throw databaseError(error);
  if (!data) return null;
  try {
    const row = markdownRowSchema.parse(data);
    const evaluation = evaluateFullDocument({
      profileJson: row.profile_json,
      profileMarkdown: row.profile_markdown,
      consentVersion: row.consent_version,
      consentedAt: row.consented_at,
    });
    return evaluation.documentAccess === "full"
      ? { documentAccess: "full", markdown: evaluation.profileMarkdown }
      : { documentAccess: "summary" };
  } catch (error) {
    throw databaseError(error);
  }
}
