import { describe, expect, it } from "vitest";

import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  confirmedTagsFromCandidates,
  confirmedTagsInputSchema,
  teacherContextProfileOutputSchema,
  teacherContextProfileSchema,
} from "./profile";

function fictionalProfile(index = 0) {
  const profile = FICTIONAL_PROFILES[index];
  if (!profile) throw new Error(`Missing fictional profile at index ${index}`);
  return structuredClone(profile);
}

describe("teacherContextProfileSchema", () => {
  it("validates all four fictional school-level profiles", () => {
    expect(FICTIONAL_PROFILES).toHaveLength(4);
    for (const profile of FICTIONAL_PROFILES) {
      expect(teacherContextProfileSchema.safeParse(profile).success).toBe(true);
    }
  });

  it("requires every canonical module exactly once", () => {
    const profile = fictionalProfile();
    const firstModule = profile.modules[0];
    if (!firstModule) throw new Error("Missing fictional module");
    profile.modules[6] = structuredClone(firstModule);
    expect(teacherContextProfileSchema.safeParse(profile).success).toBe(false);
  });

  it("rejects a confirmed claim that is still marked needs_confirmation", () => {
    const profile = fictionalProfile();
    const claim = profile.modules[0]?.claims[0];
    if (!claim) throw new Error("Missing fictional claim");
    claim.basis = "needs_confirmation";
    claim.confirmedByUser = true;
    expect(teacherContextProfileSchema.safeParse(profile).success).toBe(false);
  });

  it("exposes transform-free schemas for structured AI output", () => {
    expect(
      teacherContextProfileOutputSchema.safeParse(fictionalProfile()).success,
    ).toBe(true);
    expect(
      confirmedTagsInputSchema.safeParse(fictionalProfile().confirmedTags)
        .success,
    ).toBe(true);
  });

  it("allows a teacher to delete generated summary sentences after AI output", () => {
    const profile = fictionalProfile();
    const firstModule = profile.modules[0];
    if (!firstModule) throw new Error("Missing fictional module");

    profile.shortSummary = "";
    firstModule.summary = "";

    expect(teacherContextProfileSchema.safeParse(profile).success).toBe(true);
    expect(teacherContextProfileOutputSchema.safeParse(profile).success).toBe(
      false,
    );
  });
});

describe("confirmedTagsFromCandidates", () => {
  it("keeps only user-confirmed controlled tags and removes duplicates", () => {
    const result = confirmedTagsFromCandidates([
      {
        category: "preferredTeachingMethods",
        tag: "inquiry",
        confirmedByUser: true,
      },
      {
        category: "preferredTeachingMethods",
        tag: "inquiry",
        confirmedByUser: true,
      },
      {
        category: "preferredTeachingMethods",
        tag: "project_based",
        confirmedByUser: false,
      },
      {
        category: "preferredTeachingMethods",
        tag: "personality_type_x",
        confirmedByUser: true,
      },
    ]);

    expect(result.preferredTeachingMethods).toEqual(["inquiry"]);
  });

  it("rejects uncontrolled tags at the canonical profile boundary", () => {
    const profile = fictionalProfile();
    profile.confirmedTags.aiBoundaries = ["teacher_final_judgment"];
    const raw = profile as unknown as Record<string, unknown>;
    (
      (raw.confirmedTags as Record<string, unknown>)
        .preferredTeachingMethods as string[]
    ).push("teacher_personality_a");
    expect(teacherContextProfileSchema.safeParse(raw).success).toBe(false);
  });
});
