// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  OPENAI_MODELS,
  PROMPT_VERSION,
  PROFILE_SCHEMA_VERSION,
} from "@/lib/ai/models";
import { submissionCreateRequestSchema } from "@/lib/ai/schemas/requests";
import { contributeProfile } from "@/lib/consent/contribution";
import { getConsentVersion } from "@/lib/consent/policy";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import { hashDeletionToken } from "@/lib/security/hash-token";
import { deleteSubmission } from "@/lib/supabase/submissions";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { teacherContextProfileSchema } from "@/types/profile";

const liveIntegrationEnabled = process.env.RUN_LIVE_INTEGRATION === "1";

describe.runIf(liveIntegrationEnabled)("live contribution integration", () => {
  it("passes final OpenAI review, writes one consented profile, and deletes it", async () => {
    const example = FICTIONAL_PROFILES[1];
    if (!example) throw new Error("Missing elementary fictional profile.");

    const profile = teacherContextProfileSchema.parse({
      ...structuredClone(example),
      metadata: {
        ...example.metadata,
        generatedAt: new Date().toISOString(),
        schemaVersion: PROFILE_SCHEMA_VERSION,
        modelName: OPENAI_MODELS.profile,
        promptVersion: PROMPT_VERSION,
      },
      privacyReview: { status: "clear", items: [] },
    });

    const input = submissionCreateRequestSchema.parse({
      profile,
      profileMarkdown: profileToMarkdown(profile),
      confirmedTags: profile.confirmedTags,
      privacyReview: profile.privacyReview,
      consentVersion: getConsentVersion(),
      consentAccepted: true,
    });

    const receipt = await contributeProfile(input);
    let deleted = false;
    try {
      expect(receipt.submissionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
      );
      expect(receipt.deletionToken.length).toBeGreaterThanOrEqual(32);
      deleted = await deleteSubmission(
        receipt.submissionId,
        hashDeletionToken(receipt.deletionToken),
      );
      expect(deleted).toBe(true);
    } finally {
      if (!deleted) {
        await deleteSubmission(
          receipt.submissionId,
          hashDeletionToken(receipt.deletionToken),
        );
      }
    }
  }, 120_000);
});
