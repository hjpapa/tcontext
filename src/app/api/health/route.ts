import { NextResponse } from "next/server";

import { isSharedRateLimitConfigured } from "@/lib/security/rate-limit";

export async function GET() {
  const openAIConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const supabaseConfigured = Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim(),
  );

  return NextResponse.json(
    {
      status: openAIConfigured ? "ok" : "degraded",
      services: {
        ai: openAIConfigured ? "configured" : "unconfigured",
        optionalContributionStorage: supabaseConfigured
          ? "configured"
          : "unconfigured",
        sharedRateLimit: isSharedRateLimitConfigured()
          ? "configured"
          : "per-instance",
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: openAIConfigured ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
