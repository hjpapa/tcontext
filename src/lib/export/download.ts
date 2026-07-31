import type { SchoolLevel } from "@/types/profile";

export function profileMarkdownFilename(
  schoolLevel: SchoolLevel,
  date: Date = new Date(),
): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("유효한 날짜가 필요합니다.");
  }
  const yyyy = date.getUTCFullYear().toString().padStart(4, "0");
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = date.getUTCDate().toString().padStart(2, "0");
  return `tcontext-teacher-profile-${schoolLevel}-${yyyy}${mm}${dd}.md`;
}

export function sanitizeDownloadFilename(filename: string): string {
  const safe = filename
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "-")
    .replace(/\.+$/gu, "")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .slice(0, 120);
  return safe.length > 0 ? safe : "tcontext-teacher-profile.md";
}

/**
 * Creates and downloads a UTF-8 Markdown Blob entirely in the browser.
 * Nothing is sent to or stored on a server.
 */
export function downloadMarkdown(
  markdown: string,
  filename: string,
  documentRef: Document = document,
  urlRef: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL,
): void {
  const blob = new Blob(["\uFEFF", markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const objectUrl = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = objectUrl;
  anchor.download = sanitizeDownloadFilename(filename);
  anchor.rel = "noopener";
  anchor.style.display = "none";
  documentRef.body.append(anchor);
  anchor.click();
  anchor.remove();
  urlRef.revokeObjectURL(objectUrl);
}

export const createProfileFilename = profileMarkdownFilename;
