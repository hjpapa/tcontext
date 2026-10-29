import { SKILL_FORMAT } from "@/content/skill-format";

export type SkillCheckIssue = {
  rule:
    | "structure"
    | "name"
    | "description"
    | "frontmatter"
    | "body_size"
    | "reference";
  detail: string;
};

export function checkSkillPackage(
  entries: readonly { path: string; content: string }[],
): SkillCheckIssue[] {
  const issues: SkillCheckIssue[] = [];
  const paths = new Set<string>();
  const folders = new Set<string>();
  let unsafePath = false;
  for (const { path } of entries) {
    const segments = path.split("/");
    if (
      segments.length < 2 ||
      /[\\:\u0000]/u.test(path) ||
      segments.some(
        (segment) => !segment || segment === "." || segment === "..",
      ) ||
      paths.has(path)
    )
      unsafePath = true;
    paths.add(path);
    folders.add(segments[0] ?? "");
  }
  const folder = folders.size === 1 ? [...folders][0] : undefined;
  if (unsafePath || !folder || folders.size !== 1)
    issues.push({
      rule: "structure",
      detail:
        "모든 파일은 안전하고 중복 없는 경로로 하나의 최상위 폴더 안에 있어야 합니다.",
    });
  const skill =
    entries.find((entry) => entry.path === `${folder}/SKILL.md`) ??
    entries.find((entry) => entry.path === "SKILL.md");
  if (!skill) {
    issues.push({
      rule: "structure",
      detail: "최상위 skill 폴더에 SKILL.md가 필요합니다.",
    });
    return issues;
  }
  const lines = skill.content.split(/\r?\n/u);
  const closing = lines.findIndex((line, index) => index > 0 && line === "---");
  if (lines[0] !== "---" || closing < 0) {
    issues.push({
      rule: "frontmatter",
      detail: "첫 줄과 머리말을 닫는 줄은 ---여야 합니다.",
    });
    return issues;
  }

  const fields = new Map<string, string>();
  let nestedField: string | null = null;
  for (const line of lines.slice(1, closing)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    // Metadata may contain indented key/value pairs; only top-level keys
    // belong to the frontmatter allowlist.
    if (/^[ \t]/u.test(line) && nestedField === "metadata") continue;
    const field = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/u.exec(line);
    if (!field) {
      issues.push({
        rule: "frontmatter",
        detail: "머리말은 키와 값으로 작성해야 합니다.",
      });
      nestedField = null;
      continue;
    }
    const key = field[1]!;
    const value = field[2]!;
    if (
      !(SKILL_FORMAT.allowedFrontmatterKeys as readonly string[]).includes(key)
    )
      issues.push({
        rule: "frontmatter",
        detail: `허용하지 않는 머리말 키: ${key}`,
      });
    if (fields.has(key))
      issues.push({ rule: "frontmatter", detail: `중복된 머리말 키: ${key}` });
    fields.set(key, value.trim());
    nestedField = key === "metadata" && value.trim() === "" ? key : null;
  }

  const name = fields.get("name") ?? "";
  if (
    name.length > SKILL_FORMAT.nameMaxLength ||
    !SKILL_FORMAT.namePattern.test(name) ||
    (skill.path !== "SKILL.md" && name !== folder)
  )
    issues.push({
      rule: "name",
      detail:
        "name은 1~64자의 소문자·숫자·단일 하이픈으로 쓰고 최상위 폴더 이름과 같아야 합니다.",
    });

  let description: unknown = fields.get("description") ?? "";
  if (typeof description === "string" && /^["']/u.test(description)) {
    try {
      description = JSON.parse(description);
    } catch {
      description = null;
    }
  }
  if (
    typeof description !== "string" ||
    description.length < 1 ||
    description.length > SKILL_FORMAT.descriptionMaxLength
  )
    issues.push({
      rule: "description",
      detail: "description은 1~1024자의 문자열이어야 합니다.",
    });

  // Keep the original body characters, including the first blank line,
  // while accepting both common line-ending styles in the header.
  let bodyStart = 0;
  for (let index = 0; index <= closing; index++) {
    const end = skill.content.indexOf("\n", bodyStart);
    bodyStart = end < 0 ? skill.content.length : end + 1;
  }
  const body = skill.content.slice(bodyStart);
  if (
    body.split(/\r?\n/u).length > SKILL_FORMAT.bodyMaxLines ||
    body.length > SKILL_FORMAT.bodyMaxCharacters
  )
    issues.push({
      rule: "body_size",
      detail: "머리말 아래 본문은 500줄과 8,000자 이내여야 합니다.",
    });

  const references = new Set(
    Array.from(
      body.matchAll(/\breferences\/[^\s`"'<>()[\]{}]*/gu),
      (match) => match[0],
    ),
  );
  for (const reference of references) {
    const parts = reference.split("/");
    if (
      parts.length !== 2 ||
      !parts[1] ||
      parts[1] === "." ||
      parts[1] === ".." ||
      /[\\:\u0000]/u.test(reference) ||
      !paths.has(`${folder}/${reference}`)
    )
      issues.push({
        rule: "reference",
        detail: `참고 경로는 패키지의 references 바로 아래 파일이어야 합니다: ${reference}`,
      });
  }
  return issues;
}
