import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import {
  adminSessionCookieName,
  createAdminSessionToken,
  isAdminAuthConfigured,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "@/lib/admin/auth";

const PASSWORD = "test-admin-password-1234";
const PASSWORD_HASH =
  "scrypt$v1$32768$8$3$AQEBAQEBAQEBAQEBAQEBAQ$bhlzcbNE2mAAY9b6EDTzxnVkk503gz2VihL1yVJqTsE";
const SESSION_SECRET = Buffer.alloc(32, 2).toString("base64url");

describe("admin authentication", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ADMIN_PASSWORD_HASH = PASSWORD_HASH;
    process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;
    process.env.ADMIN_SESSION_TTL_HOURS = "8";
    delete process.env.VERCEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("fails closed when credential configuration is missing or malformed", () => {
    expect(isAdminAuthConfigured()).toBe(true);
    process.env.ADMIN_SESSION_SECRET = "too-short";
    expect(isAdminAuthConfigured()).toBe(false);
    process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;
    process.env.ADMIN_PASSWORD_HASH = "not-a-supported-hash";
    expect(isAdminAuthConfigured()).toBe(false);
  });

  it("verifies the scrypt password hash without storing plaintext", async () => {
    expect(PASSWORD_HASH).not.toContain(PASSWORD);
    await expect(verifyAdminPassword(PASSWORD)).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong-password")).resolves.toBe(false);
  });

  it("accepts only an untampered, unexpired session token", () => {
    const now = Date.UTC(2026, 7, 5, 0, 0, 0);
    const token = createAdminSessionToken(now);
    expect(verifyAdminSessionToken(token, now + 1_000)).toBe(true);
    expect(verifyAdminSessionToken(`${token.slice(0, -1)}x`, now + 1_000)).toBe(
      false,
    );
    expect(verifyAdminSessionToken(token, now + 8 * 60 * 60 * 1_000)).toBe(
      false,
    );
  });

  it("uses a secure-prefixed cookie name only on Vercel", () => {
    expect(adminSessionCookieName()).toBe("tcontext_admin_session");
    process.env.VERCEL = "1";
    expect(adminSessionCookieName()).toBe("__Secure-tcontext_admin_session");
  });
});
