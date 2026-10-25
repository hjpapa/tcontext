import type { ExportFile } from "./files";
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
  const result = downloadTextFile(
    { path: filename, mediaType: "text/markdown", content: markdown },
    { bom: true, documentRef, urlRef },
  );
  if (!result.ok) throw new Error("파일을 다운로드하지 못했습니다.");
}

export function downloadTextFile(
  file: ExportFile,
  options: {
    bom?: boolean;
    documentRef?: Document;
    urlRef?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  } = {},
): { ok: true } | { ok: false; error: "download_failed" } {
  let objectUrl: string | undefined;
  let anchor: HTMLAnchorElement | undefined;
  const urlRef = options.urlRef ?? URL;
  try {
    const documentRef = options.documentRef ?? document;
    const blob = new Blob([options.bom ? "\uFEFF" : "", file.content], {
      type: `${file.mediaType};charset=utf-8`,
    });
    objectUrl = urlRef.createObjectURL(blob);
    anchor = documentRef.createElement("a");
    anchor.href = objectUrl;
    anchor.download = sanitizeDownloadFilename(file.path);
    anchor.rel = "noopener";
    anchor.style.display = "none";
    documentRef.body.append(anchor);
    anchor.click();
    return { ok: true };
  } catch {
    return { ok: false, error: "download_failed" };
  } finally {
    anchor?.remove();
    if (objectUrl !== undefined) urlRef.revokeObjectURL(objectUrl);
  }
}

export function profileBackupFilename(
  schoolLevel: SchoolLevel,
  date: Date = new Date(),
): string {
  return profileMarkdownFilename(schoolLevel, date).replace(/\.md$/u, ".json");
}

export const createProfileFilename = profileMarkdownFilename;
