import { describe, expect, it } from "vitest";

import {
  assertSafeGeneratedCharacters,
  hasUnsupportedGeneratedCharacters,
} from "@/lib/ai/text-quality";

describe("AI text quality", () => {
  it("accepts modern Korean text and ordinary punctuation", () => {
    expect(
      hasUnsupportedGeneratedCharacters({
        question: "학생 반응에 맞춰 활동 순서를 바꾸는 편인가요?",
        example: "목표는 유지하고 방법은 조정합니다.",
      }),
    ).toBe(false);
  });

  it.each([
    "수업은 \u5B78\u7FD2을 돕습니다.",
    "문장이 \uFFFD 깨졌습니다.",
    "\u00C3\u00AC\u00C2\u00A7\u00C2\u0088\u00EB\u00AC\u00B8",
    "\u5360쏙옙 문장",
  ])("rejects unsupported generated text: %s", (text) => {
    expect(hasUnsupportedGeneratedCharacters(text)).toBe(true);
    expect(() => assertSafeGeneratedCharacters({ nested: [text] })).toThrow(
      "읽기 어려운 문자나 한자",
    );
  });
});
