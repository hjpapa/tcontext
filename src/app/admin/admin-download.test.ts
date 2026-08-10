import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin-submissions", () => ({
  getAdminSubmissionMarkdown: vi.fn(),
}));

import { GET } from "@/app/admin/(protected)/submissions/[id]/download/route";
import { ApiError } from "@/lib/security/api-error";
import { getAdminSubmissionMarkdown } from "@/lib/supabase/admin-submissions";

const id = "11111111-1111-4111-8111-111111111111";

describe("admin Markdown download", () => {
  beforeEach(() => vi.clearAllMocks());

  it("downloads exact stored Markdown with private response headers", async () => {
    vi.mocked(getAdminSubmissionMarkdown).mockResolvedValue({
      documentAccess: "full",
      markdown: "# 저장 문서\n",
    });
    const response = await GET(new Request(`http://localhost/admin/${id}`), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# 저장 문서\n");
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toContain(id);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("blocks a direct download for a summary-only document", async () => {
    vi.mocked(getAdminSubmissionMarkdown).mockResolvedValue({
      documentAccess: "summary",
    });
    const response = await GET(new Request(`http://localhost/admin/${id}`), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("최종 확인과 저장 동의");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns 404 for an unknown document", async () => {
    vi.mocked(getAdminSubmissionMarkdown).mockResolvedValue(null);
    const response = await GET(new Request(`http://localhost/admin/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(404);
  });

  it("does not turn an unauthenticated read into a download", async () => {
    vi.mocked(getAdminSubmissionMarkdown).mockRejectedValue(
      new ApiError("unauthorized", 401, "관리자 로그인이 필요합니다."),
    );
    const response = await GET(new Request(`http://localhost/admin/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
