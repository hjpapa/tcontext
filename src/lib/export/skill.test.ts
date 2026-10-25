import { expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  COMMON_USAGE_INSTRUCTIONS,
  SKILL_USAGE_PRINCIPLES,
} from "@/content/usage-instructions";
import { PENDING_PRIVACY_REVIEW } from "@/types/profile";
import { createSkillFile, SKILL_DESCRIPTION } from "./skill";
import { profileToMarkdown } from "./profile-to-markdown";
const now = "2026-10-25T12:00:00.000Z";
it("exports one fixed frontmatter and all canonical document content deterministically", () => {
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  const before = structuredClone(profile);
  const result = createSkillFile({ profile, now });
  if (!result.ok) throw new Error(result.error);
  expect(result.value.path).toBe("SKILL.md");
  expect(result.value.mediaType).toBe("text/markdown");
  const content = result.value.content;
  expect(content.charCodeAt(0)).not.toBe(0xfeff);
  const header = content.match(/^---\n([\s\S]*?)\n---\n/)![1]!;
  // The fixed header contains only JSON-quoted YAML string scalars.
  const parsed = Object.fromEntries(
    header.split("\n").map((line) => {
      const colon = line.indexOf(": ");
      return [line.slice(0, colon), JSON.parse(line.slice(colon + 2))];
    }),
  );
  expect(Object.keys(parsed)).toEqual(["name", "description"]);
  expect(parsed.name).toMatch(/^[a-z0-9-]+$/);
  expect(parsed.name).toBe("teacher-context");
  expect(parsed.description).toBe(SKILL_DESCRIPTION);
  expect(header).not.toContain(profile.profileTitle);
  expect(content.match(/^name:/gm)).toHaveLength(1);
  expect(content).not.toContain("document_type:");
  expect(content).toContain(COMMON_USAGE_INSTRUCTIONS);
  for (const principle of SKILL_USAGE_PRINCIPLES)
    expect(content).toContain(`- ${principle}`);
  for (const title of [
    profile.profileTitle,
    ...profile.modules.map((m) => m.title),
  ])
    expect(content).toContain(title);
  const markdown = profileToMarkdown(profile);
  const firstHeaderEnd = markdown.indexOf("\n---\n") + 5;
  expect(content.endsWith(markdown.slice(firstHeaderEnd).trimStart())).toBe(
    true,
  );
  expect(createSkillFile({ profile, now })).toEqual(result);
  expect(profile).toEqual(before);
});
it("preserves privacy and unconfirmed claim warnings in the document body", () => {
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  profile.privacyReview = {
    status: "needs_review",
    items: [
      {
        text: "표현 확인",
        reason: "직접 검토가 필요합니다.",
        suggestedRewrite: "지원 중심으로 정리합니다.",
      },
    ],
  };
  profile.modules[0]!.claims[0]!.confirmedByUser = false;
  const result = createSkillFile({ profile, now });
  if (!result.ok) throw new Error(result.error);
  expect(result.value.content).toContain("**개인정보 경고:**");
  const warnings = profileToMarkdown(profile)
    .split("\n")
    .filter((line) => line.startsWith(">"));
  expect(warnings.length).toBeGreaterThan(1);
  for (const warning of warnings)
    expect(result.value.content).toContain(warning);
});
it("rejects pending reviews and invalid input", () => {
  expect(
    createSkillFile({
      profile: {
        ...FICTIONAL_PROFILES[0]!,
        privacyReview: PENDING_PRIVACY_REVIEW,
      },
      now,
    }),
  ).toEqual({ ok: false, error: "pending_review" });
  for (const profile of [null, {}, { ...FICTIONAL_PROFILES[0]!, modules: [] }])
    expect(createSkillFile({ profile, now })).toEqual({
      ok: false,
      error: "invalid",
    });
});
