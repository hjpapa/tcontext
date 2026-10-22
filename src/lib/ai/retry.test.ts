// @vitest-environment node
import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

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
