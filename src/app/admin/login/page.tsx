import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

import { loginAdmin } from "@/app/admin/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAdminAuthConfigured, isAdminAuthenticated } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "관리자 비밀번호가 올바르지 않습니다.",
  "rate-limited": "로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.",
  configuration: "관리자 로그인이 아직 설정되지 않았습니다.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const configured = isAdminAuthConfigured();
  if (configured && (await isAdminAuthenticated())) redirect("/admin");
  const rawError = (await searchParams).error;
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : undefined;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-20">
      <header className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#e4efe7] text-[#18452f]">
          <KeyRound aria-hidden="true" className="size-6" />
        </div>
        <p className="mt-5 text-sm font-bold text-[#28684c]">운영자 전용</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          저장 문서 관리자
        </h1>
        <p className="mt-3 leading-7 text-[#536159]">
          명시적 동의를 받아 저장된 최종 TContext 문서만 열람할 수 있습니다.
        </p>
      </header>

      {!configured ? (
        <Alert className="mt-8 border-[#d7bd8b] bg-[#fff8e8]">
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>관리자 자격증명 설정 필요</AlertTitle>
          <AlertDescription>
            저장소 루트에서 <code>pnpm admin:setup</code>을 실행한 뒤 개발
            서버를 다시 시작해 주세요.
          </AlertDescription>
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>로그인할 수 없습니다.</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <form action={loginAdmin} className="mt-8 space-y-5">
        <div className="space-y-2">
          <label htmlFor="admin-password" className="text-sm font-bold">
            관리자 비밀번호
          </label>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            disabled={!configured}
            className="min-h-12"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={!configured}
          className="min-h-12 w-full bg-[#153f2e] text-base text-white"
        >
          관리자 로그인
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-[#536159]">
        <Link href="/" className="underline underline-offset-4">
          공개 서비스로 돌아가기
        </Link>
      </p>
    </div>
  );
}
