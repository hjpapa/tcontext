import { ApiError } from "@/lib/security/api-error";

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;
const REPLACEMENT_CHARACTER_PATTERN = /\uFFFD/u;
const COMMON_MOJIBAKE_PATTERN =
  /(?:\u00C3|\u00C2|\u00E2\u20AC|\u00EF\u00BF\u00BD|\u5360쏙옙)/u;

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}

export function hasUnsupportedGeneratedCharacters(value: unknown): boolean {
  return stringsIn(value).some(
    (text) =>
      HAN_CHARACTER_PATTERN.test(text) ||
      REPLACEMENT_CHARACTER_PATTERN.test(text) ||
      COMMON_MOJIBAKE_PATTERN.test(text),
  );
}

export function assertSafeGeneratedCharacters(value: unknown): void {
  if (!hasUnsupportedGeneratedCharacters(value)) return;

  throw new ApiError(
    "ai_invalid_response",
    502,
    "AI 응답에 읽기 어려운 문자나 한자가 포함되었습니다. 다시 시도해 주세요.",
  );
}
