import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      id="main-content"
      className="mx-auto min-h-screen max-w-5xl px-5 py-12 sm:px-8"
      aria-busy="true"
      aria-label="페이지 불러오는 중"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-8 h-12 w-3/4 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <Skeleton className="mt-12 h-72 w-full rounded-2xl" />
    </main>
  );
}
