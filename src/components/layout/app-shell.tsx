import Link from "next/link";
import { BookOpenText, FileText, ShieldCheck } from "lucide-react";

import { PrimaryNav } from "@/components/layout/primary-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-canvas flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link">
        본문으로 바로가기
      </a>
      <header
        data-print-hidden="true"
        className="bg-background/88 supports-[backdrop-filter]:bg-background/78 sticky top-0 z-50 border-b backdrop-blur-xl"
      >
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link
            href="/"
            className="group inline-flex min-h-11 items-center gap-3 rounded-xl"
          >
            <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:-rotate-2">
              <BookOpenText aria-hidden="true" className="size-5" />
            </span>
            <span className="leading-none">
              <span className="block text-lg font-semibold tracking-[-0.025em]">
                TContext
              </span>
              <span className="text-muted-foreground mt-1 hidden text-[10px] font-semibold tracking-[0.12em] uppercase sm:block">
                Teacher context document
              </span>
            </span>
          </Link>
          <PrimaryNav />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="relative flex-1">
        {children}
      </main>
      <footer
        data-print-hidden="true"
        className="bg-card/72 border-t backdrop-blur-sm"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1.4fr_0.6fr] md:items-end">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 font-semibold">
              <FileText aria-hidden="true" className="text-primary size-5" />
              TContext
            </div>
            <p className="text-muted-foreground mt-3 text-sm leading-6">
              교사의 실제 수업 맥락을 AI가 이해할 수 있는 문서로 정리합니다.
              로그인 없이 사용할 수 있으며 원문 인터뷰 답변은 저장하지 않습니다.
            </p>
            <p className="text-primary mt-4 flex items-center gap-2 text-xs font-semibold">
              <ShieldCheck aria-hidden="true" className="size-4" />
              교사가 모든 문장을 검토하고 수정한 뒤 완성합니다.
            </p>
          </div>
          <div className="space-y-4 md:text-right">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide">
              만든 사람{" "}
              <span className="text-foreground">jjpapa(docsusil)</span>
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold md:justify-end">
              <Link
                className="hover:text-primary underline-offset-4 hover:underline"
                href="/examples"
              >
                문서 예시
              </Link>
              <Link
                className="hover:text-primary underline-offset-4 hover:underline"
                href="/privacy"
              >
                개인정보 처리 안내
              </Link>
              <Link
                className="hover:text-primary underline-offset-4 hover:underline"
                href="/delete"
              >
                기여 데이터 삭제
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
