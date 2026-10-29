// @vitest-environment node
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { createSkillPackageFile, SKILL_DESCRIPTION } from "./skill";
import { profileToMarkdown } from "./profile-to-markdown";
import { contextAsOf, profileToCoreMarkdown } from "./profile-variants";
import {
  TEST_AS_OF,
  VARIANT_FIXTURES,
  variantMarkdown,
} from "./profile-variants.test-fixtures";
import { readStoredZip } from "./zip.test-helper";

const now = "2026-10-30T00:00:00.000Z";
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const body = (text: string) => text.slice(text.indexOf("\n---\n") + 5);

it.each(VARIANT_FIXTURES)(
  "embeds the exact core body and preserves full reference bytes for $name",
  ({ profile }) => {
    const before = structuredClone(profile);
    for (const asOf of [undefined, TEST_AS_OF]) {
      const result = createSkillPackageFile({ profile, now, asOf });
      if (!result.ok) throw new Error(result.error);
      expect(result.embeddedCore).toBe(true);
      const entries = readStoredZip(result.value.content);
      const skill = decode(entries[0]!.content);
      expect(
        skill.startsWith(
          `---\nname: teacher-context\ndescription: ${JSON.stringify(SKILL_DESCRIPTION)}\n---\n`,
        ),
      ).toBe(true);
      const core = variantMarkdown(
        profileToCoreMarkdown(profile, { asOf: asOf ?? contextAsOf(profile) }),
      );
      expect(skill.slice(-body(core).length)).toBe(body(core));
      expect(skill).toContain(
        "이 skill에는 교사가 검토한 핵심 맥락이 들어 있습니다.",
      );
      expect(entries[1]!.content).toEqual(
        new TextEncoder().encode(profileToMarkdown(profile)),
      );
      expect(createSkillPackageFile({ profile, now, asOf })).toEqual(result);
    }
    expect(profile).toEqual(before);
  },
);

it.each([
  ["characters", "지원".repeat(5000)],
  ["lines", Array.from({ length: 501 }, (_, i) => `지원 ${i}`).join("\n")],
])(
  "uses byte-identical original instructions when the core exceeds %s",
  (_, longItem) => {
    const profile = structuredClone(FICTIONAL_PROFILES[0]!);
    profile.realisticConstraints = [longItem!];
    const result = createSkillPackageFile({ profile, now });
    if (!result.ok) throw new Error(result.error);
    expect(result.embeddedCore).toBe(false);
    const entries = readStoredZip(result.value.content);
    const instructions = decode(entries[0]!.content);
    // Captured from the pre-WU-22 generator before changing skill.ts.
    expect(createHash("sha256").update(entries[0]!.content).digest("hex")).toBe(
      "822177ebe65aa2becfa9ea951629964fbe8232dfd332f5b858e46d1f417161ec",
    );
    expect(instructions).toContain(
      "# 교사 컨텍스트 사용 지침\n\n이 skill을 사용할 때는 답하기 전에 반드시 참고 파일 `references/teacher-profile.md` 전체를 먼저 읽으세요. 교사 컨텍스트는 이 파일에만 있습니다. 파일을 읽지 못했다면 그 사실을 사용자에게 알리고, 교사 프로파일 문서를 대화에 첨부해 달라고 요청하세요.",
    );
    expect(instructions).not.toContain(profile.profileTitle);
    expect(entries[1]!.content).toEqual(
      new TextEncoder().encode(profileToMarkdown(profile)),
    );
  },
);

it("rejects an invalid explicit context date", () => {
  expect(
    createSkillPackageFile({
      profile: FICTIONAL_PROFILES[0],
      now,
      asOf: { date: "invalid", source: "confirmed" },
    }),
  ).toEqual({ ok: false, error: "invalid" });
});
