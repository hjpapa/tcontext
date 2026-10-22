export const OPENAI_MODELS = {
  interview: process.env.OPENAI_INTERVIEW_MODEL?.trim() || "gpt-5.6-luna",
  profile: process.env.OPENAI_PROFILE_MODEL?.trim() || "gpt-6-luna",
  privacy: process.env.OPENAI_PRIVACY_MODEL?.trim() || "gpt-5.6-terra",
} as const;

export const OPENAI_REASONING_EFFORT = {
  interview: "none",
  profile: "medium",
  privacy: "low",
} as const;

export const OPENAI_TIMEOUT_MS = {
  interview: 20_000,
  profile: 90_000,
  privacy: 25_000,
} as const;

// Includes retries/backoff and leaves 10s inside the 120s profile routes for
// request limiting, validation and response delivery. Browser deadline is 130s.
export const PROFILE_TOTAL_TIMEOUT_MS = 110_000;

export const PROFILE_SCHEMA_VERSION =
  process.env.PROFILE_SCHEMA_VERSION?.trim() || "1.0";

// Prompt changes ship with the code, so deployment configuration must not be
// able to label a newer prompt with an older version.
export const PROMPT_VERSION = "2.1";

export const APP_VERSION = process.env.APP_VERSION?.trim() || "0.1.0";
