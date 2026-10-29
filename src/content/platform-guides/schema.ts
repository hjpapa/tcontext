import { z } from "zod";

export const guideArtifactIdSchema = z.enum([
  "profile-markdown",
  "usage-instructions",
  "skill-package",
]);
export type GuideArtifactId = z.infer<typeof guideArtifactIdSchema>;
export const AVAILABLE_ARTIFACTS: readonly GuideArtifactId[] = [
  "profile-markdown",
  "usage-instructions",
  "skill-package",
];
export const guideMethodStatusSchema = z.enum([
  "recommended",
  "available",
  "transitioning",
  "announced",
  "retired",
]);
export type GuideMethodStatus = z.infer<typeof guideMethodStatusSchema>;
const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "유효한 확인 날짜가 필요합니다.");
export const platformGuideMethodSchema = z
  .object({
    id,
    label: text,
    status: guideMethodStatusSchema,
    requiredArtifacts: z
      .array(guideArtifactIdSchema)
      .min(1)
      .refine(
        (values) =>
          values.every((value) => AVAILABLE_ARTIFACTS.includes(value)) &&
          new Set(values).size === values.length,
        "현재 생성 가능한 산출물만 중복 없이 지정합니다.",
      ),
    steps: z
      .array(
        z
          .object({
            title: text,
            body: text,
            image: z.object({ src: text, alt: text }).strict().optional(),
          })
          .strict(),
      )
      .min(1),
    instructionTarget: text.optional(),
    availabilityNote: text.optional(),
    migrationNote: text.optional(),
    updateNote: text.optional(),
    replaces: id.optional(),
    officialUrl: z
      .url()
      .refine(
        (value) => value.startsWith("https://"),
        "HTTPS 공식 URL이 필요합니다.",
      ),
    verifiedAt: date,
  })
  .strict();
export type PlatformGuideMethod = z.infer<typeof platformGuideMethodSchema>;
export const platformGuideSchema = z
  .object({
    id,
    name: text,
    summary: text,
    methods: z.array(platformGuideMethodSchema).min(1),
    fallbackMethodId: id,
  })
  .strict();
export type PlatformGuide = z.infer<typeof platformGuideSchema>;
// Only content tests parse this schema; rendering consumes the typed constants.
export const platformGuidesSchema = z
  .array(platformGuideSchema)
  .min(1)
  .superRefine((guides, ctx) => {
    const methods = guides.flatMap((guide) => guide.methods);
    const ids = new Set(methods.map((method) => method.id));
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (new Set(guides.map((guide) => guide.id)).size !== guides.length)
      fail("플랫폼 id가 중복됩니다.");
    if (ids.size !== methods.length)
      fail("방법 id는 전체 콘텐츠에서 고유해야 합니다.");
    for (const guide of guides) {
      if (!guide.methods.some((method) => method.status !== "retired"))
        fail("종료되지 않은 방법이 필요합니다.");
      if (
        !guide.methods.some(
          (method) =>
            method.id === guide.fallbackMethodId && method.status !== "retired",
        )
      )
        fail("사용 가능한 대안 방법이 필요합니다.");
      for (const method of guide.methods)
        if (method.replaces && !ids.has(method.replaces))
          fail("대체 대상 방법이 없습니다.");
    }
  });
