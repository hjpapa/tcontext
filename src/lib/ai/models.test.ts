import { afterEach, describe, expect, it, vi } from "vitest";

describe("AI model metadata", () => {
  it("uses GPT-6 Luna with medium reasoning for document generation and refinement", async () => {
    vi.stubEnv("OPENAI_PROFILE_MODEL", "");
    vi.stubEnv("OPENAI_INTERVIEW_MODEL", "");
    vi.stubEnv("OPENAI_PRIVACY_MODEL", "");
    vi.resetModules();
    const { OPENAI_MODELS, OPENAI_REASONING_EFFORT } = await import("./models");
    expect(OPENAI_MODELS).toEqual({
      profile: "gpt-6-luna",
      interview: "gpt-5.6-luna",
      privacy: "gpt-5.6-terra",
    });
    expect(OPENAI_REASONING_EFFORT).toEqual({
      profile: "medium",
      interview: "none",
      privacy: "low",
    });
  });

  it("preserves explicit deployment overrides without lowering profile reasoning", async () => {
    vi.stubEnv("OPENAI_PROFILE_MODEL", " custom-profile-model ");
    vi.resetModules();
    const { OPENAI_MODELS, OPENAI_REASONING_EFFORT } = await import("./models");
    expect(OPENAI_MODELS.profile).toBe("custom-profile-model");
    expect(OPENAI_REASONING_EFFORT.profile).toBe("medium");
  });
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
