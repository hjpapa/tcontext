import { z } from "zod";

import {
  CONTROLLED_TAGS,
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

export const profileGenerationOutputSchema = z
  .object({
    profile: teacherContextProfileOutputSchema,
    suggestedTags: z.array(suggestedTagSchema).max(30),
  })
  .strict();

export const profileRefineOutputSchema = z
  .object({
    profile: teacherContextProfileOutputSchema,
  })
  .strict();

export type SuggestedTag = z.infer<typeof suggestedTagSchema>;
