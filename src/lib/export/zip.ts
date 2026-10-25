const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 255]!;
  return (crc ^ 0xffffffff) >>> 0;
}

/** Deterministic UTF-8, method-0 ZIP. No ZIP64 or directory entries. */
export function createStoredZip(
  entries: ReadonlyArray<{ path: string; content: Uint8Array }>,
  modifiedAt: Date,
): Uint8Array {
  if (!Number.isFinite(modifiedAt.getTime()) || entries.length > 65535)
    throw new Error("Invalid ZIP date or entry count");
  const paths = new Set<string>();
  const encoder = new TextEncoder();
  let localSize = 0;
  let centralSize = 0;
  const prepared = entries.map(({ path, content }) => {
    if (
      !path ||
      /[\\:\u0000]/u.test(path) ||
      path.split("/").some((part) => !part || part === ".." || part === ".") ||
      paths.has(path)
    )
      throw new Error("Invalid or duplicate ZIP path");
    paths.add(path);
    const name = encoder.encode(path);
    if (name.length > 65535 || content.byteLength >= 0x100000000)
      throw new Error("ZIP64 is not supported");
    const offset = localSize;
    localSize += 30 + name.length + content.byteLength;
    centralSize += 46 + name.length;
    if (localSize + centralSize + 22 >= 0x100000000)
      throw new Error("ZIP64 is not supported");
    return { name, content, offset };
  });
  // UTC avoids host timezone differences. DOS timestamps support 1980–2107.
  const date = new Date(
    Math.min(
      Date.UTC(2107, 11, 31, 23, 59, 58),
      Math.max(Date.UTC(1980, 0, 1), modifiedAt.getTime()),
    ),
  );
  const dosDate =
    ((date.getUTCFullYear() - 1980) << 9) |
    ((date.getUTCMonth() + 1) << 5) |
    date.getUTCDate();
  const dosTime =
    (date.getUTCHours() << 11) |
    (date.getUTCMinutes() << 5) |
    Math.floor(date.getUTCSeconds() / 2);
  const result = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(result.buffer);
  const u16 = (offset: number, value: number) =>
    view.setUint16(offset, value, true);
  const u32 = (offset: number, value: number) =>
    view.setUint32(offset, value, true);
  let central = localSize;
  for (const { name, content, offset } of prepared) {
    const crc = crc32(content);
    u32(offset, 0x04034b50);
    u16(offset + 4, 20);
    u16(offset + 6, 0x0800);
    u16(offset + 10, dosTime);
    u16(offset + 12, dosDate);
    u32(offset + 14, crc);
    u32(offset + 18, content.byteLength);
    u32(offset + 22, content.byteLength);
    u16(offset + 26, name.length);
    result.set(name, offset + 30);
    result.set(content, offset + 30 + name.length);
    u32(central, 0x02014b50);
    u16(central + 4, 20);
    u16(central + 6, 20);
    u16(central + 8, 0x0800);
    u16(central + 12, dosTime);
    u16(central + 14, dosDate);
    u32(central + 16, crc);
    u32(central + 20, content.byteLength);
    u32(central + 24, content.byteLength);
    u16(central + 28, name.length);
    u32(central + 42, offset);
    result.set(name, central + 46);
    central += 46 + name.length;
  }
  u32(central, 0x06054b50);
  u16(central + 8, entries.length);
  u16(central + 10, entries.length);
  u32(central + 12, centralSize);
  u32(central + 16, localSize);
  return result;
}
