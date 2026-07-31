import { ApiError } from "@/lib/security/api-error";

const DEFAULT_RETENTION_DAYS = 365;
const MAX_RETENTION_DAYS = 365;
const DAILY_PURGE_BUFFER_DAYS = 1;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_CONSENT_VERSION = "1.0";

export function getConsentVersion(): string {
  return process.env.CONSENT_VERSION?.trim() || DEFAULT_CONSENT_VERSION;
}

export function getRetentionDays(): number {
  const raw = process.env.DATA_RETENTION_DAYS?.trim();
  if (!raw) return DEFAULT_RETENTION_DAYS;
  const days = Number(raw);
  assertValidRetentionDays(days);
  return days;
}

function assertValidRetentionDays(days: number): void {
  if (!Number.isInteger(days) || days < 1 || days > MAX_RETENTION_DAYS) {
    throw new ApiError(
      "configuration_error",
      503,
      "데이터 보유기간 설정이 올바르지 않습니다.",
    );
  }
}

export function calculateRetentionUntil(
  consentedAt: Date,
  days = getRetentionDays(),
): Date {
  assertValidRetentionDays(days);

  // DATA_RETENTION_DAYS is the maximum time a row may actually remain stored.
  // The daily purge can run up to one day after a row becomes eligible, so the
  // eligibility timestamp reserves that interval. A one-day policy is eligible
  // immediately and is removed in the next daily purge cycle.
  const daysUntilPurgeEligibility = Math.max(days - DAILY_PURGE_BUFFER_DAYS, 0);
  return new Date(
    consentedAt.getTime() + daysUntilPurgeEligibility * MILLISECONDS_PER_DAY,
  );
}

export function assertConsentVersion(version: string): void {
  if (version !== getConsentVersion()) {
    throw new ApiError(
      "consent_version_mismatch",
      409,
      "동의 안내가 변경되었습니다. 최신 안내를 확인해 주세요.",
    );
  }
}
