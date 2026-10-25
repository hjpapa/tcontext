import Link from "next/link";
import type { Metadata } from "next";
import { PLATFORM_GUIDES } from "@/content/platform-guides";
import { GuideNotices } from "@/components/ai-guide/platform-guide-view";
export const metadata: Metadata = { title: "AI에서 활용하기" };
export default function AiGuidePage() {
  return (
    <section className="page-container max-w-5xl space-y-7 py-10 sm:py-14">
      <header>
        <p className="eyebrow">교사 컨텍스트 활용 안내</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">AI에서 활용하기</h1>
        <p className="text-muted-foreground mt-3 leading-7">
          사용하는 서비스를 골라 문서와 지침을 등록하는 방법을 확인하세요.
        </p>
      </header>
      <GuideNotices />
      <div className="grid gap-4 md:grid-cols-3">
        {PLATFORM_GUIDES.map((guide) => (
          <Link
            key={guide.id}
            href={`/ai-guide/${guide.id}`}
            className="feature-card hover:border-primary min-w-0 space-y-3"
          >
            <h2 className="text-2xl font-bold">{guide.name}</h2>
            <p className="text-muted-foreground leading-7">{guide.summary}</p>
            <span className="text-primary inline-block font-semibold">
              활용 가이드 보기
            </span>
          </Link>
        ))}
      </div>
      <Link
        href="/profiles"
        className="text-primary inline-flex min-h-11 items-center font-semibold underline"
      >
        내 프로파일 열기
      </Link>
    </section>
  );
}
