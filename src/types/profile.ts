import { z } from "zod";

export const SCHOOL_LEVELS = [
  "kindergarten",
  "elementary",
  "middle",
  "high",
] as const;

export const schoolLevelSchema = z.enum(SCHOOL_LEVELS);
export type SchoolLevel = z.infer<typeof schoolLevelSchema>;

export const PROFILE_MODULE_IDS = [
  "identity_and_role",
  "educational_philosophy",
  "preferred_teaching",
  "class_context",
  "participation_and_emotion",
  "materials_assessment_feedback",
  "environment_and_ai",
] as const;

export const PROFILE_MODULE_TITLES: Record<ProfileModuleId, string> = {
  identity_and_role: "교사 기본 프로파일과 현재 역할",
  educational_philosophy: "교육관과 학생관",
  preferred_teaching: "선호하는 수업 방식",
  class_context: "현재 학급 또는 수업 집단의 기본 맥락",
  participation_and_emotion: "학생 참여와 정서 지원 원칙",
  materials_assessment_feedback: "수업 자료·평가·피드백과 의사소통",
  environment_and_ai: "현실적인 환경·제약과 디지털·AI 활용",
};

export const evidenceBasisSchema = z.enum([
  "direct",
  "inferred",
  "needs_confirmation",
]);
export type EvidenceBasis = z.infer<typeof evidenceBasisSchema>;

export const profileModuleIdSchema = z.enum(PROFILE_MODULE_IDS);
export type ProfileModuleId = z.infer<typeof profileModuleIdSchema>;

const nonBlankText = z.string().trim().min(1);
const editableText = z.string().trim();
export const machineIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);

export const profileClaimOutputSchema = z
  .object({
    id: machineIdentifierSchema,
    text: nonBlankText,
    basis: evidenceBasisSchema,
    evidenceQuestionIds: z.array(machineIdentifierSchema).min(1),
    confirmedByUser: z.boolean(),
  })
  .strict();

export const profileClaimSchema = profileClaimOutputSchema.superRefine(
  (claim, context) => {
    if (claim.basis === "needs_confirmation" && claim.confirmedByUser) {
      context.addIssue({
        code: "custom",
        message:
          "확인된 문장은 needs_confirmation 대신 direct 또는 inferred여야 합니다.",
        path: ["confirmedByUser"],
      });
    }
  },
);
export type ProfileClaim = z.infer<typeof profileClaimSchema>;

export const profileModuleOutputSchema = z
  .object({
    id: profileModuleIdSchema,
    title: nonBlankText,
    summary: nonBlankText,
    claims: z.array(profileClaimOutputSchema),
  })
  .strict();
export const profileModuleSchema = profileModuleOutputSchema.extend({
  summary: editableText,
  claims: z.array(profileClaimSchema),
});
export type ProfileModule = z.infer<typeof profileModuleSchema>;

export const CONTROLLED_TAGS = {
  preferredTeachingMethods: [
    "direct_instruction",
    "inquiry",
    "discussion",
    "collaboration",
    "project_based",
    "making",
    "experiential",
    "blended",
  ],
  participationPriorities: [
    "questioning",
    "choice",
    "judgment",
    "revision",
    "sharing",
    "peer_feedback",
    "reflection",
  ],
  emotionalSupportPriorities: [
    "psychological_safety",
    "low_risk_participation",
    "small_success_steps",
    "growth_feedback",
    "multiple_expression_modes",
    "predictable_structure",
  ],
  assessmentPriorities: [
    "final_product",
    "learning_process",
    "reasoning",
    "revision",
    "self_reflection",
    "peer_feedback",
    "observation",
  ],
  environmentConstraints: [
    "limited_time",
    "device_gap",
    "unstable_network",
    "large_class",
    "preparation_load",
    "mixed_achievement",
    "attention_transition",
  ],
  aiBoundaries: [
    "no_personal_data",
    "teacher_final_judgment",
    "student_thinking_first",
    "fact_check_required",
    "copyright_review",
    "disclose_ai_use",
  ],
} as const;

export type ControlledTagCategory = keyof typeof CONTROLLED_TAGS;
export type ControlledTag =
  (typeof CONTROLLED_TAGS)[ControlledTagCategory][number];

const confirmedTagsShape = {
  preferredTeachingMethods: z.array(
    z.enum(CONTROLLED_TAGS.preferredTeachingMethods),
  ),
  participationPriorities: z.array(
    z.enum(CONTROLLED_TAGS.participationPriorities),
  ),
  emotionalSupportPriorities: z.array(
    z.enum(CONTROLLED_TAGS.emotionalSupportPriorities),
  ),
  assessmentPriorities: z.array(z.enum(CONTROLLED_TAGS.assessmentPriorities)),
  environmentConstraints: z.array(
    z.enum(CONTROLLED_TAGS.environmentConstraints),
  ),
  aiBoundaries: z.array(z.enum(CONTROLLED_TAGS.aiBoundaries)),
};

export const confirmedTagsInputSchema = z.object(confirmedTagsShape).strict();

export const confirmedTagsSchema = confirmedTagsInputSchema.superRefine(
  (groups, context) => {
    for (const key of Object.keys(CONTROLLED_TAGS) as ControlledTagCategory[]) {
      if (new Set(groups[key]).size !== groups[key].length) {
        context.addIssue({
          code: "custom",
          message: `${key} 태그는 중복될 수 없습니다.`,
          path: [key],
        });
      }
    }
  },
);
export type ConfirmedTags = z.infer<typeof confirmedTagsInputSchema>;

export const tagCandidateSchema = z
  .object({
    category: z.enum(
      Object.keys(CONTROLLED_TAGS) as [
        ControlledTagCategory,
        ...ControlledTagCategory[],
      ],
    ),
    tag: nonBlankText,
    confirmedByUser: z.boolean(),
  })
  .strict();
export type TagCandidate = z.infer<typeof tagCandidateSchema>;

export function confirmedTagsFromCandidates(
  candidates: readonly TagCandidate[],
): ConfirmedTags {
  const groups: Record<ControlledTagCategory, string[]> = {
    preferredTeachingMethods: [],
    participationPriorities: [],
    emotionalSupportPriorities: [],
    assessmentPriorities: [],
    environmentConstraints: [],
    aiBoundaries: [],
  };

  for (const candidate of candidates) {
    if (
      candidate.confirmedByUser &&
      (CONTROLLED_TAGS[candidate.category] as readonly string[]).includes(
        candidate.tag,
      )
    ) {
      if (!groups[candidate.category].includes(candidate.tag)) {
        groups[candidate.category].push(candidate.tag);
      }
    }
  }

  return confirmedTagsSchema.parse(groups);
}

export const privacyReviewItemSchema = z
  .object({
    text: nonBlankText,
    reason: nonBlankText,
    suggestedRewrite: nonBlankText,
  })
  .strict();

export const privacyReviewOutputSchema = z
  .object({
    status: z.enum(["clear", "needs_review"]),
    items: z.array(privacyReviewItemSchema),
  })
  .strict();

export const privacyReviewSchema = privacyReviewOutputSchema.superRefine(
  (review, context) => {
    if (review.status === "clear" && review.items.length > 0) {
      context.addIssue({
        code: "custom",
        message: "clear 상태에는 검토 항목이 없어야 합니다.",
        path: ["items"],
      });
    }
    if (review.status === "needs_review" && review.items.length === 0) {
      context.addIssue({
        code: "custom",
        message: "needs_review 상태에는 한 개 이상의 검토 항목이 필요합니다.",
        path: ["items"],
      });
    }
  },
);
export type PrivacyReview = z.infer<typeof privacyReviewSchema>;

const profileMetadataSchema = z
  .object({
    schoolLevel: schoolLevelSchema,
    role: nonBlankText,
    generatedAt: z.iso.datetime(),
    schemaVersion: nonBlankText,
    modelName: nonBlankText,
    promptVersion: nonBlankText,
  })
  .strict();

export const teacherContextProfileOutputSchema = z
  .object({
    metadata: profileMetadataSchema,
    profileTitle: nonBlankText,
    shortSummary: nonBlankText,
    modules: z
      .array(profileModuleOutputSchema)
      .length(PROFILE_MODULE_IDS.length),
    teachingDesignPrinciples: z.array(nonBlankText),
    classSupportConsiderations: z.array(nonBlankText),
    realisticConstraints: z.array(nonBlankText),
    aiCollaborationInstructions: z.array(nonBlankText),
    confirmedTags: confirmedTagsInputSchema,
    privacyReview: privacyReviewOutputSchema,
  })
  .strict();

const editableTeacherContextProfileSchema =
  teacherContextProfileOutputSchema.extend({
    shortSummary: editableText,
    modules: z.array(profileModuleSchema).length(PROFILE_MODULE_IDS.length),
  });

export const teacherContextProfileSchema =
  editableTeacherContextProfileSchema.superRefine((profile, context) => {
    for (const key of Object.keys(CONTROLLED_TAGS) as ControlledTagCategory[]) {
      if (
        new Set(profile.confirmedTags[key]).size !==
        profile.confirmedTags[key].length
      ) {
        context.addIssue({
          code: "custom",
          message: `${key} 태그는 중복될 수 없습니다.`,
          path: ["confirmedTags", key],
        });
      }
    }

    if (
      profile.privacyReview.status === "clear" &&
      profile.privacyReview.items.length > 0
    ) {
      context.addIssue({
        code: "custom",
        message: "clear 상태에는 검토 항목이 없어야 합니다.",
        path: ["privacyReview", "items"],
      });
    }
    if (
      profile.privacyReview.status === "needs_review" &&
      profile.privacyReview.items.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "needs_review 상태에는 한 개 이상의 검토 항목이 필요합니다.",
        path: ["privacyReview", "items"],
      });
    }

    profile.modules.forEach((module, moduleIndex) => {
      module.claims.forEach((claim, claimIndex) => {
        if (claim.basis === "needs_confirmation" && claim.confirmedByUser) {
          context.addIssue({
            code: "custom",
            message:
              "확인된 문장은 needs_confirmation 대신 direct 또는 inferred여야 합니다.",
            path: [
              "modules",
              moduleIndex,
              "claims",
              claimIndex,
              "confirmedByUser",
            ],
          });
        }
      });
    });

    const moduleIds = profile.modules.map((module) => module.id);
    for (const id of PROFILE_MODULE_IDS) {
      if (moduleIds.filter((candidate) => candidate === id).length !== 1) {
        context.addIssue({
          code: "custom",
          message: `프로파일에는 ${id} 모듈이 정확히 한 번 포함되어야 합니다.`,
          path: ["modules"],
        });
      }
    }

    const claimIds = profile.modules.flatMap((module) =>
      module.claims.map((claim) => claim.id),
    );
    if (new Set(claimIds).size !== claimIds.length) {
      context.addIssue({
        code: "custom",
        message: "claim id는 프로파일 전체에서 고유해야 합니다.",
        path: ["modules"],
      });
    }
  });

export type TeacherContextProfile = z.output<
  typeof teacherContextProfileSchema
>;

export function hasUnresolvedClaims(profile: TeacherContextProfile): boolean {
  return profile.modules.some((module) =>
    module.claims.some(
      (claim) => claim.basis === "needs_confirmation" || !claim.confirmedByUser,
    ),
  );
}
