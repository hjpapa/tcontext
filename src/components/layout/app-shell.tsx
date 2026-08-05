import Link from "next/link";
import { BookOpenText, ShieldCheck } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#fbfaf5] text-[#18251e]">
      <a
        href="#main-content"
        className="fixed top-4 left-4 z-[100] -translate-y-24 rounded-md bg-[#153f2e] px-4 py-3 font-semibold text-white shadow-lg transition focus:translate-y-0"
      >
        본문으로 바로가기
      </a>
      <header className="border-b border-[#dce2dc] bg-[#fbfaf5]/95">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-md text-lg font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[#28684c] focus-visible:ring-offset-2"
          >
            <BookOpenText
              aria-hidden="true"
              className="size-6 text-[#28684c]"
            />
            TContext
          </Link>
          <nav aria-label="주요 메뉴" className="flex items-center gap-1">
            <Link
              href="/examples"
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-[#eef1eb] focus-visible:ring-2 focus-visible:ring-[#28684c] focus-visible:outline-none"
            >
              예시
            </Link>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-[#eef1eb] focus-visible:ring-2 focus-visible:ring-[#28684c] focus-visible:outline-none"
            >
              개인정보 안내
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="mt-20 border-t border-[#dce2dc]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[#536159] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5" />
            공개 문서 생성은 로그인 없이 사용하며, 원문 답변은 저장하지
            않습니다.
          </p>
          <div className="flex gap-4">
            <Link className="underline underline-offset-4" href="/privacy">
              개인정보 처리 안내
            </Link>
            <Link className="underline underline-offset-4" href="/delete">
              기여 데이터 삭제
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
