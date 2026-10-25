import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { PLATFORM_GUIDES } from "./index";
import { platformGuidesSchema, type PlatformGuide } from "./schema";
import { COMMON_USAGE_INSTRUCTIONS } from "../usage-instructions";

it("requires package export for skills and identical chat attachment artifacts", () => {
  const methods = PLATFORM_GUIDES.flatMap((guide) => guide.methods);
  expect(
    methods.find((method) => method.id === "gemini-skill")!.requiredArtifacts,
  ).toEqual(["skill-package"]);
  for (const method of methods.filter((method) =>
    method.id.endsWith("-chat-attachment"),
  )) {
    expect(method.requiredArtifacts).toEqual([
      "usage-instructions",
      "profile-markdown",
    ]);
    expect(method.steps).toHaveLength(3);
    expect(method.steps[0]!.body).toContain("지침 SKILL.md");
    expect(method.steps[1]!.body).toContain("대화마다");
  }
  const data = structuredClone(PLATFORM_GUIDES);
  const invalid = {
    ...data[0],
    methods: [{ ...data[0]!.methods[0], requiredArtifacts: ["skill-file"] }],
  };
  expect(platformGuidesSchema.safeParse([invalid]).success).toBe(false);
});

it("validates approved platform methods, dates, links and available artifacts", () => {
  expect(platformGuidesSchema.safeParse(PLATFORM_GUIDES).success).toBe(true);
  expect(
    PLATFORM_GUIDES.flatMap((g) => g.methods).map((m) => [
      m.id,
      m.status,
      m.verifiedAt,
    ]),
  ).toEqual([
    ["chatgpt-project", "recommended", "2026-10-25"],
    ["chatgpt-chat-attachment", "available", "2026-10-25"],
    ["gemini-skill", "recommended", "2026-10-25"],
    ["gemini-gem", "transitioning", "2026-10-25"],
    ["gemini-chat-attachment", "available", "2026-10-25"],
    ["claude-project", "recommended", "2026-10-25"],
    ["claude-chat-attachment", "available", "2026-10-25"],
  ]);
  const facts = readFileSync(resolve("docs/codex/platform-facts.md"), "utf8");
  for (const method of PLATFORM_GUIDES.flatMap((g) => g.methods))
    expect(facts).toContain(method.officialUrl);
});
it.each([
  [
    "duplicate method ids",
    (g: PlatformGuide[]) => {
      g[1]!.methods[0]!.id = g[0]!.methods[0]!.id;
    },
  ],
  [
    "missing fallback",
    (g: PlatformGuide[]) => {
      g[0]!.fallbackMethodId = "missing";
    },
  ],
  [
    "missing replacement",
    (g: PlatformGuide[]) => {
      g[0]!.methods[0]!.replaces = "missing";
    },
  ],
  [
    "all retired",
    (g: PlatformGuide[]) => {
      g[0]!.methods.forEach((m) => {
        m.status = "retired";
      });
    },
  ],
  [
    "insecure URL",
    (g: PlatformGuide[]) => {
      g[0]!.methods[0]!.officialUrl = "http://example.com";
    },
  ],
  [
    "invalid date",
    (g: PlatformGuide[]) => {
      g[0]!.methods[0]!.verifiedAt = "2026-02-30";
    },
  ],
  [
    "duplicate artifacts",
    (g: PlatformGuide[]) => {
      g[0]!.methods[0]!.requiredArtifacts = ["skill-package", "skill-package"];
    },
  ],
] as const)("rejects %s", (_name, mutate) => {
  const data = structuredClone(PLATFORM_GUIDES);
  mutate(data);
  expect(platformGuidesSchema.safeParse(data).success).toBe(false);
});
it("keeps common instructions identical to the approved source", () => {
  const instruction = readFileSync(resolve("instruct.md"), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  expect(
    instruction.split("### 4.6.")[1]!.match(/```text\n([\s\S]*?)\n```/)![1],
  ).toBe(COMMON_USAGE_INSTRUCTIONS);
});
