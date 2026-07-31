import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      <span className="bg-secondary text-primary flex size-12 items-center justify-center rounded-2xl">
        <FileQuestion aria-hidden="true" />
      </span>
      <p className="text-primary mt-6 font-mono text-sm">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        찾을 수 없는 페이지입니다
      </h1>
      <p className="text-muted-foreground mt-4 leading-7">
        주소를 다시 확인하거나 홈에서 교사 컨텍스트 인터뷰를 시작해 주세요.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">
          <ArrowLeft aria-hidden="true" />
          홈으로 돌아가기
        </Link>
      </Button>
    </section>
  );
}
