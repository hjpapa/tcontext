// Synthetic, bounded workshop rehearsal. Never contributes data or logs content.
// node scripts/training-load.mjs https://tcontext.vercel.app 30 --ai
import { randomBytes } from "node:crypto";
import { z } from "zod";

const base = new URL(process.argv[2] ?? "http://localhost:3100");
const teachers = z.coerce
  .number()
  .int()
  .min(1)
  .max(30)
  .parse(process.argv[3] ?? 30);
if (
  !["https:", "http:"].includes(base.protocol) ||
  base.username ||
  base.password
) {
  throw new Error("Use an HTTP(S) origin without credentials");
}
const useAI = process.argv.includes("--ai");
const tabs = Array.from({ length: teachers }, () =>
  randomBytes(16).toString("hex"),
);
const profiles = new Map();
const privacyOutcomes = {};
const exchange = {
  questionId: "training-synthetic-1",
  moduleId: "educational_philosophy",
  question: "좋은 수업이었다고 느끼는 순간은 언제인가요?",
  answer:
    "학생이 자기 생각을 설명하고 친구의 질문을 듣고 수정할 때입니다. 짧은 안내 뒤 개인 메모와 짝 대화를 연결하고, 활동 순서를 눈에 보이게 제공합니다. 초등학교 담임으로서 수업 시간이 부족하면 핵심 활동 하나를 먼저 진행합니다. AI는 자료 초안을 돕고 최종 판단은 교사가 합니다.",
};
const setup = { schoolLevel: "elementary", role: "homeroom_teacher" };
const followUpSchema = z.object({ needed: z.boolean(), question: z.unknown() });
const generationSchema = z.object({
  profile: z
    .object({
      metadata: z.object({ schoolLevel: z.literal("elementary") }),
      profileTitle: z.string().min(1),
      modules: z
        .array(z.object({ id: z.string(), claims: z.array(z.unknown()) }))
        .length(7),
    })
    .passthrough(),
  suggestedTags: z.array(z.unknown()),
});
const privacySchema = z.object({
  review: z.object({ status: z.enum(["clear", "needs_review", "blocked"]) }),
  source: z.enum(["local", "openai"]),
});

async function phase(name, path, payload, validate) {
  const results = await Promise.all(
    tabs.map(async (tab, index) => {
      const body = payload?.(index);
      if (payload && body === undefined)
        return { status: "skipped", ms: 0, ok: false };
      const started = performance.now();
      try {
        const response = await fetch(new URL(path, base), {
          method: payload ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            "x-tcontext-tab": tab,
          },
          ...(payload ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(135_000),
        });
        const text = await response.text();
        let valid = response.ok;
        let code;
        if (validate || !response.ok) {
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            valid = false;
          }
          if (response.ok && json) valid = validate(json, index);
          if (!response.ok && json) code = json.error?.code;
          if (response.headers.get("x-vercel-mitigated") === "challenge") {
            code = "security_checkpoint";
          }
        }
        return {
          status: response.status,
          ok: valid,
          ms: Math.round(performance.now() - started),
          ...(code ? { code } : {}),
        };
      } catch (error) {
        return {
          status: error.name,
          ok: false,
          ms: Math.round(performance.now() - started),
        };
      }
    }),
  );
  const durations = results.map((r) => r.ms).sort((a, b) => a - b);
  const counts = {};
  for (const result of results) {
    const key = `${result.status}${result.code ? `:${result.code}` : ""}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    JSON.stringify({
      phase: name,
      teachers,
      succeeded: teachers - failed,
      failed,
      statuses: counts,
      p50Ms: durations[Math.ceil(teachers * 0.5) - 1],
      p95Ms: durations[Math.ceil(teachers * 0.95) - 1],
      maxMs: durations.at(-1),
    }),
  );
  if (failed) process.exitCode = 1;
}

console.log(
  JSON.stringify({
    target: base.origin,
    teachers,
    ai: useAI,
    synthetic: true,
    startedAt: new Date().toISOString(),
  }),
);
await phase("interview-page", "/interview");
await phase("health", "/api/health", undefined, (body) => body.status === "ok");
if (useAI) {
  await phase(
    "follow-up",
    "/api/interview/follow-up",
    () => ({
      ...setup,
      current: exchange,
      previousAnswers: [],
      followUpCount: 0,
    }),
    (body) => followUpSchema.safeParse(body).success,
  );
  await phase(
    "profile-generate",
    "/api/profile/generate",
    () => ({ ...setup, answers: [exchange] }),
    (body, index) => {
      const parsed = generationSchema.safeParse(body);
      if (parsed.success) profiles.set(index, body.profile);
      return parsed.success;
    },
  );
  await phase(
    "privacy-review",
    "/api/privacy/review",
    (index) =>
      profiles.has(index) ? { profile: profiles.get(index) } : undefined,
    (body) => {
      const parsed = privacySchema.safeParse(body);
      if (!parsed.success) return false;
      const outcome = `${parsed.data.source}:${parsed.data.review.status}`;
      privacyOutcomes[outcome] = (privacyOutcomes[outcome] ?? 0) + 1;
      // A local privacy warning is a valid review result, not a service error.
      return (
        parsed.data.source === "openai" ||
        parsed.data.review.status === "needs_review"
      );
    },
  );
  console.log(
    JSON.stringify({ phase: "privacy-outcomes", outcomes: privacyOutcomes }),
  );
  profiles.clear();
}
