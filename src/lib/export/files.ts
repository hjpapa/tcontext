export type ExportFile = {
  path: string;
  mediaType: "text/markdown" | "application/json" | "text/plain";
  content: string;
};
