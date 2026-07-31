import { runStructuredResponse } from "@/lib/ai/client";
import {
  OPENAI_MODELS,
  OPENAI_REASONING_EFFORT,
  OPENAI_TIMEOUT_MS,
  PROFILE_SCHEMA_VERSION,
  PROMPT_VERSION,
} from "@/lib/ai/models";
import { PROFILE_GENERATION_INSTRUCTIONS } from "@/lib/ai/prompts/profile";
import { PROFILE_REFINE_INSTRUCTIONS } from "@/lib/ai/prompts/refine";
import {
  profileGenerationOutputSchema,
  profileRefineOutputSchema,
  type SuggestedTag,
} from "@/lib/ai/schemas/profile";
import type {
  profileGenerateRequestSchema,
  profileRefineRequestSchema,
} from "@/lib/ai/schemas/requests";
import { ApiError } from "@/lib/security/api-error";
import { localProfilePrivacyReview } from "@/lib/security/privacy-guard";
import {
  teacherContextProfileSchema,
  type ConfirmedTags,
  type ProfileClaim,
  type ProfileModule,
  type TeacherContextProfile,
} from "@/types/profile";
import type { z } from "zod";

type GenerateInput = z.output<typeof profileGenerateRequestSchema>;
type RefineInput = z.output<typeof profileRefineRequestSchema>;

function emptyConfirmedTags(): ConfirmedTags {
  return {
    preferredTeachingMethods: [],
    participationPriorities: [],
    emotionalSupportPriorities: [],
    assessmentPriorities: [],
    environmentConstraints: [],
    aiBoundaries: [],
  };
}

function trustedMetadata(input: {
  schoolLevel: TeacherContextProfile["metadata"]["schoolLevel"];
  role: string;
  modelName: string;
}) {
  return {
    schoolLevel: input.schoolLevel,
    role: input.role,
    generatedAt: new Date().toISOString(),
    schemaVersion: PROFILE_SCHEMA_VERSION,
    modelName: input.modelName,
    promptVersion: PROMPT_VERSION,
  };
}

function deduplicateTags(tags: SuggestedTag[]): SuggestedTag[] {
  const seen = new Set<string>();
  return tags.filter((candidate) => {
    const key = `${candidate.category}:${candidate.tag}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assertEvidenceQuestionIds(
  profile: TeacherContextProfile,
  input: GenerateInput,
): void {
  const answerQuestionIds = new Set(
    input.answers.map((answer) => answer.questionId),
  );
  const hasUnknownEvidenceId = profile.modules.some((module) =>
    module.claims.some((claim) =>
      claim.evidenceQuestionIds.some(
        (questionId) => !answerQuestionIds.has(questionId),
      ),
    ),
  );

  if (hasUnknownEvidenceId) {
    throw new ApiError(
      "ai_invalid_response",
      502,
      "AI가 인터뷰 답변에 없는 근거를 반환했습니다. 다시 시도해 주세요.",
    );
  }
}

export async function generateProfile(input: GenerateInput): Promise<{
  profile: TeacherContextProfile;
  suggestedTags: SuggestedTag[];
}> {
  const output = await runStructuredResponse({
    operation: "profile_generate",
    model: OPENAI_MODELS.profile,
    effort: OPENAI_REASONING_EFFORT.profile,
    instructions: PROFILE_GENERATION_INSTRUCTIONS,
    input: JSON.stringify({
      schoolLevel: input.schoolLevel,
      role: input.role,
      answers: input.answers,
      metadataRequirements: {
        schemaVersion: PROFILE_SCHEMA_VERSION,
        modelName: OPENAI_MODELS.profile,
        promptVersion: PROMPT_VERSION,
      },
    }),
    schema: profileGenerationOutputSchema,
    schemaName: "tcontext_profile_generation",
    maxOutputTokens: 8_000,
    timeoutMs: OPENAI_TIMEOUT_MS.profile,
  });
  assertEvidenceQuestionIds(output.profile, input);

  const draft = teacherContextProfileSchema.parse({
    ...output.profile,
    metadata: trustedMetadata({
      schoolLevel: input.schoolLevel,
      role: input.role,
      modelName: OPENAI_MODELS.profile,
    }),
    confirmedTags: emptyConfirmedTags(),
    modules: output.profile.modules.map((module) => ({
      ...module,
      claims: module.claims.map((claim) => ({
        ...claim,
        confirmedByUser: false,
      })),
    })),
  });

  const profile = teacherContextProfileSchema.parse({
    ...draft,
    privacyReview: localProfilePrivacyReview(draft),
  });

  return {
    profile,
    suggestedTags: deduplicateTags(output.suggestedTags),
  };
}

function preserveClaims(
  original: ProfileModule,
  generated: ProfileModule,
  editableIds: ReadonlySet<string>,
): ProfileModule {
  const generatedById = new Map(
    generated.claims.map((claim) => [claim.id, claim]),
  );

  const claims = original.claims.flatMap((claim): ProfileClaim[] => {
    if (!editableIds.has(claim.id)) {
      return [claim];
    }

    const replacement = generatedById.get(claim.id);
    if (!replacement) {
      return [];
    }
    return [{ ...replacement, id: claim.id, confirmedByUser: false }];
  });

  return {
    id: original.id,
    title: generated.title,
    summary: generated.summary,
    claims,
  };
}

export async function refineProfile(
  input: RefineInput,
): Promise<TeacherContextProfile> {
  const output = await runStructuredResponse({
    operation: "profile_refine",
    model: OPENAI_MODELS.profile,
    effort: OPENAI_REASONING_EFFORT.profile,
    instructions: PROFILE_REFINE_INSTRUCTIONS,
    input: JSON.stringify({
      profile: input.profile,
      instruction: input.instruction,
      moduleId: input.moduleId ?? null,
      editableClaimIds: input.editableClaimIds,
    }),
    schema: profileRefineOutputSchema,
    schemaName: "tcontext_profile_refine",
    maxOutputTokens: 8_000,
    timeoutMs: OPENAI_TIMEOUT_MS.profile,
  });

  const generatedById = new Map(
    output.profile.modules.map((module) => [module.id, module]),
  );
  const editableIds = new Set(input.editableClaimIds);

  const modules = input.profile.modules.map((original) => {
    const generated = generatedById.get(original.id);
    const moduleIsInScope =
      input.moduleId === undefined || original.id === input.moduleId;
    if (!generated || !moduleIsInScope) {
      return original;
    }
    return preserveClaims(original, generated, editableIds);
  });

  const generatedTopLevel =
    input.moduleId === undefined ? output.profile : input.profile;
  const draft = teacherContextProfileSchema.parse({
    ...generatedTopLevel,
    metadata: input.profile.metadata,
    modules,
    confirmedTags: input.profile.confirmedTags,
    privacyReview: {
      status: "needs_review",
      items: [
        {
          text: "수정된 프로파일",
          reason: "수정 후 개인정보 재점검이 필요합니다.",
          suggestedRewrite: "개인정보 재점검을 실행해 주세요.",
        },
      ],
    },
  });

  const localReview = localProfilePrivacyReview(draft);
  return teacherContextProfileSchema.parse({
    ...draft,
    privacyReview:
      localReview.status === "needs_review" ? localReview : draft.privacyReview,
  });
}
