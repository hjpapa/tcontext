import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { ApiError } from "@/lib/security/api-error";
import type { TeacherContextProfile } from "@/types/profile";

const TOKEN_VERSION = "v1";
const MIN_SECRET_LENGTH = 32;
const MAX_CLOCK_SKEW_MS = 60_000;

export const PRIVACY_REVIEW_TOKEN_TTL_MS = 60 * 60_000;

function readSigningSecret(): string | undefined {
  const secret = process.env.PRIVACY_REVIEW_SIGNING_SECRET?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : undefined;
}

function getSigningSecret(): string {
  const secret = readSigningSecret();
  if (!secret) {
    throw new ApiError(
      "configuration_error",
      503,
      "개인정보 검사 확인 보안 설정이 완료되지 않았습니다.",
    );
  }
  return secret;
}

export function isPrivacyReviewSigningConfigured(): boolean {
  return readSigningSecret() !== undefined;
}

/** Key-sorted JSON, so the digest never depends on property order. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function profileDigest(profile: TeacherContextProfile): string {
  return createHash("sha256")
    .update(canonicalJson(profile), "utf8")
    .digest("base64url");
}

function signature(secret: string, issuedAt: number, digest: string): Buffer {
  return createHmac("sha256", secret)
    .update(
      `tcontext:privacy-review:${TOKEN_VERSION}:clear:${issuedAt}:${digest}`,
      "utf8",
    )
    .digest();
}

/**
 * Signs "OpenAI reviewed exactly this profile and found it clear" without
 * storing anything. The profile must already carry the clear review, because
 * that is the JSON the browser later submits for contribution.
 */
export function issuePrivacyReviewToken(
  profile: TeacherContextProfile,
  now = Date.now(),
): string {
  if (
    profile.privacyReview.status !== "clear" ||
    profile.privacyReview.items.length > 0
  ) {
    throw new Error("Only a clear privacy review can be signed.");
  }
  const issuedAt = Math.floor(now);
  const mac = signature(getSigningSecret(), issuedAt, profileDigest(profile));
  return `${TOKEN_VERSION}.${issuedAt}.${mac.toString("base64url")}`;
}

function invalidTokenError(): ApiError {
  return new ApiError(
    "privacy_review_required",
    422,
    "개인정보 검사 뒤 문서가 바뀌었거나 검사 확인 정보가 올바르지 않습니다. 검토 화면에서 개인정보 검사를 다시 실행해 주세요.",
  );
}

export function verifyPrivacyReviewToken(
  token: string | undefined,
  profile: TeacherContextProfile,
  now = Date.now(),
): void {
  const secret = getSigningSecret();
  const [version, issuedAtText, macText, ...rest] = token?.split(".") ?? [];
  if (
    version !== TOKEN_VERSION ||
    !issuedAtText ||
    !/^\d{1,15}$/u.test(issuedAtText) ||
    !macText ||
    rest.length > 0
  ) {
    throw invalidTokenError();
  }

  const issuedAt = Number(issuedAtText);
  const expected = signature(secret, issuedAt, profileDigest(profile));
  const provided = Buffer.from(macText, "base64url");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    throw invalidTokenError();
  }

  // Checked after the signature so an unsigned timestamp reveals nothing.
  if (issuedAt > now + MAX_CLOCK_SKEW_MS) throw invalidTokenError();
  if (now - issuedAt > PRIVACY_REVIEW_TOKEN_TTL_MS) {
    throw new ApiError(
      "privacy_review_required",
      422,
      "개인정보 검사 후 1시간이 지나 검사 확인이 만료되었습니다. 검토 화면에서 개인정보 검사를 다시 실행해 주세요.",
    );
  }
}
