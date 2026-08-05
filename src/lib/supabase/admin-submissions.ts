import "server-only";

import { z } from "zod";

import { requireAdmin } from "@/lib/admin/auth";
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

const timestampSchema = z.string().trim().min(1);

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
    profile_json: teacherContextProfileSchema,
    profile_markdown: z.string().min(1),
    model_name: z.string().trim().min(1),
    consent_version: z.string().trim().min(1),
    consented_at: timestampSchema,
    retention_until: timestampSchema,
    source: z.literal("web"),
  })
  .strict();

const markdownRowSchema = z
  .object({
    id: adminSubmissionIdSchema,
    profile_markdown: z.string().min(1),
  })
  .strict();

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
};

export type AdminSubmissionDetail = AdminSubmissionSummary & {
  appVersion: string;
  consentVersion: string;
  consentedAt: string;
  source: "web";
  profile: TeacherContextProfile;
  profileMarkdown: string;
};

type AdminSubmissionPage = {
  items: AdminSubmissionSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

function summaryFromRow(
  row: z.output<typeof summaryRowSchema>,
): AdminSubmissionSummary {
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
  };
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
      "id,created_at,retention_until,school_level,teacher_role,model_name,schema_version,prompt_version,profile_title:profile_json->>profileTitle,short_summary:profile_json->>shortSummary",
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
    const total = count ?? rows.length;
    return {
      items: rows.map(summaryFromRow),
      page,
      pageSize: ADMIN_SUBMISSIONS_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / ADMIN_SUBMISSIONS_PAGE_SIZE)),
    };
  } catch (error) {
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
      "id,created_at,schema_version,prompt_version,app_version,school_level,teacher_role,profile_json,profile_markdown,model_name,consent_version,consented_at,retention_until,source",
    )
    .eq("id", parsedId.data)
    .maybeSingle();

  if (error) throw databaseError(error);
  if (!data) return null;
  try {
    const row = detailRowSchema.parse(data);
    return {
      ...summaryFromRow({
        id: row.id,
        created_at: row.created_at,
        retention_until: row.retention_until,
        school_level: row.school_level,
        teacher_role: row.teacher_role,
        model_name: row.model_name,
        schema_version: row.schema_version,
        prompt_version: row.prompt_version,
        profile_title: row.profile_json.profileTitle,
        short_summary: row.profile_json.shortSummary,
      }),
      appVersion: row.app_version,
      consentVersion: row.consent_version,
      consentedAt: row.consented_at,
      source: row.source,
      profile: row.profile_json,
      profileMarkdown: row.profile_markdown,
    };
  } catch (error) {
    throw databaseError(error);
  }
}

export async function getAdminSubmissionMarkdown(
  submissionId: string,
): Promise<string | null> {
  await requireAdmin();
  const parsedId = adminSubmissionIdSchema.safeParse(submissionId);
  if (!parsedId.success) return null;

  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select("id,profile_markdown")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error) throw databaseError(error);
  if (!data) return null;
  try {
    return markdownRowSchema.parse(data).profile_markdown;
  } catch (error) {
    throw databaseError(error);
  }
}
