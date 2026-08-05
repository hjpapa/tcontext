import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));

import { requireAdmin } from "@/lib/admin/auth";
import { ApiError } from "@/lib/security/api-error";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getAdminSubmission,
  listAdminSubmissions,
} from "@/lib/supabase/admin-submissions";
import { FICTIONAL_PROFILES } from "@/content/examples";

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "range", "eq", "maybeSingle"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return query as {
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: Promise<unknown>["then"];
  };
}

describe("admin submission reads", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  it("authenticates before touching the privileged Supabase client", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(
      new ApiError("unauthorized", 401, "unauthorized"),
    );

    await expect(listAdminSubmissions({ page: 1 })).rejects.toMatchObject({
      code: "unauthorized",
    });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("selects only list metadata and paginates newest first", async () => {
    const query = queryResult({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          created_at: "2026-08-05T00:00:00.000Z",
          retention_until: "2027-08-04T00:00:00.000Z",
          school_level: "elementary",
          teacher_role: "homeroom_teacher",
          model_name: "gpt-5.6-terra",
          schema_version: "1.0",
          prompt_version: "1.1",
          profile_title: "저장된 문서",
          short_summary: "",
        },
      ],
      error: null,
      count: 1,
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn(() => query),
    } as never);

    const result = await listAdminSubmissions({
      page: 1,
      schoolLevel: "elementary",
    });
    const selection = String(query.select.mock.calls[0]?.[0]);
    expect(selection).toContain("profile_json->>profileTitle");
    expect(selection).not.toContain("profile_markdown");
    expect(selection).not.toContain("deletion_token_hash");
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(query.range).toHaveBeenCalledWith(0, 19);
    expect(query.eq).toHaveBeenCalledWith("school_level", "elementary");
    expect(result.items[0]?.profileTitle).toBe("저장된 문서");
    expect(result.items[0]?.shortSummary).toBe("");
  });

  it("rejects invalid ids without querying Supabase", async () => {
    const result = await getAdminSubmission("not-a-uuid");
    expect(result).toBeNull();
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("parses the canonical profile and never selects the deletion hash", async () => {
    const profile = FICTIONAL_PROFILES[0];
    if (!profile) throw new Error("profile fixture missing");
    const query = queryResult({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        created_at: "2026-08-05T00:00:00.000Z",
        schema_version: profile.metadata.schemaVersion,
        prompt_version: profile.metadata.promptVersion,
        app_version: "0.1.0",
        school_level: profile.metadata.schoolLevel,
        teacher_role: profile.metadata.role,
        profile_json: profile,
        profile_markdown: "# 저장된 Markdown",
        model_name: profile.metadata.modelName,
        consent_version: "1.0",
        consented_at: "2026-08-05T00:00:00.000Z",
        retention_until: "2027-08-04T00:00:00.000Z",
        source: "web",
      },
      error: null,
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn(() => query),
    } as never);

    const result = await getAdminSubmission(
      "11111111-1111-4111-8111-111111111111",
    );
    const selection = String(query.select.mock.calls[0]?.[0]);
    expect(selection).toContain("profile_json");
    expect(selection).toContain("profile_markdown");
    expect(selection).not.toContain("deletion_token_hash");
    expect(result?.profile.profileTitle).toBe(profile.profileTitle);
  });
});
