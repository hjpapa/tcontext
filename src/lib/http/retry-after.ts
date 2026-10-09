export function formatRetryAfter(seconds: number): string {
  const safeSeconds = Math.max(1, Math.ceil(seconds));
  if (safeSeconds < 60) return `약 ${safeSeconds}초`;
  const minutes = Math.ceil(safeSeconds / 60);
  if (minutes < 60) return `약 ${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0
    ? `약 ${hours}시간`
    : `약 ${hours}시간 ${restMinutes}분`;
}

/**
 * The teacher-facing text for a request-limit 429: the server's message
 * already names the wait, and any other 429 falls back to Retry-After.
 * Returns null for every other response so callers keep their own handling.
 */
export async function rateLimitMessage(
  response: Response,
): Promise<string | null> {
  if (response.status !== 429) return null;
  try {
    const body = (await response.clone().json()) as {
      error?: { code?: unknown; message?: unknown };
    };
    if (
      body.error?.code === "rate_limit_exceeded" &&
      typeof body.error.message === "string"
    ) {
      return body.error.message;
    }
  } catch {}
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter > 0
    ? `요청이 많습니다. ${formatRetryAfter(retryAfter)} 뒤 다시 시도해 주세요.`
    : "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
}
