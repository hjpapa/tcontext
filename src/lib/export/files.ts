// Text remains the default for existing JSON/Markdown producers.
export type ExportFile<Content extends string | Uint8Array = string> = {
  path: string;
  mediaType:
    "text/markdown" | "application/json" | "text/plain" | "application/zip";
  content: Content;
};
