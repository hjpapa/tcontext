// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
it("keeps named platform identifiers out of generic guide renderers and routes", () => {
  for (const path of [
    "src/components/ai-guide/platform-guide-view.tsx",
    "src/components/ai-guide/guide-artifacts.tsx",
    "src/app/ai-guide/page.tsx",
    "src/app/ai-guide/[platform]/page.tsx",
  ]) {
    const source = readFileSync(resolve(path), "utf8");
    expect(source, path).not.toMatch(
      /["'`](?:chatgpt|gemini|claude)(?:-[a-z-]+)?["'`]/i,
    );
  }
});
