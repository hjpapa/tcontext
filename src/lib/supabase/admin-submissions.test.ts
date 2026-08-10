import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn() }));

import { requireAdmin } from "@/lib/admin/auth";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import { ApiError } from "@/lib/security/api-error";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  getAdminSubmission,
  getAdminSubmissionMarkdown,
  listAdminSubmissions,
} from "@/lib/supabase/admin-submissions";
import { FICTIONAL_PROFILES } from "@/content/examples";

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of [
    "select",
    "order",
    "range",
    "eq",
    "in",
    "contains",
    "maybeSingle",
  ]) {
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
    in: ReturnType<typeof vi.fn>;
    contains: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: Promise<unknown>["then"];
  };
}

function useQueries(...queries: ReturnType<typeof queryResult>[]) {
  const from = vi.fn();
  for (const query of queries) from.mockReturnValueOnce(query);
  vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as never);
  return from;
}

const FULL_ID = "11111111-1111-4111-8111-111111111111";
const SUMMARY_ID = "22222222-2222-4222-8222-222222222222";
const STORED_AT = "2026-08-05T00:00:00+00:00";
const RETENTION_UNTIL = "2027-08-04T00:00:00+00:00";

function detailRow(overrides: Record<string, unknown> = {}) {
  const profile = structuredClone(FICTIONAL_PROFILES[0]);
  if (!profile) throw new Error("profile fixture missing");
  return {
    id: FULL_ID,
    created_at: STORED_AT,
    schema_version: profile.metadata.schemaVersion,
    prompt_version: profile.metadata.promptVersion,
    app_version: "0.1.0",
    school_level: profile.metadata.schoolLevel,
    teacher_role: profile.metadata.role,
    profile_title: profile.profileTitle,
    short_summary: profile.shortSummary,
    profile_json: profile,
    profile_markdown: profileToMarkdown(profile),
    model_name: profile.metadata.modelName,
    consent_version: "1.0",
    consented_at: STORED_AT,
    retention_until: RETENTION_UNTIL,
    source: "web",
    ...overrides,
  };
}

describe("admin submission reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(undefined);
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

  it("lists metadata only and labels rows with unconfirmed claims as summary-only", async () => {
    const listQuery = queryResult({
      data: [
        {
          id: FULL_ID,
          created_at: STORED_AT,
          retention_until: RETENTION_UNTIL,
          school_level: "elementary",
          teacher_role: "homeroom_teacher",
          model_name: "gpt-5.6-terra",
          schema_version: "1.0",
          prompt_version: "1.4",
          profile_title: "완료 문서",
          short_summary: "완료된 문서의 요약",
          privacy_status: "clear",
          consent_version: "1.0",
          consented_at: STORED_AT,
        },
        {
          id: SUMMARY_ID,
          created_at: STORED_AT,
          retention_until: RETENTION_UNTIL,
          school_level: "elementary",
          teacher_role: "homeroom_teacher",
          model_name: "gpt-5.6-terra",
          schema_version: "1.0",
          prompt_version: "1.4",
          profile_title: "미확인 문서",
          short_summary: "미확인 문서의 요약",
          privacy_status: "clear",
          consent_version: "1.0",
          consented_at: STORED_AT,
        },
      ],
      error: null,
      count: 2,
    });
    const policyQuery = queryResult({
      data: [{ id: SUMMARY_ID }],
      error: null,
    });
    useQueries(listQuery, policyQuery);

    const result = await listAdminSubmissions({
      page: 1,
      schoolLevel: "elementary",
    });
    const listSelection = String(listQuery.select.mock.calls[0]?.[0]);
    const policySelection = String(policyQuery.select.mock.calls[0]?.[0]);

    expect(listSelection).toContain("profile_json->>profileTitle");
    expect(listSelection).toContain("profile_json->privacyReview->>status");
    expect(listSelection).not.toMatch(/(?:^|,)profile_json(?:,|$)/u);
    expect(listSelection).not.toContain("profile_markdown");
    expect(listSelection).not.toContain("deletion_token_hash");
    expect(policySelection).toBe("id");
    expect(policyQuery.in).toHaveBeenCalledWith("id", [FULL_ID, SUMMARY_ID]);
    expect(policyQuery.contains).toHaveBeenCalledWith("profile_json", {
      modules: [{ claims: [{ confirmedByUser: false }] }],
    });
    expect(listQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(listQuery.range).toHaveBeenCalledWith(0, 19);
    expect(listQuery.eq).toHaveBeenCalledWith("school_level", "elementary");
    expect(result.items.map((item) => item.documentAccess)).toEqual([
      "full",
      "summary",
    ]);
  });

  it("does not run the claim policy query for an empty page", async () => {
    const listQuery = queryResult({ data: [], error: null, count: 0 });
    const from = useQueries(listQuery);

    const result = await listAdminSubmissions({ page: 1 });

    expect(result.items).toEqual([]);
    expect(from).toHaveBeenCalledOnce();
  });

  it("rejects invalid ids without querying Supabase", async () => {
    const result = await getAdminSubmission("not-a-uuid");
    expect(result).toBeNull();
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns the full canonical profile only after every access check passes", async () => {
    const query = queryResult({ data: detailRow(), error: null });
    useQueries(query);

    const result = await getAdminSubmission(FULL_ID);
    const selection = String(query.select.mock.calls[0]?.[0]);

    expect(selection).toContain("profile_json");
    expect(selection).toContain("profile_markdown");
    expect(selection).not.toContain("deletion_token_hash");
    expect(result).toMatchObject({
      documentAccess: "full",
      consentVersion: "1.0",
      profileMarkdown: profileToMarkdown(FICTIONAL_PROFILES[0]!),
    });
    if (result?.documentAccess === "full") {
      expect(result.profile.profileTitle).toBe(
        FICTIONAL_PROFILES[0]?.profileTitle,
      );
    }
  });

  it("returns no profile or Markdown when consent metadata is missing", async () => {
    const query = queryResult({
      data: detailRow({ consent_version: null, consented_at: null }),
      error: null,
    });
    useQueries(query);

    const result = await getAdminSubmission(FULL_ID);

    expect(result).toMatchObject({
      documentAccess: "summary",
      accessReason: "consent_missing",
    });
    expect(result).not.toHaveProperty("profile");
    expect(result).not.toHaveProperty("profileMarkdown");
  });

  it("downgrades a document containing an unconfirmed claim to summary-only", async () => {
    const profile = structuredClone(FICTIONAL_PROFILES[0]);
    const claim = profile?.modules[0]?.claims[0];
    if (!profile || !claim) throw new Error("profile fixture claim missing");
    claim.confirmedByUser = false;
    const query = queryResult({
      data: detailRow({ profile_json: profile }),
      error: null,
    });
    useQueries(query);

    const result = await getAdminSubmission(FULL_ID);

    expect(result).toMatchObject({
      documentAccess: "summary",
      accessReason: "claims_unconfirmed",
    });
    expect(result).not.toHaveProperty("profile");
  });

  it("downgrades a document whose privacy review is not clear", async () => {
    const profile = structuredClone(FICTIONAL_PROFILES[0]);
    if (!profile) throw new Error("profile fixture missing");
    profile.privacyReview = {
      status: "needs_review",
      items: [
        {
          text: "검토 대상",
          reason: "개인 식별 가능성이 있습니다.",
          suggestedRewrite: "집단 수준의 표현으로 바꿉니다.",
        },
      ],
    };
    const query = queryResult({
      data: detailRow({ profile_json: profile }),
      error: null,
    });
    useQueries(query);

    const result = await getAdminSubmission(FULL_ID);

    expect(result).toMatchObject({
      documentAccess: "summary",
      accessReason: "privacy_not_clear",
    });
    expect(result).not.toHaveProperty("profile");
  });

  it("blocks a direct Markdown request when the full document is ineligible", async () => {
    const profile = structuredClone(FICTIONAL_PROFILES[0]);
    const claim = profile?.modules[0]?.claims[0];
    if (!profile || !claim) throw new Error("profile fixture claim missing");
    claim.confirmedByUser = false;
    const query = queryResult({
      data: {
        id: FULL_ID,
        profile_json: profile,
        profile_markdown: "# 숨겨야 할 Markdown",
        consent_version: "1.0",
        consented_at: STORED_AT,
      },
      error: null,
    });
    useQueries(query);

    const result = await getAdminSubmissionMarkdown(FULL_ID);

    expect(result).toEqual({ documentAccess: "summary" });
  });

  it("returns the exact stored Markdown after the download policy passes", async () => {
    const profile = structuredClone(FICTIONAL_PROFILES[0]);
    if (!profile) throw new Error("profile fixture missing");
    const markdown = profileToMarkdown(profile);
    const query = queryResult({
      data: {
        id: FULL_ID,
        profile_json: profile,
        profile_markdown: markdown,
        consent_version: "1.0",
        consented_at: STORED_AT,
      },
      error: null,
    });
    useQueries(query);

    const result = await getAdminSubmissionMarkdown(FULL_ID);

    expect(result).toEqual({
      documentAccess: "full",
      markdown,
    });
  });

  it("blocks Markdown that no longer matches the canonical profile", async () => {
    const profile = structuredClone(FICTIONAL_PROFILES[0]);
    if (!profile) throw new Error("profile fixture missing");
    const query = queryResult({
      data: {
        id: FULL_ID,
        profile_json: profile,
        profile_markdown: "# 변조되거나 오래된 Markdown\n",
        consent_version: "1.0",
        consented_at: STORED_AT,
      },
      error: null,
    });
    useQueries(query);

    const result = await getAdminSubmissionMarkdown(FULL_ID);

    expect(result).toEqual({ documentAccess: "summary" });
  });
});
