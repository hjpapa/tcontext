/** Includes reading the body: a Wi-Fi stall must not leave the UI busy forever. */
export async function fetchWithDeadline(
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.arrayBuffer();
    return new Response(body.byteLength ? body : null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    throw new Error(
      controller.signal.aborted
        ? "응답을 기다리는 시간이 길어 요청을 중단했습니다. 답변은 이 탭에 그대로 있습니다. 새로고침하지 말고 잠시 후 다시 시도해 주세요."
        : "네트워크 연결을 확인해 주세요. 답변은 이 탭에 그대로 있습니다. 새로고침하지 말고 연결 후 다시 시도해 주세요.",
    );
  } finally {
    clearTimeout(timer);
  }
}
