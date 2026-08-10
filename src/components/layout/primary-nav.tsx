"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";

const WORKFLOW_PATHS = ["/interview", "/review", "/result", "/admin"];

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrimaryNav() {
  const pathname = usePathname();
  const inWorkflow = WORKFLOW_PATHS.some((path) =>
    isCurrentPath(pathname, path),
  );
  const examplesCurrent = isCurrentPath(pathname, "/examples");
  const privacyCurrent = isCurrentPath(pathname, "/privacy");

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
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-sm transition-colors sm:px-4"
        >
          <span className="sm:hidden">시작</span>
          <span className="hidden sm:inline">인터뷰 시작</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
