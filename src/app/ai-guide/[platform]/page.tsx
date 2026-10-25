import Link from "next/link";
import { notFound } from "next/navigation";
import { PLATFORM_GUIDES, findPlatformGuide } from "@/content/platform-guides";
import { PlatformGuideView } from "@/components/ai-guide/platform-guide-view";
export const dynamicParams = false;
export function generateStaticParams() {
  return PLATFORM_GUIDES.map((guide) => ({ platform: guide.id }));
}
export default async function PlatformPage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const { platform } = await params;
  const guide = findPlatformGuide(platform);
  if (!guide) notFound();
  return (
    <section className="page-container max-w-4xl space-y-7 py-10 sm:py-14">
      <Link
        href="/ai-guide"
        className="text-primary inline-flex min-h-11 items-center font-semibold underline"
      >
        모든 AI 활용 가이드
      </Link>
      <PlatformGuideView guide={guide} />
    </section>
  );
}
