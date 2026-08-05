export const OPENAI_MODELS = {
  interview: process.env.OPENAI_INTERVIEW_MODEL?.trim() || "gpt-5.6-luna",
  profile: process.env.OPENAI_PROFILE_MODEL?.trim() || "gpt-5.6-terra",
  privacy: process.env.OPENAI_PRIVACY_MODEL?.trim() || "gpt-5.6-terra",
} as const;

export const OPENAI_REASONING_EFFORT = {
  interview: "none",
  profile: "low",
  privacy: "low",
} as const;

export const OPENAI_TIMEOUT_MS = {
  interview: 20_000,
  profile: 45_000,
  privacy: 25_000,
} as const;

export const PROFILE_SCHEMA_VERSION =
  process.env.PROFILE_SCHEMA_VERSION?.trim() || "1.0";

export const PROMPT_VERSION = process.env.PROMPT_VERSION?.trim() || "1.2";

export const APP_VERSION = process.env.APP_VERSION?.trim() || "0.1.0";
