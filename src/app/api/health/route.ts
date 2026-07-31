import { NextResponse } from "next/server";

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
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: openAIConfigured ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
