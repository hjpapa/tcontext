import { z } from "zod";

export const PRIVACY_REVIEW_CATEGORIES = [
  "person_name",
  "government_id",
  "contact",
  "precise_location",
  "specific_school_or_class",
  "identifiable_sensitive_context",
  "combination_risk",
] as const;

export const privacyReviewCandidateSchema = z
  .object({
    path: z.string().trim().min(1).max(300),
    category: z.enum(PRIVACY_REVIEW_CATEGORIES),
    text: z.string().trim().min(1).max(4_000),
    reason: z.string().trim().min(1).max(500),
    suggestedRewrite: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const privacyReviewCandidatesOutputSchema = z
  .object({
    items: z.array(privacyReviewCandidateSchema).max(50),
  })
  .strict();

export type PrivacyReviewCandidate = z.infer<
  typeof privacyReviewCandidateSchema
>;
