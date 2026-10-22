// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithDeadline } from "./fetch-with-deadline";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Wi-Fi request deadlines", () => {
  it("preserves status, retry headers and JSON without retrying a POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { code: "rate_limit_exceeded" } },
          { status: 429, headers: { "Retry-After": "30" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const response = await fetchWithDeadline(
      "/api/profile/generate",
      { method: "POST" },
      100,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(await response.json()).toEqual({
      error: { code: "rate_limit_exceeded" },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "releases a stalled request, including after headers arrive (%s)",
    async (headersArrived) => {
      vi.useFakeTimers();
      const fetchMock = vi.fn((_url, init: RequestInit) => {
        const stalled = new Promise<never>((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        });
        return headersArrived
          ? Promise.resolve({ arrayBuffer: () => stalled })
          : stalled;
      });
      vi.stubGlobal("fetch", fetchMock);
      const pending = fetchWithDeadline(
        "/api/profile/generate",
        { method: "POST" },
        100,
      );
      const assertion = expect(pending).rejects.toThrow("새로고침하지 말고");
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("explains a connection failure without exposing the submitted body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private answer")),
    );
    await expect(
      fetchWithDeadline(
        "/api/profile/generate",
        { method: "POST", body: "private answer" },
        100,
      ),
    ).rejects.toThrow("네트워크 연결을 확인해 주세요");
  });
});
