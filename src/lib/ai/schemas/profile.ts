import { z } from "zod";

import {
  CONTROLLED_TAGS,
  PROFILE_MODULE_IDS,
  profileModuleOutputSchema,
  teacherContextProfileOutputSchema,
} from "@/types/profile";

export const suggestedTagSchema = z.discriminatedUnion("category", [
  z
    .object({
      category: z.literal("preferredTeachingMethods"),
      tag: z.enum(CONTROLLED_TAGS.preferredTeachingMethods),
    })
    .strict(),
  z
    .object({
      category: z.literal("participationPriorities"),
      tag: z.enum(CONTROLLED_TAGS.participationPriorities),
    })
    .strict(),
  z
    .object({
      category: z.literal("emotionalSupportPriorities"),
      tag: z.enum(CONTROLLED_TAGS.emotionalSupportPriorities),
    })
    .strict(),
  z
    .object({
      category: z.literal("assessmentPriorities"),
      tag: z.enum(CONTROLLED_TAGS.assessmentPriorities),
    })
    .strict(),
  z
    .object({
      category: z.literal("environmentConstraints"),
      tag: z.enum(CONTROLLED_TAGS.environmentConstraints),
    })
    .strict(),
  z
    .object({
      category: z.literal("aiBoundaries"),
      tag: z.enum(CONTROLLED_TAGS.aiBoundaries),
    })
    .strict(),
]);

const generatedProfileModuleSchema = profileModuleOutputSchema.extend({
  claims: profileModuleOutputSchema.shape.claims.min(1).max(4),
});

const generatedTeacherContextProfileSchema =
  teacherContextProfileOutputSchema.extend({
    modules: z
      .array(generatedProfileModuleSchema)
      .length(PROFILE_MODULE_IDS.length),
    teachingDesignPrinciples:
      teacherContextProfileOutputSchema.shape.teachingDesignPrinciples
        .min(1)
        .max(6),
    classSupportConsiderations:
      teacherContextProfileOutputSchema.shape.classSupportConsiderations
        .min(1)
        .max(6),
    realisticConstraints:
      teacherContextProfileOutputSchema.shape.realisticConstraints
        .min(1)
        .max(5),
    aiCollaborationInstructions:
      teacherContextProfileOutputSchema.shape.aiCollaborationInstructions
        .min(1)
        .max(6),
  });

export const profileGenerationOutputSchema = z
  .object({
    profile: generatedTeacherContextProfileSchema,
    suggestedTags: z.array(suggestedTagSchema).max(30),
  })
  .strict();

export const profileRefineOutputSchema = z
  .object({
    profile: teacherContextProfileOutputSchema,
  })
  .strict();

export const profileModuleRefineOutputSchema = z
  .object({
    module: profileModuleOutputSchema,
  })
  .strict();

export type SuggestedTag = z.infer<typeof suggestedTagSchema>;
