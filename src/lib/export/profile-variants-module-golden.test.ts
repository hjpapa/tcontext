// @vitest-environment node
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { PROFILE_MODULE_IDS, type ProfileModuleId } from "@/types/profile";
import {
  OPTIONAL_SECTION_IDS,
  profileToModuleMarkdown,
} from "./profile-variants";
import { TEST_AS_OF, VARIANT_FIXTURES } from "./profile-variants.test-fixtures";

const MODULE_OUTPUT_SHA256 =
  "204bc0e3db1bb8bceaf410d82db8dd9f1db217ecce329f347d73c9a3776e305d"; // main @ 3bf12a6

it("preserves the exact module exports from the Phase 3 baseline", () => {
  const selections: readonly (readonly ProfileModuleId[])[] = [
    ["identity_and_role"],
    ["identity_and_role", "class_context", "environment_and_ai"],
    PROFILE_MODULE_IDS,
  ];
  const parts: string[] = [];
  for (const { profile } of VARIANT_FIXTURES) {
    for (const modules of selections) {
      for (const sections of [OPTIONAL_SECTION_IDS, []]) {
        const result = profileToModuleMarkdown(profile, {
          asOf: TEST_AS_OF,
          modules,
          sections,
        });
        parts.push(result.ok ? result.markdown : `error:${result.error}`);
      }
    }
  }
  expect(parts).toHaveLength(48);
  expect(
    createHash("sha256")
      .update(parts.join("\n<<<variant>>>\n"), "utf8")
      .digest("hex"),
  ).toBe(MODULE_OUTPUT_SHA256);
});
