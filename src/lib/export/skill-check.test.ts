// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SKILL_FORMAT } from "@/content/skill-format";
import { VARIANT_FIXTURES } from "./profile-variants.test-fixtures";
import { createSkillPackageFile, createUsageInstructionsFile } from "./skill";
import { checkSkillPackage, type SkillCheckIssue } from "./skill-check";
import { readStoredZip } from "./zip.test-helper";

const folder = "teacher-context";
function document({
  name = folder,
  description = JSON.stringify("수업 설계에서 교사 맥락을 적용합니다."),
  extra = "",
  body = "# 사용\n`references/teacher-profile.md`를 읽으세요.",
}: {
  name?: string;
  description?: string;
  extra?: string;
  body?: string;
} = {}) {
  return `---\nname: ${name}\ndescription: ${description}\n${extra}---\n${body}`;
}
function entries(content = document(), root = folder) {
  return [
    { path: `${root}/SKILL.md`, content },
    { path: `${root}/references/teacher-profile.md`, content: "# 참고 문서" },
  ];
}
function expectRule(
  input: ReturnType<typeof entries>,
  rule: SkillCheckIssue["rule"],
) {
  expect(checkSkillPackage(input).map((issue) => issue.rule)).toContain(rule);
}

describe("raw entries", () => {
  it("accepts safe ordinary paths and backtick or link references without mutating input", () => {
    const input = entries(
      document({
        body: "`references/teacher-profile.md`\n[참고](references/teacher-profile.md)",
      }),
    );
    const before = structuredClone(input);
    expect(checkSkillPackage(input)).toEqual([]);
    expect(checkSkillPackage(input)).toEqual([]);
    expect(input).toEqual(before);
  });

  it("accepts the exact name, description, body-line and body-character boundaries", () => {
    const name = "a".repeat(64);
    expect(
      checkSkillPackage(
        entries(
          document({ name, description: JSON.stringify("가".repeat(1024)) }),
          name,
        ),
      ),
    ).toEqual([]);
    expect(
      checkSkillPackage(
        entries(
          document({
            body: Array.from({ length: 500 }, () => "한 줄").join("\n"),
          }),
        ),
      ),
    ).toEqual([]);
    expect(
      checkSkillPackage(entries(document({ body: "가".repeat(8000) }))),
    ).toEqual([]);
  });

  it("measures decoded JSON descriptions and ignores frontmatter characters when sizing the body", () => {
    expect(
      checkSkillPackage(
        entries(
          document({
            description: JSON.stringify('"'.repeat(1024)),
            body: "가".repeat(8000),
          }),
        ),
      ),
    ).toEqual([]);
    expectRule(
      entries(document({ description: JSON.stringify("가".repeat(1025)) })),
      "description",
    );
  });

  it.each([
    "Teacher-context",
    "teacher--context",
    "a".repeat(65),
    "-teacher",
    "teacher-",
    "",
  ])("rejects invalid names: %s", (name) =>
    expectRule(entries(document({ name })), "name"),
  );
  it("requires a name matching the parent folder", () => {
    expectRule(entries(document({ name: "another-skill" })), "name");
  });

  it.each([
    "",
    '""',
    '"unterminated',
    "'not JSON quoted'",
    JSON.stringify("x".repeat(1025)),
  ])("rejects empty, malformed or oversized descriptions: %s", (description) =>
    expectRule(entries(document({ description })), "description"),
  );

  it("requires name and description fields", () => {
    expectRule(entries(document().replace(/^name:.*\n/mu, "")), "name");
    expectRule(
      entries(document().replace(/^description:.*\n/mu, "")),
      "description",
    );
  });

  it("accepts allowed optional keys and indented metadata without treating metadata keys as frontmatter keys", () => {
    expect(
      checkSkillPackage(
        entries(
          document({
            extra:
              "license: MIT\ncompatibility: Text files\nmetadata:\n  author: anonymous\nallowed-tools: Read\n",
          }),
        ),
      ),
    ).toEqual([]);
  });

  it.each([
    ["missing first delimiter", document().slice(4)],
    ["missing closing delimiter", document().replace("\n---\n#", "\n#")],
    ["unsupported key", document({ extra: "unknown-key: value\n" })],
    ["duplicate name", document({ extra: `name: ${folder}\n` })],
    [
      "duplicate optional key",
      document({ extra: "license: MIT\nlicense: BSD\n" }),
    ],
    ["malformed field", document({ extra: "invalid field\n" })],
  ])("rejects invalid frontmatter: %s", (_, content) => {
    expectRule(entries(content), "frontmatter");
  });

  it("rejects 501 body lines or 8,001 characters and counts the first blank body line", () => {
    expectRule(
      entries(
        document({ body: Array.from({ length: 501 }, () => "x").join("\n") }),
      ),
      "body_size",
    );
    expectRule(entries(document({ body: "x".repeat(8001) })), "body_size");
    expectRule(
      entries(document({ body: `\n${"x".repeat(8000)}` })),
      "body_size",
    );
  });

  it("handles CRLF frontmatter while retaining original body characters", () => {
    const content = document({ body: "설명" }).replaceAll("\n", "\r\n");
    expect(checkSkillPackage(entries(content))).toEqual([]);
  });

  it("requires one top-level folder containing SKILL.md", () => {
    expectRule([], "structure");
    expectRule([{ path: "SKILL.md", content: document() }], "structure");
    expectRule(entries().slice(1), "structure");
    expectRule(
      [
        ...entries(),
        { path: "another-skill/example.md", content: "other folder" },
      ],
      "structure",
    );
  });

  it.each([
    `${folder}/../outside.md`,
    `${folder}/./extra.md`,
    `${folder}//extra.md`,
    `${folder}/extra\\file.md`,
    `${folder}/extra:file.md`,
    `/${folder}/extra.md`,
    `${folder}/extra\u0000.md`,
  ])("rejects unsafe archive paths: %s", (path) => {
    expectRule([...entries(), { path, content: "extra" }], "structure");
  });

  it("rejects duplicate archive paths", () => {
    const input = entries();
    expectRule([...input, { ...input[0]! }], "structure");
  });

  it("requires each referenced file to exist, even when several references are listed", () => {
    expectRule(entries().slice(0, 1), "reference");
    expectRule(
      entries(
        document({
          body: "`references/teacher-profile.md`와 `references/missing.md`",
        }),
      ),
      "reference",
    );
  });

  it.each([
    "references/nested/detail.md",
    "references/../outside.md",
    "references/..",
    "references/.",
    "references/",
  ])(
    "rejects references below or outside the immediate reference directory: %s",
    (reference) => {
      const input = entries(document({ body: `참고: \`${reference}\`` }));
      input.push({
        path: `${folder}/${reference}`,
        content: "present but invalid depth",
      });
      expectRule(input, "reference");
    },
  );

  it("keeps the approved specification values in one shared content constant", () => {
    expect(SKILL_FORMAT).toMatchObject({
      source: "https://agentskills.io/specification",
      verifiedAt: "2026-10-30",
      nameMaxLength: 64,
      descriptionMaxLength: 1024,
      allowedFrontmatterKeys: [
        "name",
        "description",
        "license",
        "compatibility",
        "metadata",
        "allowed-tools",
      ],
      bodyMaxLines: 500,
      bodyMaxCharacters: 8000,
    });
  });
});

describe("normal packages", () => {
  it.each(VARIANT_FIXTURES)(
    "accepts the generated package for $name",
    ({ profile }) => {
      const result = createSkillPackageFile({
        profile,
        now: "2026-10-30T00:00:00.000Z",
      });
      if (!result.ok) throw new Error(`Normal package failed: ${result.error}`);
      const input = readStoredZip(result.value.content).map((entry) => ({
        path: entry.path,
        content: new TextDecoder().decode(entry.content),
      }));
      expect(checkSkillPackage(input)).toEqual([]);
    },
  );

  it("accepts standalone instruction content under the name, description and body rules", () => {
    const file = createUsageInstructionsFile();
    const issues = checkSkillPackage([
      { path: file.path, content: file.content },
    ]);
    expect(issues.filter((issue) => issue.rule !== "structure")).toEqual([]);
    expect(issues.some((issue) => issue.rule === "structure")).toBe(true);
  });
});
