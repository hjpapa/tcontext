// @vitest-environment node
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const self = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const pattern = /\b(?:ChatGPT|Gemini|Claude|Gems?|GPTs)\b/i;
function files(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? files(path)
      : /\.tsx?$/.test(path) && path !== self
        ? [path]
        : [];
  });
}
it("keeps core sources platform neutral", () => {
  const targets = [
    "src/types",
    "src/lib/export",
    "src/lib/storage",
    "src/lib/profile",
  ].flatMap((dir) => files(resolve(root, dir)));
  expect(targets).toContain(resolve(root, "src/types/profile.ts"));
  const matches = targets.flatMap((path) =>
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .flatMap((line, index) =>
        pattern.test(line) ? [`${relative(root, path)}:${index + 1}`] : [],
      ),
  );
  expect(matches, matches.join("\n")).toEqual([]);
});
it("checks the guard pattern itself", () => {
  for (const value of [
    "ChatGPT에 등록",
    "gemini",
    "Claude 프로젝트",
    "새 Gem",
    "GPTs",
  ])
    expect(pattern.test(value)).toBe(true);
  for (const value of ["generate", "agent", "engine", "gemstone"])
    expect(pattern.test(value)).toBe(false);
});
