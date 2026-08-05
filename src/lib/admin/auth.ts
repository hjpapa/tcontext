import "server-only";

import {
  createHmac,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { cookies } from "next/headers";

import { ApiError } from "@/lib/security/api-error";

const PASSWORD_HASH_PREFIX = "scrypt";
const PASSWORD_HASH_VERSION = "v1";
const SCRYPT_COST = 32_768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 3;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const SESSION_AUDIENCE = "tcontext-admin";
const SESSION_VERSION = 1;
const DEFAULT_SESSION_TTL_HOURS = 8;
const MAX_SESSION_TTL_HOURS = 24;
const MAX_PASSWORD_LENGTH = 256;

type PasswordHashConfig = {
  salt: Buffer;
  digest: Buffer;
};

type AdminSessionPayload = {
  v: number;
  aud: string;
  iat: number;
  exp: number;
};

function configurationError(): ApiError {
  return new ApiError(
    "configuration_error",
    503,
    "관리자 로그인이 아직 설정되지 않았습니다.",
  );
}

function decodeBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.toString("base64url") === value ? decoded : null;
  } catch {
    return null;
  }
}

function parsePasswordHash(
  value: string | undefined,
): PasswordHashConfig | null {
  if (!value) return null;
  const [prefix, version, cost, blockSize, parallelization, salt, digest] =
    value.split("$");
  if (
    prefix !== PASSWORD_HASH_PREFIX ||
    version !== PASSWORD_HASH_VERSION ||
    Number(cost) !== SCRYPT_COST ||
    Number(blockSize) !== SCRYPT_BLOCK_SIZE ||
    Number(parallelization) !== SCRYPT_PARALLELIZATION ||
    !salt ||
    !digest
  ) {
    return null;
  }

  const saltBytes = decodeBase64Url(salt);
  const digestBytes = decodeBase64Url(digest);
  if (
    !saltBytes ||
    saltBytes.length < 16 ||
    !digestBytes ||
    digestBytes.length !== SCRYPT_KEY_LENGTH
  ) {
    return null;
  }
  return { salt: saltBytes, digest: digestBytes };
}

function sessionSecret(): Buffer | null {
  const encoded = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!encoded) return null;
  const secret = decodeBase64Url(encoded);
  return secret && secret.length >= 32 ? secret : null;
}

function sessionTtlSeconds(): number | null {
  const raw = process.env.ADMIN_SESSION_TTL_HOURS?.trim();
  const hours = raw ? Number(raw) : DEFAULT_SESSION_TTL_HOURS;
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_SESSION_TTL_HOURS) {
    return null;
  }
  return hours * 60 * 60;
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  const options: ScryptOptions = {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function hmac(payload: string, secret: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update("tcontext-admin-session\0", "utf8")
    .update(payload, "utf8")
    .digest();
}

function secureCookie(): boolean {
  return process.env.VERCEL === "1";
}

export function adminSessionCookieName(): string {
  return secureCookie()
    ? "__Secure-tcontext_admin_session"
    : "tcontext_admin_session";
}

export function isAdminAuthConfigured(): boolean {
  return (
    parsePasswordHash(process.env.ADMIN_PASSWORD_HASH?.trim()) !== null &&
    sessionSecret() !== null &&
    sessionTtlSeconds() !== null
  );
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const config = parsePasswordHash(process.env.ADMIN_PASSWORD_HASH?.trim());
  if (!config || !sessionSecret() || !sessionTtlSeconds()) {
    throw configurationError();
  }
  if (!password || password.length > MAX_PASSWORD_LENGTH) return false;

  const actual = await derivePasswordKey(password, config.salt);
  return timingSafeEqual(actual, config.digest);
}

export function createAdminSessionToken(now = Date.now()): string {
  const secret = sessionSecret();
  const ttlSeconds = sessionTtlSeconds();
  if (!secret || !ttlSeconds) throw configurationError();

  const issuedAt = Math.floor(now / 1000);
  const payload: AdminSessionPayload = {
    v: SESSION_VERSION,
    aud: SESSION_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = hmac(encodedPayload, secret).toString("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(
  token: string | null | undefined,
  now = Date.now(),
): boolean {
  const secret = sessionSecret();
  const ttlSeconds = sessionTtlSeconds();
  if (!secret || !ttlSeconds || !token || token.length > 1024) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const encodedPayload = parts[0];
  const encodedSignature = parts[1];
  if (!encodedPayload || !encodedSignature) return false;

  const providedSignature = decodeBase64Url(encodedSignature);
  const expectedSignature = hmac(encodedPayload, secret);
  if (
    !providedSignature ||
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return false;
  }

  const payloadBytes = decodeBase64Url(encodedPayload);
  if (!payloadBytes || payloadBytes.length > 512) return false;
  try {
    const payload = JSON.parse(
      payloadBytes.toString("utf8"),
    ) as Partial<AdminSessionPayload>;
    const current = Math.floor(now / 1000);
    return (
      payload.v === SESSION_VERSION &&
      payload.aud === SESSION_AUDIENCE &&
      Number.isInteger(payload.iat) &&
      Number.isInteger(payload.exp) &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number" &&
      payload.iat <= current + 60 &&
      payload.exp > current &&
      payload.exp > payload.iat &&
      payload.exp - payload.iat <= ttlSeconds
    );
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!isAdminAuthConfigured()) return false;
  const cookieStore = await cookies();
  return verifyAdminSessionToken(
    cookieStore.get(adminSessionCookieName())?.value,
  );
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    throw new ApiError("unauthorized", 401, "관리자 로그인이 필요합니다.");
  }
}

export async function setAdminSessionCookie(): Promise<void> {
  const ttlSeconds = sessionTtlSeconds();
  if (!ttlSeconds) throw configurationError();
  const cookieStore = await cookies();
  cookieStore.set({
    name: adminSessionCookieName(),
    value: createAdminSessionToken(),
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookie(),
    path: "/admin",
    maxAge: ttlSeconds,
    priority: "high",
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: adminSessionCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookie(),
    path: "/admin",
    maxAge: 0,
    priority: "high",
  });
}
