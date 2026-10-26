import { expect, it, vi } from "vitest";
import { downloadTextFile } from "./download";
it("downloads exactly the binary slice without a BOM even when requested", async () => {
  const bytes = new Uint8Array([99, 80, 75, 3, 4, 99]).subarray(1, 5);
  const createObjectURL = vi
    .fn<(blob: Blob) => string>()
    .mockReturnValue("blob:zip");
  const revokeObjectURL = vi.fn();
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  try {
    expect(
      downloadTextFile(
        {
          path: "teacher-context.zip",
          mediaType: "application/zip",
          content: bytes,
        },
        {
          bom: true,
          documentRef: document,
          urlRef: { createObjectURL, revokeObjectURL },
        },
      ),
    ).toEqual({ ok: true });
    const blob = createObjectURL.mock.calls[0]![0];
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    expect(new Uint8Array(buffer)).toEqual(new Uint8Array([80, 75, 3, 4]));
    expect(blob.type).toBe("application/zip");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:zip");
    expect(
      document.querySelector('a[download="teacher-context.zip"]'),
    ).toBeNull();
  } finally {
    click.mockRestore();
  }
});
