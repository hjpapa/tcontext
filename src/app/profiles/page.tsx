import type { Metadata } from "next";
import { ProfileLibrary } from "@/components/local-profiles/profile-library";
export const metadata: Metadata = {
  title: "내 프로파일",
  robots: { index: false, follow: false },
};
export default function ProfilesPage() {
  return (
    <section className="mx-auto max-w-5xl space-y-6 px-5 py-12 sm:px-8">
      <h1 className="text-3xl font-bold">내 프로파일</h1>
      <p>
        이 브라우저에 보관한 문서를 열고 수정하거나 JSON 백업으로 옮길 수
        있습니다.
      </p>
      <ProfileLibrary />
    </section>
  );
}
