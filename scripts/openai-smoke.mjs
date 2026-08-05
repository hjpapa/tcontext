import { loadEnvFile } from "node:process";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

try {
  loadEnvFile(".env.local");
} catch {
  // Deployed environments provide variables directly instead of an env file.
}

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
  console.error(
    JSON.stringify({
      ok: false,
      errorType: "ConfigurationError",
      errorCode: "missing_openai_api_key",
    }),
  );
  process.exit(1);
}

const client = new OpenAI({ apiKey });
const schema = z.object({ ok: z.literal(true) }).strict();
const checks = [
  {
    operation: "interview",
    model: process.env.OPENAI_INTERVIEW_MODEL?.trim() || "gpt-5.6-luna",
    effort: "low",
  },
  {
    operation: "profile",
    model: process.env.OPENAI_PROFILE_MODEL?.trim() || "gpt-5.6-terra",
    effort: "low",
  },
  {
    operation: "privacy",
    model: process.env.OPENAI_PRIVACY_MODEL?.trim() || "gpt-5.6-terra",
    effort: "low",
  },
];

for (const check of checks) {
  try {
    const response = await client.responses.parse({
      model: check.model,
      instructions:
        "This is a connectivity check. Return the requested structured value only.",
      input: "Set ok to true.",
      reasoning: { effort: check.effort },
      text: {
        format: zodTextFormat(schema, `tcontext_${check.operation}_smoke`),
      },
      max_output_tokens: 256,
      store: false,
    });

    console.log(
      JSON.stringify({
        operation: check.operation,
        model: check.model,
        ok: response.output_parsed?.ok === true,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        operation: check.operation,
        model: check.model,
        ok: false,
        errorType:
          error instanceof Error ? error.constructor.name : "UnknownError",
        errorStatus:
          typeof error === "object" && error !== null && "status" in error
            ? error.status
            : undefined,
        errorCode:
          typeof error === "object" && error !== null && "code" in error
            ? error.code
            : undefined,
      }),
    );
    process.exitCode = 1;
  }
}
