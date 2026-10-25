"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useLocalProfiles } from "./local-profiles-provider";
export function SavedProfilesEntry() {
  const { availability, items, refresh } = useLocalProfiles();
  useEffect(() => {
    if (availability === "enabled") void refresh();
  }, [availability, refresh]);
  if (availability !== "enabled") return null;
  return (
    <Link
      href="/profiles"
      className="mt-4 inline-flex min-h-11 items-center font-semibold underline"
    >
      저장한 프로파일 {items.length}개 · 열기
    </Link>
  );
}
