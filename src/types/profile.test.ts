import { describe, expect, it } from "vitest";

import { FICTIONAL_PROFILES } from "@/content/examples";
import { buildInterviewQuestions } from "@/lib/interview/router";
import { teacherRoleSchema } from "@/types/interview";
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

  it("keeps legacy profiles valid while accepting only controlled teaching subjects", () => {
    const legacy = fictionalProfile(2);
    delete legacy.metadata.teachingSubject;
    expect(legacy.metadata.teachingSubject).toBeUndefined();
    expect(teacherContextProfileSchema.safeParse(legacy).success).toBe(true);

    legacy.metadata.teachingSubject = "science";
    expect(teacherContextProfileSchema.safeParse(legacy).success).toBe(true);

    const raw = legacy as unknown as { metadata: Record<string, unknown> };
    raw.metadata.teachingSubject = "직접 입력한 교과";
    expect(teacherContextProfileSchema.safeParse(raw).success).toBe(false);
  });

  it("uses evidence question IDs that exist in each fictional interview path", () => {
    const commonEvidenceByModule = {
      identity_and_role: "common-role-focus",
      educational_philosophy: "common-educational-principle",
      preferred_teaching: "common-lesson-flow",
      class_context: "common-class-support",
      materials_assessment_feedback: "common-assessment-feedback",
      environment_and_ai: "common-ai-boundaries",
    } as const;
    const schoolEvidenceByLevel = {
      kindergarten: "kindergarten-transition",
      elementary: "elementary-group-sharing",
      middle: "middle-autonomy-participation",
      high: "high-assessment-pressure",
    } as const;

    for (const profile of FICTIONAL_PROFILES) {
      const questionIds = new Set(
        buildInterviewQuestions({
          schoolLevel: profile.metadata.schoolLevel,
          role: teacherRoleSchema.parse(profile.metadata.role),
        }).map((question) => question.id),
      );

      for (const profileModule of profile.modules) {
        for (const [claimIndex, claim] of profileModule.claims.entries()) {
          const expectedEvidenceId =
            profileModule.id === "participation_and_emotion"
              ? schoolEvidenceByLevel[profile.metadata.schoolLevel]
              : profileModule.id === "preferred_teaching" && claimIndex > 0
                ? "common-adaptive-tendency"
                : commonEvidenceByModule[profileModule.id];
          expect(claim.evidenceQuestionIds).toEqual([expectedEvidenceId]);
          expect(questionIds.has(expectedEvidenceId)).toBe(true);
        }
      }
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


describe("local profile shared validation", () => {
  it("recognizes only the exact pending review marker", async () => {
    const {
      isPendingPrivacyReview,
      PENDING_PRIVACY_REVIEW,
      UNVERIFIED_PRIVACY_REVIEW,
    } = await import("./profile");
    expect(isPendingPrivacyReview(PENDING_PRIVACY_REVIEW)).toBe(true);
    expect(isPendingPrivacyReview(UNVERIFIED_PRIVACY_REVIEW)).toBe(false);
    expect(isPendingPrivacyReview({ status: "clear", items: [] })).toBe(false);
    for (const key of ["text", "reason", "suggestedRewrite"] as const) {
      const review = structuredClone(PENDING_PRIVACY_REVIEW);
      review.items[0]![key] += "변경";
      expect(isPendingPrivacyReview(review)).toBe(false);
    }
  });
  it("preserves refinement messages, paths and ordering", async () => {
    const { refineTeacherContextProfile } = await import("./profile");
    const { z } = await import("zod");
    const p = fictionalProfile();
    p.confirmedTags.aiBoundaries = ["no_personal_data", "no_personal_data"];
    p.modules[0]!.claims[0]!.basis = "needs_confirmation";
    const missing = p.modules.pop()!.id;
    const result = z
      .custom<typeof p>()
      .superRefine(refineTeacherContextProfile)
      .safeParse(p);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toEqual([
        {
          code: "custom",
          message: "aiBoundaries 태그는 중복될 수 없습니다.",
          path: ["confirmedTags", "aiBoundaries"],
        },
        {
          code: "custom",
          message:
            "확인된 문장은 needs_confirmation 대신 direct 또는 inferred여야 합니다.",
          path: ["modules", 0, "claims", 0, "confirmedByUser"],
        },
        {
          code: "custom",
          message: `프로파일에는 ${missing} 모듈이 정확히 한 번 포함되어야 합니다.`,
          path: ["modules"],
        },
      ]);
  });
});
