// @vitest-environment node
import { expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  COMMON_USAGE_INSTRUCTIONS,
  SKILL_USAGE_PRINCIPLES,
  CHAT_USAGE_PRINCIPLES,
} from "@/content/usage-instructions";
import { PENDING_PRIVACY_REVIEW } from "@/types/profile";
import {
  createSkillPackageFile,
  createUsageInstructionsFile,
  SKILL_DESCRIPTION,
} from "./skill";
import { profileToMarkdown } from "./profile-to-markdown";
import { readStoredZip } from "./zip.test-helper";
const now = "2026-10-25T12:00:00.000Z";
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
function header(content: string) {
  return Object.fromEntries(
    content
      .match(/^---\n([\s\S]*?)\n---\n/)![1]!
      .split("\n")
      .map((line) => {
        const colon = line.indexOf(": ");
        const key = line.slice(0, colon);
        const value = line.slice(colon + 2);
        return [key, key === "name" ? value : JSON.parse(value)];
      }),
  );
}
it("exports exactly two files with fixed instructions and unchanged canonical document bytes", () => {
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  const before = structuredClone(profile);
  const result = createSkillPackageFile({ profile, now });
  if (!result.ok) throw new Error(result.error);
  expect(result.value.path).toBe("teacher-context.zip");
  expect(result.value.mediaType).toBe("application/zip");
  const entries = readStoredZip(result.value.content);
  expect(entries.map((e) => e.path)).toEqual([
    "teacher-context/SKILL.md",
    "teacher-context/references/teacher-profile.md",
  ]);
  const instructions = decode(entries[0]!.content);
  expect(entries[0]!.content.slice(0, 3)).not.toEqual(
    new Uint8Array([239, 187, 191]),
  );
  const parsed = header(instructions);
  expect(Object.keys(parsed)).toEqual(["name", "description"]);
  expect(parsed.name).toMatch(/^[a-z0-9-]+$/);
  expect(instructions).toMatch(/^name: teacher-context$/m);
  expect(parsed.name).toBe(entries[0]!.path.split("/")[0]);
  expect(parsed.description).toBe(SKILL_DESCRIPTION);
  expect(instructions.match(/^---$/gm)).toHaveLength(2);
  expect(instructions).not.toContain(profile.profileTitle);
  expect(instructions).toContain("`references/teacher-profile.md`");
  expect(instructions).toContain(
    "# 교사 컨텍스트 사용 지침\n\n이 skill을 사용할 때는 답하기 전에 반드시 참고 파일 `references/teacher-profile.md` 전체를 먼저 읽으세요. 교사 컨텍스트는 이 파일에만 있습니다. 파일을 읽지 못했다면 그 사실을 사용자에게 알리고, 교사 프로파일 문서를 대화에 첨부해 달라고 요청하세요.",
  );
  expect(instructions).toContain(COMMON_USAGE_INSTRUCTIONS);
  for (const principle of SKILL_USAGE_PRINCIPLES)
    expect(instructions).toContain(`- ${principle}`);
  expect(entries[1]!.content).toEqual(
    new TextEncoder().encode(profileToMarkdown(profile)),
  );
  expect(createSkillPackageFile({ profile, now })).toEqual(result);
  expect(profile).toEqual(before);
});
it("preserves privacy and unconfirmed claim warnings in the reference file", () => {
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
  const result = createSkillPackageFile({ profile, now });
  if (!result.ok) throw new Error(result.error);
  const reference = decode(readStoredZip(result.value.content)[1]!.content);
  expect(reference).toBe(profileToMarkdown(profile));
  expect(reference).toContain("**개인정보 경고:**");
  const warnings = profileToMarkdown(profile)
    .split("\n")
    .filter((line) => line.startsWith(">"));
  expect(warnings.length).toBeGreaterThan(1);
  for (const warning of warnings) expect(reference).toContain(warning);
});
it("rejects pending reviews, invalid input and invalid timestamps", () => {
  expect(
    createSkillPackageFile({
      profile: {
        ...FICTIONAL_PROFILES[0]!,
        privacyReview: PENDING_PRIVACY_REVIEW,
      },
      now,
    }),
  ).toEqual({ ok: false, error: "pending_review" });
  for (const profile of [null, {}, { ...FICTIONAL_PROFILES[0]!, modules: [] }])
    expect(createSkillPackageFile({ profile, now })).toEqual({
      ok: false,
      error: "invalid",
    });
  expect(
    createSkillPackageFile({ profile: FICTIONAL_PROFILES[0], now: "invalid" }),
  ).toEqual({ ok: false, error: "invalid" });
});
it("exports deterministic standalone instructions without a teacher profile", () => {
  const file = createUsageInstructionsFile();
  expect(file.path).toBe("SKILL.md");
  expect(file.mediaType).toBe("text/markdown");
  expect(header(file.content).name).toBe("teacher-context-guide");
  expect(header(file.content).name).toMatch(/^[a-z0-9-]+$/);
  expect(file.content).toMatch(/^name: teacher-context-guide$/m);
  expect(header(file.content).description).toBe(
    "대화에 첨부한 교사 프로파일 컨텍스트 문서를 함께 사용하기 위한 활용 지침입니다. 교육 관련 요청에서 참고합니다.",
  );
  expect(file.content.match(/^---$/gm)).toHaveLength(2);
  expect(file.content.charCodeAt(0)).not.toBe(0xfeff);
  expect(file.content).toContain(COMMON_USAGE_INSTRUCTIONS);
  expect(file.content).toContain(
    "문서가 첨부되어 있지 않으면 먼저 첨부를 요청하세요.",
  );
  for (const principle of CHAT_USAGE_PRINCIPLES)
    expect(file.content).toContain(`- ${principle}`);
  for (const profile of FICTIONAL_PROFILES)
    expect(file.content).not.toContain(profile.profileTitle);
  expect(file.content).not.toContain("references/teacher-profile.md");
  expect(createUsageInstructionsFile()).toEqual(file);
});
