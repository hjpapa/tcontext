import { z } from "zod";

import {
  confirmedTagsSchema,
  privacyReviewSchema,
  teacherContextProfileSchema,
} from "@/types/profile";

/**
 * The only profile payload that may be contributed. Raw interview answers are
 * deliberately absent from this boundary type.
 */
export const profileContributionSchema = z
  .object({
    profile: teacherContextProfileSchema,
    profileMarkdown: z.string().min(1),
    confirmedTags: confirmedTagsSchema,
    privacyReview: privacyReviewSchema,
    consentVersion: z.string().min(1),
    consentedAt: z.iso.datetime(),
  })
  .strict();

export type ProfileContribution = z.output<typeof profileContributionSchema>;
