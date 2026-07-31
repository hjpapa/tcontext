import "server-only";

import { timingSafeEqual } from "node:crypto";

export function secretsMatch(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}
