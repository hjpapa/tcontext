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

/**
 * The model returns only the field path, never the original text. The server
 * looks the text up from the fields it sent, so a long or numerous candidate
 * list cannot exhaust the output budget by echoing the document back.
 */
export const privacyReviewCandidateSchema = z
  .object({
    path: z.string().trim().min(1).max(300),
    category: z.enum(PRIVACY_REVIEW_CATEGORIES),
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
