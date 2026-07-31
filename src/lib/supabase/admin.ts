import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/security/api-error";

let adminClient: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey) {
    throw new ApiError(
      "configuration_error",
      503,
      "선택적 데이터 기여 저장소 설정이 완료되지 않았습니다.",
    );
  }

  adminClient ??= createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
}

export function resetSupabaseAdminForTests() {
  adminClient = undefined;
}
