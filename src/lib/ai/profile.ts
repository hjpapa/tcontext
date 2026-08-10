import { runStructuredResponse } from "@/lib/ai/client";
import {
  OPENAI_MODELS,
  OPENAI_REASONING_EFFORT,
  OPENAI_TIMEOUT_MS,
  PROFILE_SCHEMA_VERSION,
  PROMPT_VERSION,
} from "@/lib/ai/models";
import { PROFILE_GENERATION_INSTRUCTIONS } from "@/lib/ai/prompts/profile";
import {
  PROFILE_MODULE_REFINE_INSTRUCTIONS,
  PROFILE_REFINE_INSTRUCTIONS,
} from "@/lib/ai/prompts/refine";
import {
  profileGenerationOutputSchema,
  profileModuleRefineOutputSchema,
  profileRefineOutputSchema,
  type SuggestedTag,
} from "@/lib/ai/schemas/profile";
import type {
  profileGenerateRequestSchema,
  profileRefineRequestSchema,
} from "@/lib/ai/schemas/requests";
import { ApiError } from "@/lib/security/api-error";
import {
  localProfilePrivacyReview,
  prepareProfileForAIRefinement,
} from "@/lib/security/privacy-guard";
import {
  teacherContextProfileSchema,
  type ConfirmedTags,
  type EvidenceBasis,
  type ProfileClaim,
  type ProfileModule,
  type TeacherContextProfile,
} from "@/types/profile";
import type { z } from "zod";

type GenerateInput = z.output<typeof profileGenerateRequestSchema>;
type RefineInput = z.output<typeof profileRefineRequestSchema>;

const PROFILE_GENERATION_OUTPUT_TOKENS = 8_000;
const PROFILE_GENERATION_RETRY_OUTPUT_TOKENS = 16_000;
const PROFILE_REFINE_OUTPUT_TOKENS = 8_000;
const PROFILE_REFINE_RETRY_OUTPUT_TOKENS = 16_000;
const MODULE_REFINE_OUTPUT_TOKENS = 3_000;
const MODULE_REFINE_RETRY_OUTPUT_TOKENS = 6_000;

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

function parseAIProfile(value: unknown): TeacherContextProfile {
  const result = teacherContextProfileSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(
      "ai_invalid_response",
      502,
      "AI가 검증 가능한 프로필을 생성하지 못했습니다. 다시 시도해 주세요.",
      { cause: result.error },
    );
  }
  return result.data;
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
    maxOutputTokens: PROFILE_GENERATION_OUTPUT_TOKENS,
    retryMaxOutputTokens: PROFILE_GENERATION_RETRY_OUTPUT_TOKENS,
    timeoutMs: OPENAI_TIMEOUT_MS.profile,
  });
  assertEvidenceQuestionIds(output.profile, input);

  const draft = parseAIProfile({
    ...output.profile,
    metadata: trustedMetadata({
      schoolLevel: input.schoolLevel,
      role: input.role,
      modelName: OPENAI_MODELS.profile,
    }),
    confirmedTags: emptyConfirmedTags(),
    modules: output.profile.modules.map((module) => ({
      ...module,
      claims: module.claims.map((claim, claimIndex) => ({
        ...claim,
        id: `${module.id}:claim:${claimIndex + 1}`,
        confirmedByUser: false,
      })),
    })),
  });

  const profile = parseAIProfile({
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
      return [claim];
    }
    return [
      {
        ...replacement,
        id: claim.id,
        basis: preserveEvidenceConfidence(claim.basis, replacement.basis),
        evidenceQuestionIds: claim.evidenceQuestionIds,
        confirmedByUser: false,
      },
    ];
  });

  return {
    id: original.id,
    title: generated.title,
    summary: generated.summary,
    claims,
  };
}

function preserveEvidenceConfidence(
  original: EvidenceBasis,
  generated: EvidenceBasis,
): EvidenceBasis {
  const confidence: Record<EvidenceBasis, number> = {
    needs_confirmation: 0,
    inferred: 1,
    direct: 2,
  };
  return confidence[generated] > confidence[original] ? original : generated;
}

function editableUnconfirmedClaimIds(
  input: RefineInput,
  moduleId?: ProfileModule["id"],
): Set<string> {
  const requestedIds = new Set(input.editableClaimIds);
  return new Set(
    input.profile.modules
      .filter((module) => moduleId === undefined || module.id === moduleId)
      .flatMap((module) =>
        module.claims
          .filter(
            (claim) => requestedIds.has(claim.id) && !claim.confirmedByUser,
          )
          .map((claim) => claim.id),
      ),
  );
}

function pendingPrivacyReview(): TeacherContextProfile["privacyReview"] {
  return {
    status: "needs_review",
    items: [
      {
        text: "수정된 프로파일",
        reason: "수정 후 개인정보 재점검이 필요합니다.",
        suggestedRewrite: "개인정보 재점검을 실행해 주세요.",
      },
    ],
  };
}

function finishRefinement(
  draftInput: TeacherContextProfile,
): TeacherContextProfile {
  const draft = parseAIProfile({
    ...draftInput,
    privacyReview: pendingPrivacyReview(),
  });
  const localReview = localProfilePrivacyReview(draft);

  return parseAIProfile({
    ...draft,
    privacyReview:
      localReview.status === "needs_review" ? localReview : draft.privacyReview,
  });
}

async function refineSingleModule(
  input: RefineInput & { moduleId: ProfileModule["id"] },
): Promise<TeacherContextProfile> {
  const targetModule = input.profile.modules.find(
    (module) => module.id === input.moduleId,
  );
  if (!targetModule) {
    throw new ApiError(
      "invalid_request",
      400,
      "수정할 프로필 모듈을 찾지 못했습니다.",
    );
  }

  const editableIds = editableUnconfirmedClaimIds(input, input.moduleId);
  const output = await runStructuredResponse({
    operation: "profile_refine",
    model: OPENAI_MODELS.profile,
    effort: OPENAI_REASONING_EFFORT.profile,
    instructions: PROFILE_MODULE_REFINE_INSTRUCTIONS,
    input: JSON.stringify({
      documentContext: {
        profileTitle: input.profile.profileTitle,
        shortSummary: input.profile.shortSummary,
        moduleSummaries: input.profile.modules.map((module) => ({
          id: module.id,
          title: module.title,
          summary: module.summary,
        })),
        teachingDesignPrinciples: input.profile.teachingDesignPrinciples,
        classSupportConsiderations: input.profile.classSupportConsiderations,
        realisticConstraints: input.profile.realisticConstraints,
        aiCollaborationInstructions: input.profile.aiCollaborationInstructions,
      },
      targetModuleId: input.moduleId,
      targetModule,
      instruction: input.instruction,
      editableClaimIds: [...editableIds],
      protectedClaimIds: targetModule.claims
        .filter((claim) => !editableIds.has(claim.id))
        .map((claim) => claim.id),
    }),
    schema: profileModuleRefineOutputSchema,
    schemaName: "tcontext_profile_module_refine",
    maxOutputTokens: MODULE_REFINE_OUTPUT_TOKENS,
    retryMaxOutputTokens: MODULE_REFINE_RETRY_OUTPUT_TOKENS,
    timeoutMs: OPENAI_TIMEOUT_MS.profile,
  });

  if (output.module.id !== input.moduleId) {
    throw new ApiError(
      "ai_invalid_response",
      502,
      "AI가 요청한 프로필 모듈과 다른 응답을 반환했습니다.",
    );
  }

  const refinedModule = {
    ...preserveClaims(targetModule, output.module, editableIds),
    title: targetModule.title,
  };
  return finishRefinement({
    ...input.profile,
    modules: input.profile.modules.map((module) =>
      module.id === input.moduleId ? refinedModule : module,
    ),
  });
}

export async function refineProfile(
  input: RefineInput,
): Promise<TeacherContextProfile> {
  if (input.moduleId !== undefined) {
    return refineSingleModule({ ...input, moduleId: input.moduleId });
  }

  const editableIds = editableUnconfirmedClaimIds(input);
  const output = await runStructuredResponse({
    operation: "profile_refine",
    model: OPENAI_MODELS.profile,
    effort: OPENAI_REASONING_EFFORT.profile,
    instructions: PROFILE_REFINE_INSTRUCTIONS,
    input: JSON.stringify({
      profile: prepareProfileForAIRefinement(input.profile),
      instruction: input.instruction,
      moduleId: null,
      editableClaimIds: [...editableIds],
      protectedClaimIds: input.profile.modules.flatMap((module) =>
        module.claims
          .filter((claim) => !editableIds.has(claim.id))
          .map((claim) => claim.id),
      ),
    }),
    schema: profileRefineOutputSchema,
    schemaName: "tcontext_profile_refine",
    maxOutputTokens: PROFILE_REFINE_OUTPUT_TOKENS,
    retryMaxOutputTokens: PROFILE_REFINE_RETRY_OUTPUT_TOKENS,
    timeoutMs: OPENAI_TIMEOUT_MS.profile,
  });

  const generatedById = new Map(
    output.profile.modules.map((module) => [module.id, module]),
  );
  const modules = input.profile.modules.map((original) => {
    const generated = generatedById.get(original.id);
    if (!generated) {
      return original;
    }
    return preserveClaims(original, generated, editableIds);
  });

  return finishRefinement({
    ...output.profile,
    metadata: input.profile.metadata,
    modules,
    confirmedTags: input.profile.confirmedTags,
  });
}
