import { ApiError, handleRouteError } from "@/lib/security/api-error";
import { getAdminSubmissionMarkdown } from "@/lib/supabase/admin-submissions";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const markdown = await getAdminSubmissionMarkdown(id);
    if (markdown === null) {
      return new Response("문서를 찾을 수 없습니다.", {
        status: 404,
        headers: privateHeaders,
      });
    }
    if (markdown.documentAccess === "summary") {
      return new Response(
        "최종 확인과 저장 동의가 완료된 문서만 다운로드할 수 있습니다.",
        {
          status: 403,
          headers: privateHeaders,
        },
      );
    }
    return new Response(markdown.markdown, {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="tcontext-${id}.md"`,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) return handleRouteError(error);
    return handleRouteError(
      new ApiError("internal_error", 500, "문서를 다운로드하지 못했습니다."),
    );
  }
}
