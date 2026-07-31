import { z } from "zod";

import { teacherRoleSchema } from "@/types/interview";
import {
  profileModuleIdSchema,
  schoolLevelSchema,
  teacherContextProfileSchema,
} from "@/types/profile";
import { profileContributionSchema } from "@/types/submission";

const nonBlank = z.string().trim().min(1);
const answerText = z.string().trim().min(1).max(4_000);

export const interviewExchangeSchema = z
  .object({
    questionId: nonBlank.max(120),
    moduleId: profileModuleIdSchema,
    question: nonBlank.max(1_000),
    answer: answerText,
  })
  .strict();

export const followUpRequestSchema = z
  .object({
    schoolLevel: schoolLevelSchema,
    role: teacherRoleSchema,
    current: interviewExchangeSchema,
    previousAnswers: z.array(interviewExchangeSchema).max(40).default([]),
    followUpCount: z.number().int().min(0).max(4),
  })
  .strict();

export const profileGenerateRequestSchema = z
  .object({
    schoolLevel: schoolLevelSchema,
    role: teacherRoleSchema,
    answers: z.array(interviewExchangeSchema).min(1).max(40),
  })
  .strict();

export const profileRefineRequestSchema = z
  .object({
    profile: teacherContextProfileSchema,
    instruction: nonBlank.max(2_000),
    moduleId: profileModuleIdSchema.optional(),
    editableClaimIds: z.array(nonBlank.max(120)).max(100).default([]),
  })
  .strict();

export const privacyReviewRequestSchema = z
  .object({
    profile: teacherContextProfileSchema,
  })
  .strict();

export const submissionCreateRequestSchema = profileContributionSchema
  .omit({ consentedAt: true })
  .extend({
    consentAccepted: z.boolean(),
  })
  .strict();

export const submissionDeleteRequestSchema = z
  .object({
    submissionId: z.uuid(),
    deletionToken: z.string().trim().min(32).max(256),
  })
  .strict();
