// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { ResultActions } from "./result-actions";
import { downloadMarkdown, downloadTextFile } from "@/lib/export/download";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("downloads JSON without opening a database and reports download failure", () => {
  const open = vi.fn();
  vi.stubGlobal("indexedDB", { open });
  const createObjectURL = vi.fn(() => "blob:backup");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  render(
    <ResultActions profile={FICTIONAL_PROFILES[0]!} markdown="# Markdown" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "JSON 백업 다운로드" }));
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(click).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent(
    "JSON 백업을 내려받았습니다.",
  );
  createObjectURL.mockImplementation(() => {
    throw new Error("blocked");
  });
  fireEvent.click(screen.getByRole("button", { name: "JSON 백업 다운로드" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "다운로드하지 못했습니다",
  );
  expect(open).not.toHaveBeenCalled();
});
it("keeps Markdown BOM and sanitization while JSON has no BOM", async () => {
  const blobs: Blob[] = [];
  const names: string[] = [];
  const urls = {
    createObjectURL: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:download";
    }),
    revokeObjectURL: vi.fn(),
  };
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  downloadMarkdown("# body", "bad/name.md", document, urls);
  expect(
    downloadTextFile(
      { path: "profile.json", mediaType: "application/json", content: "{}" },
      { bom: false, documentRef: document, urlRef: urls },
    ),
  ).toEqual({ ok: true });
  const bytes = (blob: Blob) =>
    new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob);
    });
  expect(
    Array.from(new Uint8Array(await bytes(blobs[0]!))).slice(0, 3),
  ).toEqual([239, 187, 191]);
  expect(Array.from(new Uint8Array(await bytes(blobs[1]!)))).toEqual([
    123, 125,
  ]);
  expect(names).toEqual(["bad-name.md", "profile.json"]);
  expect(urls.revokeObjectURL).toHaveBeenCalledTimes(2);
});
