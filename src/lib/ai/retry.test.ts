// @vitest-environment node
import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError } from "@/lib/security/api-error";

vi.mock("server-only", () => ({}));
import {
  resetOpenAIClientForTests,
  runStructuredResponse,
  setOpenAIClientForTests,
} from "./client";

const options = {
  operation: "profile_generate" as const,
  model: "test-model",
  effort: "low" as const,
  instructions: "test",
  input: "synthetic private answer",
  schema: z.object({ ok: z.boolean() }),
  schemaName: "retry_test",
  maxOutputTokens: 100,
  retryMaxOutputTokens: 200,
  retryTransientErrorOnce: true,
  timeoutMs: 45_000,
};
const success = { output_parsed: { ok: true }, usage: null };
const truncated = {
  output_parsed: null,
  incomplete_details: { reason: "max_output_tokens" },
  usage: null,
};
const limited = (headers = new Headers()) =>
  OpenAI.APIError.generate(
    429,
    { error: { code: "rate_limit_exceeded" } },
    "private provider body",
    headers,
  );

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetOpenAIClientForTests();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("provider retry budget for simultaneous draft generation", () => {
  it("retries invalid structured output once without accepting the invalid draft", async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce({ output_parsed: { ok: "private invalid body" } })
      .mockResolvedValue(success);
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    await expect(
      runStructuredResponse({ ...options, retryInvalidResponseOnce: true }),
    ).resolves.toEqual({ ok: true });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      "private invalid body",
    );
  });

  it("revalidates domain output within the remaining deadline", async () => {
    const parse = vi
      .fn()
      .mockImplementationOnce(async () => {
        vi.setSystemTime(Date.now() + 70_000);
        return success;
      })
      .mockResolvedValue(success);
    const validateOutput = vi.fn().mockImplementationOnce(() => {
      throw new ApiError(
        "ai_invalid_response",
        502,
        "synthetic invalid characters",
      );
    });
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    await expect(
      runStructuredResponse({
        ...options,
        timeoutMs: 90_000,
        totalTimeoutMs: 110_000,
        retryInvalidResponseOnce: true,
        validateOutput,
      }),
    ).resolves.toEqual({ ok: true });
    expect(parse.mock.calls.map((call) => call[1].timeout)).toEqual([
      90_000, 40_000,
    ]);
    expect(validateOutput).toHaveBeenCalledTimes(2);
  });

  it("does not retry a refusal or a privacy rejection", async () => {
    const parse = vi
      .fn()
      .mockResolvedValue({ output_parsed: null, status: "completed" });
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    await expect(
      runStructuredResponse({ ...options, retryInvalidResponseOnce: true }),
    ).rejects.toMatchObject({ code: "ai_invalid_response" });
    expect(parse).toHaveBeenCalledTimes(1);
    parse.mockClear().mockResolvedValue(success);
    await expect(
      runStructuredResponse({
        ...options,
        retryInvalidResponseOnce: true,
        validateOutput: () => {
          throw new ApiError("privacy_review_required", 422, "private");
        },
      }),
    ).rejects.toMatchObject({ code: "privacy_review_required" });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("keeps the two-call cap when both validation attempts fail", async () => {
    const parse = vi
      .fn()
      .mockRejectedValue(new SyntaxError("private invalid JSON"));
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    await expect(
      runStructuredResponse({ ...options, retryInvalidResponseOnce: true }),
    ).rejects.toMatchObject({ code: "ai_invalid_response" });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      "private invalid JSON",
    );
  });
  const extendedOptions = {
    ...options,
    timeoutMs: 90_000,
    totalTimeoutMs: 110_000,
  };

  it("allows a 60s full-profile response without the old 45s cutoff", async () => {
    const parse = vi.fn(
      (_body, requestOptions) =>
        new Promise((resolve, reject) => {
          setTimeout(
            () =>
              requestOptions.timeout < 60_000
                ? reject(new OpenAI.APIConnectionTimeoutError())
                : resolve(success),
            Math.min(60_000, requestOptions.timeout),
          );
        }),
    );
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    const assertion = expect(
      runStructuredResponse(extendedOptions),
    ).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("deducts a slow truncated response from the retry deadline", async () => {
    const parse = vi
      .fn()
      .mockImplementationOnce(async () => {
        vi.setSystemTime(Date.now() + 70_000);
        return truncated;
      })
      .mockResolvedValue(success);
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    await expect(runStructuredResponse(extendedOptions)).resolves.toEqual({
      ok: true,
    });
    expect(parse.mock.calls.map((call) => call[1].timeout)).toEqual([
      90_000, 40_000,
    ]);
  });

  it("charges both elapsed work and provider backoff to the same deadline", async () => {
    const parse = vi
      .fn()
      .mockImplementationOnce(async () => {
        vi.setSystemTime(Date.now() + 80_000);
        throw limited(new Headers({ "retry-after": "10" }));
      })
      .mockResolvedValue(success);
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    const pending = runStructuredResponse(extendedOptions);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(parse).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(parse.mock.calls.map((call) => call[1].timeout)).toEqual([
      90_000, 20_000,
    ]);
  });

  it("does not sleep past the deadline or violate a provider wait", async () => {
    const parse = vi.fn().mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 108_000);
      throw limited(new Headers({ "retry-after": "5" }));
    });
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    await expect(runStructuredResponse(extendedOptions)).rejects.toMatchObject({
      code: "ai_rate_limited",
      retryAfterSeconds: 5,
    });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a truncation retry after the shared deadline expires", async () => {
    const parse = vi.fn().mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 110_000);
      return truncated;
    });
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    await expect(runStructuredResponse(extendedOptions)).rejects.toMatchObject({
      code: "ai_timeout",
      status: 504,
    });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["retry-after", "5", 5_000],
    ["retry-after-ms", "1500", 1_500],
    ["retry-after", "invalid", 400],
  ])("honors %s=%s before retrying", async (header, value, delay) => {
    const parse = vi
      .fn()
      .mockRejectedValueOnce(limited(new Headers({ [header]: value })))
      .mockResolvedValueOnce(success);
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    const pending = runStructuredResponse(options);
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(parse).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      "private",
    );
  });

  it("honors an HTTP-date retry header", async () => {
    vi.setSystemTime(new Date("2026-10-22T00:00:00Z"));
    const parse = vi
      .fn()
      .mockRejectedValueOnce(
        limited(
          new Headers({ "retry-after": "Thu, 22 Oct 2026 00:00:05 GMT" }),
        ),
      )
      .mockResolvedValueOnce(success);
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    const pending = runStructuredResponse(options);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(parse).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it("returns a long provider wait to the teacher instead of retrying too early", async () => {
    const parse = vi
      .fn()
      .mockRejectedValue(limited(new Headers({ "retry-after": "60" })));
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
    await expect(runStructuredResponse(options)).rejects.toMatchObject({
      code: "ai_rate_limited",
      retryAfterSeconds: 60,
      details: { retryAfterSeconds: 60 },
      message: expect.stringContaining("약 1분"),
    });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it.each(["transient-first", "truncated-first"])(
    "never makes a third provider call when failures combine (%s)",
    async (order) => {
      const parse = vi.fn();
      if (order === "transient-first")
        parse.mockRejectedValueOnce(limited()).mockResolvedValueOnce(truncated);
      else
        parse.mockResolvedValueOnce(truncated).mockRejectedValueOnce(limited());
      parse.mockResolvedValue(success);
      setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);
      const assertion = expect(
        runStructuredResponse(options),
      ).rejects.toBeInstanceOf(Error);
      await vi.runAllTimersAsync();
      await assertion;
      expect(parse).toHaveBeenCalledTimes(2);
    },
  );
});
