import { afterEach, describe, expect, it, vi } from "vitest";

describe("AI model metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps the prompt version tied to the shipped prompt code", async () => {
    vi.stubEnv("PROMPT_VERSION", "1.2");
    vi.resetModules();

    const { PROMPT_VERSION } = await import("@/lib/ai/models");

    expect(PROMPT_VERSION).toBe("2.1");
  });
});
