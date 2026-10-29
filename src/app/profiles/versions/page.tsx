import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileVersions } from "@/components/local-profiles/profile-versions";

export const metadata: Metadata = {
  title: "버전 기록",
  robots: { index: false, follow: false },
};

export default function ProfileVersionsPage() {
  return (
    <section className="mx-auto max-w-5xl min-w-0 space-y-6 px-5 py-12 sm:px-8">
      <h1 className="text-3xl font-bold">버전 기록</h1>
      <Suspense fallback={<p role="status">버전 기록을 불러오는 중…</p>}>
        <ProfileVersions />
      </Suspense>
    </section>
  );
}
