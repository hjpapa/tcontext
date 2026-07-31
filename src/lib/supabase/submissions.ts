import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/security/api-error";
import type {
  ConfirmedTags,
  PrivacyReview,
  SchoolLevel,
  TeacherContextProfile,
} from "@/types/profile";

const TABLE = "teacher_context_submissions";

export type SubmissionInsert = {
  schema_version: string;
  prompt_version: string;
  app_version: string;
  school_level: SchoolLevel;
  teacher_role: string;
  profile_json: TeacherContextProfile;
  profile_markdown: string;
  confirmed_tags: ConfirmedTags;
  privacy_review: PrivacyReview;
  model_name: string;
  consent_version: string;
  consented_at: string;
  retention_until: string;
  deletion_token_hash: string;
  source: "web";
};

export type SubmissionReceipt = {
  id: string;
  createdAt: string;
  retentionUntil: string;
};

function databaseError(cause: unknown): ApiError {
  return new ApiError(
    "database_unavailable",
    503,
    "데이터 저장소를 일시적으로 사용할 수 없습니다.",
    { cause },
  );
}

export async function insertSubmission(
  payload: SubmissionInsert,
): Promise<SubmissionReceipt> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .insert(payload)
    .select("id,created_at,retention_until")
    .single();

  if (error || !data) throw databaseError(error);

  return {
    id: String(data.id),
    createdAt: String(data.created_at),
    retentionUntil: String(data.retention_until),
  };
}

export async function getDeletionTokenHash(
  submissionId: string,
): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select("deletion_token_hash")
    .eq("id", submissionId)
    .maybeSingle();

  if (error) throw databaseError(error);
  return data ? String(data.deletion_token_hash) : null;
}

export async function deleteSubmission(
  submissionId: string,
  deletionTokenHash: string,
): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .delete()
    .eq("id", submissionId)
    .eq("deletion_token_hash", deletionTokenHash)
    .select("id")
    .maybeSingle();

  if (error) throw databaseError(error);
  return data !== null;
}

export async function purgeExpiredSubmissions(
  now = new Date(),
): Promise<number> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .delete()
    .lt("retention_until", now.toISOString())
    .select("id");

  if (error) throw databaseError(error);
  return data?.length ?? 0;
}
