import { runStructuredResponse } from "@/lib/ai/client";
import {
  OPENAI_MODELS,
  OPENAI_REASONING_EFFORT,
  OPENAI_TIMEOUT_MS,
} from "@/lib/ai/models";
import { PRIVACY_REVIEW_INSTRUCTIONS } from "@/lib/ai/prompts/privacy";
import {
  privacyReviewCandidatesOutputSchema,
  type PrivacyReviewCandidate,
} from "@/lib/ai/schemas/privacy";
import { assertSafeGeneratedCharacters } from "@/lib/ai/text-quality";
import {
  collectProfileAuthoredTextFields,
  localAuthoredProfilePrivacyReview,
  type TextField,
} from "@/lib/security/privacy-guard";
import {
  containsExactCalendarDate,
  GRADE_OR_AGE_PATTERN,
  hasContactRisk,
  hasGovernmentIdRisk,
  hasPersonNameRisk as hasPotentialPersonName,
  hasQuasiIdentifierCombinationRisk,
  hasSchoolOrClassRisk as hasSpecificSchoolOrClass,
  hasSingularStudentReference,
  MEDICAL_TERM_PATTERN,
  RARE_IDENTIFYING_EVENT_PATTERN,
} from "@/lib/privacy/detector";
import {
  privacyReviewSchema,
  type PrivacyReview,
  type TeacherContextProfile,
} from "@/types/profile";

// Name, school/class, and quasi-identifier evidence come from the pre-AI
// detector, so an AI candidate is never confirmed by wording the detector
// treats as generic. The labeled patterns below only widen evidence for
// explicit ID, contact, and address fields beyond the detector's formats.
const LABELED_GOVERNMENT_ID =
  /(?:주민등록번호|외국인등록번호|여권번호|운전면허(?:증)?번호|학번|학생번호|교직원번호|사번)\s*(?:은|는|이|가|:|：)?\s*[A-Z0-9-]{6,}/iu;
const LABELED_CONTACT =
  /(?:연락처|전화번호|이메일)\s*(?:은|는|이|가|:|：)?\s*(?:[\w.+-]+@|\d{2,4}[-\s.]?\d{3,4})/iu;
const SENSITIVE_DETAIL = new RegExp(
  `(?:개별\\s*)?(?:점수|성적|석차|등수|순위)|${MEDICAL_TERM_PATTERN}`,
  "iu",
);

function hasGovernmentIdentifier(text: string) {
  return hasGovernmentIdRisk(text) || LABELED_GOVERNMENT_ID.test(text);
}

function hasContactDetail(text: string) {
  return hasContactRisk(text) || LABELED_CONTACT.test(text);
}

function hasPreciseLocation(text: string) {
  return (
    /(?:주소|거주지)\s*(?:은|는|이|가|:|：)?\s*[^.!?\n]{2,60}(?:로|길|동|읍|면|번지)\s*\d+/u.test(
      text,
    ) ||
    /(?:서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원(?:특별자치)?도|충청[남북]도|전라[남북]도|경상[남북]도|제주특별자치도)\s+[가-힣0-9]+(?:시|군|구)\s+[^.!?\n]{1,50}(?:로|길|동|읍|면)/u.test(
      text,
    )
  );
}

function hasDirectPersonalIdentifier(text: string) {
  return (
    hasPotentialPersonName(text) ||
    hasGovernmentIdentifier(text) ||
    hasContactDetail(text) ||
    hasPreciseLocation(text)
  );
}

function hasIndividualStudentReference(text: string) {
  return hasPotentialPersonName(text) || hasSingularStudentReference(text);
}

function hasIdentifiableSensitiveContext(text: string) {
  return SENSITIVE_DETAIL.test(text) && hasIndividualStudentReference(text);
}

function hasCombinationRisk(text: string) {
  if (hasQuasiIdentifierCombinationRisk(text)) return true;
  if (!hasDirectPersonalIdentifier(text)) return false;

  const contextualClues = [
    hasSpecificSchoolOrClass(text),
    hasIdentifiableSensitiveContext(text),
    containsExactCalendarDate(text),
    GRADE_OR_AGE_PATTERN.test(text),
    RARE_IDENTIFYING_EVENT_PATTERN.test(text),
  ].filter(Boolean).length;

  return contextualClues >= 2;
}

/**
 * Treats the model as a candidate generator, not the final privacy authority.
 * Generic educational nouns such as 학생, 학급, 우리 학급, and 우리 반 are
 * never concrete evidence by themselves, regardless of the model category.
 */
function candidateHasConcreteEvidence(
  category: PrivacyReviewCandidate["category"],
  text: string,
) {
  switch (category) {
    case "person_name":
      return hasPotentialPersonName(text);
    case "government_id":
      return hasGovernmentIdentifier(text);
    case "contact":
      return hasContactDetail(text);
    case "precise_location":
      return hasPreciseLocation(text);
    case "specific_school_or_class":
      return hasSpecificSchoolOrClass(text);
    case "identifiable_sensitive_context":
      return hasIdentifiableSensitiveContext(text);
    case "combination_risk":
      return hasCombinationRisk(text);
  }
}

function validatedPublicReview(
  fields: readonly TextField[],
  candidates: readonly PrivacyReviewCandidate[],
): PrivacyReview {
  const allowedTextByPath = new Map(
    fields.map((field) => [field.path, field.value] as const),
  );
  const candidatesByPath = new Map<string, PrivacyReviewCandidate[]>();

  for (const candidate of candidates) {
    // The model never echoes text back; a path that was not sent is dropped.
    const text = allowedTextByPath.get(candidate.path);
    if (text === undefined) continue;
    if (!candidateHasConcreteEvidence(candidate.category, text)) continue;

    const existing = candidatesByPath.get(candidate.path) ?? [];
    if (
      !existing.some(
        (item) =>
          item.category === candidate.category &&
          item.reason === candidate.reason &&
          item.suggestedRewrite === candidate.suggestedRewrite,
      )
    ) {
      existing.push(candidate);
      candidatesByPath.set(candidate.path, existing);
    }
  }

  const items: PrivacyReview["items"] = [];
  for (const [path, pathCandidates] of candidatesByPath) {
    const first = pathCandidates[0];
    const text = allowedTextByPath.get(path);
    if (!first || text === undefined) continue;

    items.push({
      text,
      reason: [...new Set(pathCandidates.map((item) => item.reason))].join(" "),
      suggestedRewrite: first.suggestedRewrite,
    });
  }

  return privacyReviewSchema.parse({
    status: items.length > 0 ? "needs_review" : "clear",
    items,
  });
}

// Reasoning tokens share this budget. A truncated answer is retried once with
// the larger limit instead of failing the teacher's only path to the result.
const PRIVACY_REVIEW_OUTPUT_TOKENS = 2_000;
const PRIVACY_REVIEW_RETRY_OUTPUT_TOKENS = 4_000;

async function runPrivacyReviewCandidates(fields: readonly TextField[]) {
  return runStructuredResponse({
    operation: "privacy_review",
    model: OPENAI_MODELS.privacy,
    effort: OPENAI_REASONING_EFFORT.privacy,
    instructions: PRIVACY_REVIEW_INSTRUCTIONS,
    input: JSON.stringify({
      fields: fields.map(({ path, value }) => ({ path, text: value })),
    }),
    schema: privacyReviewCandidatesOutputSchema,
    schemaName: "tcontext_privacy_review_candidates",
    maxOutputTokens: PRIVACY_REVIEW_OUTPUT_TOKENS,
    retryMaxOutputTokens: PRIVACY_REVIEW_RETRY_OUTPUT_TOKENS,
    timeoutMs: OPENAI_TIMEOUT_MS.privacy,
  });
}

export async function reviewProfileWithAI(
  profile: TeacherContextProfile,
): Promise<{ source: "local" | "openai"; review: PrivacyReview }> {
  const fields = collectProfileAuthoredTextFields(profile);
  const localReview = localAuthoredProfilePrivacyReview(profile);
  if (localReview.status === "needs_review") {
    return { source: "local", review: localReview };
  }

  const output = await runPrivacyReviewCandidates(fields);
  assertSafeGeneratedCharacters(
    output.items.map(({ reason, suggestedRewrite }) => ({
      reason,
      suggestedRewrite,
    })),
  );

  return {
    source: "openai",
    review: validatedPublicReview(fields, output.items),
  };
}
