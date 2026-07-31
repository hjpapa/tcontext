"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("TContext 화면 오류", {
      digest: error.digest,
      name: error.name,
    });
  }, [error]);

  return (
    <section className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-2xl">
        <AlertTriangle aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        화면을 불러오지 못했습니다
      </h1>
      <p className="text-muted-foreground mt-4 leading-7">
        입력 내용은 가능한 한 현재 브라우저에 남아 있습니다. 다시 시도해도
        해결되지 않으면 홈으로 돌아가 새 인터뷰를 시작해 주세요.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw aria-hidden="true" />
          다시 시도
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            홈으로
          </Link>
        </Button>
      </div>
    </section>
  );
}
