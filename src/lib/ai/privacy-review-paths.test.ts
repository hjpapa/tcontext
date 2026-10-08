import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// The local rules already catch every realistic sample before OpenAI, so they
// are stubbed to "clear" here to exercise how AI candidates are resolved.
vi.mock("@/lib/security/privacy-guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/privacy-guard")>()),
  localAuthoredProfilePrivacyReview: () => ({ status: "clear", items: [] }),
}));

import OpenAI from "openai";
import {
  resetOpenAIClientForTests,
  setOpenAIClientForTests,
} from "@/lib/ai/client";
import { reviewProfileWithAI } from "@/lib/ai/privacy";
import { FICTIONAL_PROFILES } from "@/content/examples";

function profileWithSummary(shortSummary: string) {
  const fixture = FICTIONAL_PROFILES[0];
  if (!fixture) throw new Error("Missing fictional profile");
  return { ...structuredClone(fixture), shortSummary };
}

describe("path-only AI privacy candidates", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetOpenAIClientForTests();
    vi.restoreAllMocks();
  });

  it("reports the server's own copy of the field text and drops unknown paths", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        items: [
          {
            path: "profile.shortSummary",
            category: "person_name",
            reason: "이름 표지와 실명이 함께 있습니다.",
            suggestedRewrite: "실명을 제거합니다.",
          },
          {
            path: "profile.modules.99.summary",
            category: "person_name",
            reason: "존재하지 않는 필드입니다.",
            suggestedRewrite: "삭제합니다.",
          },
        ],
      },
      usage: null,
    });
    setOpenAIClientForTests({ responses: { parse } } as unknown as OpenAI);

    await expect(
      reviewProfileWithAI(profileWithSummary("제 이름은 김민수예요.")),
    ).resolves.toEqual({
      source: "openai",
      review: {
        status: "needs_review",
        items: [
          {
            text: "제 이름은 김민수예요.",
            reason: "이름 표지와 실명이 함께 있습니다.",
            suggestedRewrite: "실명을 제거합니다.",
          },
        ],
      },
    });
  });

  it("still requires concrete evidence in the field the path points to", async () => {
    setOpenAIClientForTests({
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: {
            items: [
              {
                path: "profile.shortSummary",
                category: "person_name",
                reason: "일반 문장을 이름으로 판단했습니다.",
                suggestedRewrite: "학생이라는 단어를 삭제합니다.",
              },
            ],
          },
          usage: null,
        }),
      },
    } as unknown as OpenAI);

    await expect(
      reviewProfileWithAI(profileWithSummary("학생의 질문을 먼저 듣습니다.")),
    ).resolves.toEqual({
      source: "openai",
      review: { status: "clear", items: [] },
    });
  });
});
