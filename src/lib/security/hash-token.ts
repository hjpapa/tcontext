import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { ApiError } from "@/lib/security/api-error";

const TOKEN_BYTES = 32;

function getPepper(): string {
  const pepper = process.env.DELETE_TOKEN_PEPPER?.trim();
  if (!pepper || pepper.length < 32) {
    throw new ApiError(
      "configuration_error",
      503,
      "삭제 코드 보안 설정이 완료되지 않았습니다.",
    );
  }
  return pepper;
}

export function createDeletionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashDeletionToken(token: string): string {
  return createHmac("sha256", getPepper()).update(token, "utf8").digest("hex");
}

export function verifyDeletionToken(
  token: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashDeletionToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
