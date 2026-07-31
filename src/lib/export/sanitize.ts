export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Keeps ordinary Korean Markdown readable while neutralizing raw HTML,
 * javascript/data URLs, control characters, and heading injection.
 */
export function sanitizeMarkdownText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/\bjavascript\s*:/giu, "javascript&#58;")
    .replace(/\bdata\s*:\s*text\/html/giu, "data&#58;text/plain")
    .replace(/\r\n?/gu, "\n")
    .trim();
}

export function yamlQuoted(value: string): string {
  return JSON.stringify(value.replace(/[\u0000-\u001F\u007F]/gu, " ").trim());
}
