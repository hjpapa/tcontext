"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, FolderOpen } from "lucide-react";
import { useInterviewSession } from "./interview-session-provider";

const WORKFLOW_PATHS = ["/interview", "/review", "/result", "/admin"];
const DOCUMENT_HIDDEN_PATHS = ["/interview", "/review", "/admin"];

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrimaryNav() {
  const pathname = usePathname();
  const { profile, markdown } = useInterviewSession();
  const inWorkflow = WORKFLOW_PATHS.some((path) =>
    isCurrentPath(pathname, path),
  );
  const examplesCurrent = isCurrentPath(pathname, "/examples");
  const privacyCurrent = isCurrentPath(pathname, "/privacy");
  const showCurrentDocument =
    profile !== null &&
    !DOCUMENT_HIDDEN_PATHS.some((path) => isCurrentPath(pathname, path));
  const documentHref = markdown.length > 0 ? "/result" : "/review";
  const documentCurrent =
    documentHref === "/result" && isCurrentPath(pathname, "/result");

  return (
    <nav aria-label="주요 메뉴" className="flex items-center gap-1 sm:gap-2">
      <Link
        href="/examples"
        aria-label="문서 예시"
        aria-current={examplesCurrent ? "page" : undefined}
        className={`inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold transition-colors sm:px-4 ${
          examplesCurrent ? "bg-secondary text-primary" : "hover:bg-secondary"
        }`}
      >
        <span className="sm:hidden">예시</span>
        <span className="hidden sm:inline">문서 예시</span>
      </Link>
      <Link
        href="/profiles"
        aria-label="내 프로파일"
        aria-current={isCurrentPath(pathname, "/profiles") ? "page" : undefined}
        className="hover:bg-secondary inline-flex min-h-10 items-center rounded-full px-2 text-sm font-semibold sm:px-3"
      >
        <FolderOpen aria-hidden="true" className="size-4 sm:hidden" />
        <span className="hidden sm:inline">내 프로파일</span>
      </Link>
      {showCurrentDocument ? (
        <Link
          href={documentHref}
          aria-label="현재 문서"
          aria-current={documentCurrent ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold transition-colors sm:px-4 ${
            documentCurrent ? "bg-secondary text-primary" : "hover:bg-secondary"
          }`}
        >
          <span className="sm:hidden">문서</span>
          <span className="hidden sm:inline">현재 문서</span>
        </Link>
      ) : null}
      <Link
        href="/privacy"
        aria-current={privacyCurrent ? "page" : undefined}
        className={`hidden min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors md:inline-flex ${
          privacyCurrent ? "bg-secondary text-primary" : "hover:bg-secondary"
        }`}
      >
        개인정보 안내
      </Link>
      {!inWorkflow ? (
        <Link
          href="/interview"
          className={`bg-primary text-primary-foreground hover:bg-primary/90 min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm transition-colors sm:px-4 ${
            showCurrentDocument ? "hidden sm:inline-flex" : "inline-flex"
          }`}
        >
          <span className="sm:hidden">시작</span>
          <span className="hidden sm:inline">인터뷰 시작</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
