import { z } from "zod";

export const followUpDecisionSchema = z
  .object({
    needed: z.boolean(),
    question: z
      .object({
        prompt: z.string().trim().min(1).max(300),
        intent: z.string().trim().min(1).max(300),
        example: z.string().trim().min(1).max(300),
        privacyHint: z.string().trim().min(1).max(300),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.needed !== (decision.question !== null)) {
      context.addIssue({
        code: "custom",
        message: "needed와 question 값이 일치해야 합니다.",
        path: ["question"],
      });
    }
  });

export type FollowUpDecision = z.infer<typeof followUpDecisionSchema>;
