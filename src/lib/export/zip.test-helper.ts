import assert from "node:assert/strict";

/** Independent test reader: EOCD → central directory → local headers. */
export function readStoredZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  const end = bytes.length - 22;
  assert.equal(u32(end), 0x06054b50);
  assert.equal(u16(end + 4), 0);
  assert.equal(u16(end + 6), 0);
  assert.equal(u16(end + 8), u16(end + 10));
  assert.equal(u16(end + 20), 0);
  const count = u16(end + 10);
  let central = u32(end + 16);
  const centralStart = central;
  const result = [];
  for (let index = 0; index < count; index++) {
    assert.equal(u32(central), 0x02014b50);
    assert.equal(u16(central + 8), 0x0800);
    assert.equal(u16(central + 10), 0);
    const crc = u32(central + 16);
    const size = u32(central + 24);
    assert.equal(u32(central + 20), size);
    const nameSize = u16(central + 28);
    const nameBytes = bytes.slice(central + 46, central + 46 + nameSize);
    const path = new TextDecoder().decode(nameBytes);
    const local = u32(central + 42);
    assert.equal(u32(local), 0x04034b50);
    assert.equal(u16(local + 6), 0x0800);
    assert.equal(u16(local + 8), 0);
    assert.equal(u16(local + 10), u16(central + 12));
    assert.equal(u16(local + 12), u16(central + 14));
    assert.equal(u32(local + 14), crc);
    assert.equal(u32(local + 18), size);
    assert.equal(u32(local + 22), size);
    assert.equal(u16(local + 26), nameSize);
    assert.deepEqual(bytes.slice(local + 30, local + 30 + nameSize), nameBytes);
    const dataStart = local + 30 + nameSize + u16(local + 28);
    assert.ok(dataStart + size <= centralStart);
    const content = bytes.slice(dataStart, dataStart + size);
    // Bit-at-a-time CRC, independent of the writer's lookup table.
    let expected = 0xffffffff;
    for (const byte of content) {
      expected ^= byte;
      for (let bit = 0; bit < 8; bit++)
        expected = (expected >>> 1) ^ (expected & 1 ? 0xedb88320 : 0);
    }
    assert.equal(crc, (expected ^ 0xffffffff) >>> 0);
    result.push({
      path,
      content,
      crc,
      size,
      dosDate: u16(local + 12),
      dosTime: u16(local + 10),
    });
    central += 46 + nameSize + u16(central + 30) + u16(central + 32);
  }
  assert.equal(central, end);
  assert.equal(central - centralStart, u32(end + 12));
  return result;
}
