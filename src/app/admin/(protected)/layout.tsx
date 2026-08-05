import Link from "next/link";
import { redirect } from "next/navigation";
import { Database, LogOut } from "lucide-react";

import { logoutAdmin } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { isAdminAuthenticated } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  return (
    <div>
      <div className="border-b border-[#dce2dc] bg-[#f4f7f2]">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center gap-2 rounded-md font-bold text-[#18452f]"
          >
            <Database aria-hidden="true" className="size-5" />
            저장 문서 관리자
          </Link>
          <form action={logoutAdmin}>
            <Button type="submit" variant="ghost" className="min-h-10">
              <LogOut aria-hidden="true" />
              로그아웃
            </Button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
