// @vitest-environment node
import { expect, it } from "vitest";
import { createStoredZip } from "./zip";
import { readStoredZip } from "./zip.test-helper";
const date = new Date("2026-10-25T12:34:57.000Z");
const content = new TextEncoder().encode("123456789");
it("round-trips names, UTF-8 bytes, lengths, CRC and UTC timestamps deterministically", () => {
  const input = [
    { path: "folder/check.txt", content },
    {
      path: "교사/참고.md",
      content: new TextEncoder().encode("# 한글 문서\n"),
    },
  ];
  const bytes = createStoredZip(input, date);
  const entries = readStoredZip(bytes);
  expect(entries.map(({ path, content }) => ({ path, content }))).toEqual(
    input,
  );
  expect(entries[0]!.crc).toBe(0xcbf43926);
  expect(entries[0]!.dosDate).toBe(((2026 - 1980) << 9) | (10 << 5) | 25);
  expect(entries[0]!.dosTime).toBe((12 << 11) | (34 << 5) | 28);
  expect(createStoredZip(input, date)).toEqual(bytes);
  expect(readStoredZip(createStoredZip([], date))).toEqual([]);
});
it.each([
  "",
  "/absolute",
  "C:/file",
  "../file",
  "a/../file",
  "a\\file",
  "a/",
  "a//b",
  "a/./b",
  "a\0b",
])("rejects unsafe path %j", (path) => {
  expect(() => createStoredZip([{ path, content }], date)).toThrow();
});
it("rejects duplicate paths, invalid dates and ZIP64 limits before allocating", () => {
  const entry = { path: "file", content };
  expect(() => createStoredZip([entry, entry], date)).toThrow();
  expect(() => createStoredZip([entry], new Date("invalid"))).toThrow();
  expect(() => createStoredZip(Array(65536).fill(entry), date)).toThrow();
  expect(() =>
    createStoredZip([{ path: "a".repeat(65536), content }], date),
  ).toThrow();
  const fake = (size: number) => ({ byteLength: size }) as Uint8Array;
  expect(() =>
    createStoredZip([{ path: "big", content: fake(2 ** 32) }], date),
  ).toThrow();
  expect(() =>
    createStoredZip(
      [
        { path: "a", content: fake(2 ** 31) },
        { path: "b", content: fake(2 ** 31) },
      ],
      date,
    ),
  ).toThrow();
});
