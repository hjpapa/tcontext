import { describe, expect, it } from "vitest";

import { formatRetryAfter, rateLimitMessage } from "@/lib/http/retry-after";
import {
  getTabId,
  jsonRequestHeaders,
  TAB_ID_HEADER,
  TAB_ID_PATTERN,
} from "@/lib/http/tab-id";

describe("tab ID", () => {
  it("stays in memory for the tab and is never written to browser storage", () => {
    const id = getTabId();
    expect(id).toMatch(TAB_ID_PATTERN);
    expect(getTabId()).toBe(id);
    expect(jsonRequestHeaders()).toEqual({
      "Content-Type": "application/json",
      [TAB_ID_HEADER]: id,
    });
    expect(document.cookie).toBe("");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe("retry wait", () => {
  it.each([
    [0, "약 1초"],
    [42, "약 42초"],
    [61, "약 2분"],
    [600, "약 10분"],
    [3_600, "약 1시간"],
    [16 * 3_600 + 30, "약 16시간 1분"],
  ])("formats %i seconds as %s", (seconds, text) => {
    expect(formatRetryAfter(seconds)).toBe(text);
  });

  it("shows the server's request-limit message, which names the wait", async () => {
    const response = Response.json(
      {
        error: {
          code: "rate_limit_exceeded",
          message:
            "같은 네트워크에서 요청이 많습니다. 약 3분 뒤 다시 시도해 주세요.",
          details: { retryAfterSeconds: 170, scope: "network" },
        },
      },
      { status: 429, headers: { "Retry-After": "170" } },
    );
    expect(await rateLimitMessage(response)).toBe(
      "같은 네트워크에서 요청이 많습니다. 약 3분 뒤 다시 시도해 주세요.",
    );
    // The body is still readable by the caller.
    expect((await response.json()).error.code).toBe("rate_limit_exceeded");
  });

  it("falls back to Retry-After for a 429 from elsewhere", async () => {
    expect(
      await rateLimitMessage(
        new Response("busy", { status: 429, headers: { "Retry-After": "90" } }),
      ),
    ).toBe("요청이 많습니다. 약 2분 뒤 다시 시도해 주세요.");
    expect(await rateLimitMessage(new Response("busy", { status: 429 }))).toBe(
      "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("leaves every other response to the caller", async () => {
    expect(await rateLimitMessage(new Response("{}", { status: 503 }))).toBe(
      null,
    );
  });
});
