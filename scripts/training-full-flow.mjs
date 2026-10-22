// Real production UI rehearsal with fictional answers only. No protection
// bypass, response mocks, stored sessions, traces, or interview/profile logs.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { chromium, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { COMMON_QUESTIONS } from "../src/content/questions/common.ts";
import { ELEMENTARY_QUESTIONS } from "../src/content/questions/elementary.ts";
import { ROLE_QUESTIONS } from "../src/content/questions/roles.ts";
import {
  privacyReviewSchema,
  teacherContextProfileSchema,
} from "../src/types/profile.ts";
import { sanitizeMarkdownText } from "../src/lib/export/sanitize.ts";
import {
  followUpAnswer,
  trainingAnswers,
} from "./fixtures/training-answers.mjs";

const origin = new URL(
  z.url().parse(process.argv[2] ?? "https://tcontext.vercel.app"),
);
assert(
  origin.protocol === "https:" ||
    (origin.protocol === "http:" && origin.hostname === "localhost"),
);
assert(
  !origin.username &&
    !origin.password &&
    origin.pathname === "/" &&
    !origin.search &&
    !origin.hash,
);
const participants = z.coerce
  .number()
  .int()
  .min(1)
  .max(50)
  .parse(process.argv[3] ?? 35);
assert(process.argv.includes("--live-ai"), "Explicit --live-ai required");
const verifyStorage = process.argv.includes("--verify-storage");
const reportPath = resolve(
  process.argv.find((v) => v.startsWith("--report="))?.slice(9) ??
    "test-results/training-full-flow.json",
);
const fixedQuestions = [
  ...COMMON_QUESTIONS,
  ...ELEMENTARY_QUESTIONS,
  ROLE_QUESTIONS.homeroom_teacher,
];
assert.equal(fixedQuestions.length, 14);
assert(fixedQuestions.every((q) => trainingAnswers[q.id]?.length > 100));
const generatedSchema = z.object({
  profile: teacherContextProfileSchema,
  suggestedTags: z.array(z.unknown()),
});
const reviewSchema = z.object({
  source: z.enum(["local", "openai"]),
  review: privacyReviewSchema,
  reviewToken: z.string().optional(),
});
const receiptSchema = z.object({
  submissionId: z.uuid(),
  deletionToken: z.string().min(32),
  createdAt: z.iso.datetime({ offset: true }),
  retentionUntil: z.iso.datetime({ offset: true }),
});
const sessions = [];
const tabIds = new Set();
const beganAt = new Date().toISOString();
let stage = "prepare";
let report;
let db;
const storage = { requested: verifyStorage };

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const generationGate = deferred();
const privacyGate = deferred();
let privacyParticipants = 0;
let privacyQueued = 0;
const browser = await chromium.launch({
  headless: !process.argv.includes("--headed"),
});
const safeError = (error) => ({ errorType: error.name });

async function rowCount(id) {
  const { count, error } = await db
    .from("teacher_context_submissions")
    .select("id", { head: true, count: "exact" })
    .eq("id", id);
  assert(!error, "Storage HEAD failed");
  return count;
}

async function prepare(index) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const result = {
    participant: index + 1,
    runtimeErrors: 0,
    submissionRequests: 0,
    followUpRequests: 0,
    followUpErrors: 0,
    fixedAnswers: 0,
    generation: { requests: 0 },
    privacy: { requests: 0 },
    download: {},
  };
  const session = { page, result, queued: deferred() };
  sessions.push(session);
  page.on("pageerror", () => {
    result.runtimeErrors++;
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin.origin) return;
    if (url.pathname.startsWith("/api/submissions/"))
      result.submissionRequests++;
    if (url.pathname === "/api/interview/follow-up") result.followUpRequests++;
    if (url.pathname === "/api/privacy/review") {
      result.privacy.requests++;
      // Keep the reviewed canonical profile in memory only for download checks.
      session.reviewedProfile = teacherContextProfileSchema.parse(
        request.postDataJSON().profile,
      );
    }
  });
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname === "/api/interview/follow-up" &&
      !response.ok()
    )
      result.followUpErrors++;
  });
  // Delay only the outgoing generation request until all final answers and
  // optional follow-ups are committed. Continue the original request unchanged.
  await page.route(
    new URL("/api/profile/generate", origin).href,
    async (route) => {
      const request = route.request();
      const input = request.postDataJSON();
      session.answerIds = new Set(input.answers.map((a) => a.questionId));
      result.generation.requests++;
      result.fixedAnswers = fixedQuestions.filter((q) =>
        input.answers.some(
          (a) => a.questionId === q.id && a.answer === trainingAnswers[q.id],
        ),
      ).length;
      result.answerCount = input.answers.length;
      result.inputCharacters = input.answers.reduce(
        (sum, a) => sum + a.answer.length,
        0,
      );
      const tabId = request.headers()["x-tcontext-tab"];
      if (tabId) tabIds.add(tabId);
      session.queued.resolve();
      await generationGate.promise;
      result.generation.startedAtMs = Date.now();
      await route.continue();
    },
  );
  await page.route(
    new URL("/api/privacy/review", origin).href,
    async (route) => {
      privacyQueued++;
      if (privacyQueued === privacyParticipants) privacyGate.resolve();
      await privacyGate.promise;
      result.privacy.startedAtMs = Date.now();
      await route.continue();
    },
  );
  await page.goto(new URL("/interview", origin).href, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("checkbox", { name: /개인정보를 입력하지 않으며/ })
    .check();
  await page
    .getByRole("button", { name: "확인하고 학교급 선택하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "인터뷰 시작하기", exact: true })
    .click();
  for (let step = 0; step < 20; step++) {
    const heading = page.getByRole("heading", { level: 1 });
    const prompt = await heading.innerText();
    const fixed = fixedQuestions.find((q) => q.prompt === prompt);
    await page
      .getByRole("textbox", { name: "답변", exact: true })
      .fill(fixed ? trainingAnswers[fixed.id] : followUpAnswer);
    if (
      await page
        .getByRole("button", { name: "초안 만들기", exact: true })
        .isVisible()
    )
      return session;
    await page.getByRole("button", { name: "다음 질문", exact: true }).click();
    await page
      .getByRole("heading", { level: 1, name: prompt, exact: true })
      .waitFor({ state: "hidden" });
  }
  throw new Error("Fixed question preparation incomplete");
}

async function queueGeneration(session) {
  const { page } = session;
  for (let step = 0; step < 5; step++) {
    const prompt = await page.getByRole("heading", { level: 1 }).innerText();
    await page
      .getByRole("button", { name: "초안 만들기", exact: true })
      .click();
    const queued = await Promise.race([
      session.queued.promise.then(() => true),
      page
        .getByRole("heading", { level: 1, name: prompt, exact: true })
        .waitFor({ state: "hidden" })
        .then(() => false),
    ]);
    if (queued) return;
    // A final-question follow-up is still part of the normal UI flow.
    await page
      .getByRole("textbox", { name: "답변", exact: true })
      .fill(followUpAnswer);
  }
  throw new Error("Generation was not queued");
}

async function receiveJson(page, path, result, timeout) {
  const response = await page.waitForResponse(
    (r) =>
      r.url() === new URL(path, origin).href && r.request().method() === "POST",
    { timeout },
  );
  result.status = response.status();
  result.securityChallenge =
    response.headers()["x-vercel-mitigated"] === "challenge";
  const body = await response.json().catch(() => null);
  result.completedAtMs = Date.now();
  result.durationMs = result.completedAtMs - result.startedAtMs;
  if (!response.ok())
    result.errorCode =
      typeof body?.error?.code === "string"
        ? body.error.code
        : "non_json_error";
  return body;
}

async function finishGeneration(session, responsePromise) {
  const { page, result } = session;
  try {
    const parsed = generatedSchema.safeParse(await responsePromise);
    result.generation.schemaValid = parsed.success;
    assert.equal(result.generation.status, 200);
    assert(parsed.success);
    assert.equal(result.fixedAnswers, 14);
    const { profile } = parsed.data;
    const claims = profile.modules.flatMap((module) => module.claims);
    const text = claims.map((claim) => claim.text).join("\n");
    const synthesis = [
      text,
      profile.shortSummary,
      ...profile.modules.map((module) => module.summary),
      ...profile.teachingDesignPrinciples,
      ...profile.classSupportConsiderations,
      ...profile.realisticConstraints,
      ...profile.aiCollaborationInstructions,
    ].join("\n");
    // Bounded quality checks on fictional output; retain only booleans/counts.
    // Lexical relevance is not a guarantee of semantic faithfulness.
    result.generation.model = profile.metadata.modelName;
    result.generation.basisCounts = Object.fromEntries(
      ["direct", "inferred", "needs_confirmation"].map((basis) => [
        basis,
        claims.filter((claim) => claim.basis === basis).length,
      ]),
    );
    // A detailed answer can already state the applicable practice. Do not force
    // invented inferences to satisfy a quota; report their distribution separately.
    result.generation.conceptCoverage = Object.fromEntries(
      [
        ["reasoning", /근거|이유/u],
        ["steps", /단계|순서/u],
        ["offlineAlternative", /종이|칠판|오프라인|비디지털/u],
        ["expressionChoice", /선택|표현/u],
        ["feedback", /피드백|수정/u],
      ].map(([concept, pattern]) => [concept, pattern.test(synthesis)]),
    );
    result.generation.quality = {
      sevenPopulatedModules:
        profile.modules.length === 7 &&
        profile.modules.every((module) => module.claims.length >= 2),
      groundedIds: claims.every(
        (claim) =>
          claim.evidenceQuestionIds.length > 0 &&
          claim.evidenceQuestionIds.every((id) => session.answerIds.has(id)),
      ),
      notAutoConfirmed: claims.every((claim) => !claim.confirmedByUser),
      actionable:
        profile.teachingDesignPrinciples.length > 0 &&
        profile.aiCollaborationInstructions.length > 0,
      noInventedClassNumbers:
        !/\d+\s*(?:명|학년|반|대)(?:\s|[,.]|이다|입니다)/u.test(text),
      noPersonalityTypes: !/MBTI|[IE][NS][TF][JP]|성격\s*유형/u.test(text),
    };
    assert(
      Object.values(result.generation.quality).every(Boolean),
      "Synthetic quality check failed",
    );
    await page.waitForURL("**/review");
    result.generation.checkpoint = "confirm-claims";
    await page.getByTestId("unresolved-count").waitFor();
    const bulk = page.getByRole("button", {
      name: "남은 문장 한 번에 확인",
      exact: true,
    });
    if (await bulk.isVisible()) {
      await bulk.click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /\d+개 모두 확인/ })
        .click();
    }
    await expect(page.getByTestId("unresolved-count")).toHaveText(
      "확인할 문장 0개",
      { timeout: 10_000 },
    );
    result.generation.checkpoint = "confirm-synthesis";
    await page
      .getByRole("checkbox", { name: /문서 제목, 전체·모듈 요약/ })
      .check();
    await expect(
      page.getByRole("button", {
        name: "검토 마치고 개인정보 검사",
        exact: true,
      }),
    ).toBeEnabled();
    result.generation.reviewReady = true;
  } catch (error) {
    Object.assign(result.generation, safeError(error));
  }
}

async function finalReview(session) {
  const { page, result } = session;
  try {
    const received = receiveJson(
      page,
      "/api/privacy/review",
      result.privacy,
      80_000,
    );
    const [body] = await Promise.all([
      received,
      page
        .getByRole("button", { name: "검토 마치고 개인정보 검사", exact: true })
        .click(),
    ]);
    const parsed = reviewSchema.safeParse(body);
    result.privacy.schemaValid = parsed.success;
    assert.equal(result.privacy.status, 200);
    assert(parsed.success);
    result.privacy.source = body.source;
    result.privacy.verdict = body.review.status;
    result.privacy.warningCount = body.review.items.length;
    result.privacy.hasReviewToken = Boolean(body.reviewToken);
    if (body.source === "local" && body.review.items.length) {
      // Static reason categories and paths only; never record flagged text.
      const reasonKinds = [
        ["medical_or_counseling", "의료·진단·상담"],
        ["student_name", "학생 이름"],
        ["person_name", "실명"],
        ["school_name", "학교명"],
        ["class_name", "학급명"],
        ["individual_score", "개별 점수"],
        ["rank", "석차"],
      ];
      const paths = (value, target, path = "profile") => {
        if (typeof value === "string") return value === target ? [path] : [];
        if (!value || typeof value !== "object") return [];
        return Object.entries(value).flatMap(([key, child]) =>
          paths(child, target, `${path}.${key}`),
        );
      };
      result.privacy.warningDiagnostics = body.review.items.map((item) => ({
        categories: reasonKinds
          .filter(([, phrase]) => item.reason.includes(phrase))
          .map(([kind]) => kind),
        paths: paths(session.reviewedProfile, item.text),
        hasNonDisclosureLanguage:
          /(?:입력|기록|공유|제공|저장|포함|전달|사용)하지|넣지|적지|배제|제외/u.test(
            item.text,
          ),
      }));
    }
    if (body.review.status === "needs_review") {
      // Warnings remain warnings in both UI and file; never count as clear.
      await page
        .getByRole("checkbox", { name: /식별 가능한 정보가 남아 있을 수 있음/ })
        .check();
      await page
        .getByRole("button", { name: "경고 확인하고 결과 보기", exact: true })
        .click();
    }
    await page.waitForURL("**/result");
    result.privacy.resultRendered = true;
    const consent = page.getByRole("checkbox", {
      name: /검토한 최종 프로필을 선택적으로 기여/,
    });
    result.contributionOffByDefault =
      body.review.status === "clear"
        ? !(await consent.isChecked()) &&
          !(await page
            .getByRole("button", { name: "동의하고 데이터 기여", exact: true })
            .isEnabled())
        : (await consent.count()) === 0;
  } catch (error) {
    Object.assign(result.privacy, safeError(error));
  }
}

async function downloadResult(session) {
  const { page, result } = session;
  let download;
  let deadline;
  const startedAtMs = Date.now();
  try {
    result.download.checkpoint = "click";
    const [file] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", {
          name: "수업 설계용 Markdown 다운로드",
          exact: true,
        })
        .click(),
    ]);
    download = file;
    result.download.checkpoint = "complete";
    const failure = await Promise.race([
      download.failure(),
      new Promise((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error("DownloadDeadline")),
          30_000,
        );
      }),
    ]);
    assert.equal(failure, null);
    result.download.checkpoint = "read";
    const data = await readFile(await download.path());
    const markdown = data.toString("utf8");
    const profile = session.reviewedProfile;
    assert(
      /^tcontext-teacher-profile-elementary-\d{8}\.md$/.test(
        download.suggestedFilename(),
      ),
    );
    assert(markdown.includes('document_type: "teacher_profile_context"'));
    assert(markdown.includes(`privacy_review: "${result.privacy.verdict}"`));
    assert(markdown.includes("needs_claim_review: false"));
    assert(markdown.includes(sanitizeMarkdownText(profile.profileTitle)));
    assert(markdown.includes(sanitizeMarkdownText(profile.shortSummary)));
    assert.equal((markdown.match(/^## M\d\./gm) ?? []).length, 7);
    assert(
      profile.modules.every(
        (m) =>
          markdown.includes(sanitizeMarkdownText(m.title)) &&
          markdown.includes(sanitizeMarkdownText(m.summary)),
      ),
    );
    assert(!markdown.includes("\uFFFD"));
    result.download = {
      ok: true,
      requests: 1,
      startedAtMs,
      completedAtMs: Date.now(),
      durationMs: Date.now() - startedAtMs,
      bytes: data.byteLength,
      sha256: createHash("sha256").update(data).digest("hex"),
      modules: 7,
    };
    result.exportWithoutStorage = result.submissionRequests === 0;
  } catch (error) {
    Object.assign(result.download, safeError(error), { ok: false });
  } finally {
    clearTimeout(deadline);
    if (download && !result.download.ok) await download.cancel();
    if (download) await download.delete();
  }
}

async function verifyContribution(session) {
  const { page } = session;
  let receipt;
  try {
    await page
      .getByRole("checkbox", { name: /검토한 최종 프로필을 선택적으로 기여/ })
      .check();
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url() === new URL("/api/submissions/create", origin).href,
      ),
      page
        .getByRole("button", { name: "동의하고 데이터 기여", exact: true })
        .click(),
    ]);
    storage.createStatus = response.status();
    assert(response.ok());
    const receiptBody = await response.json();
    // Retain cleanup credentials in memory before validating ancillary fields.
    receipt = receiptSchema
      .pick({ submissionId: true, deletionToken: true })
      .parse(receiptBody);
    receiptSchema.parse(receiptBody);
    const retentionMs =
      Date.parse(receiptBody.retentionUntil) -
      Date.parse(receiptBody.createdAt);
    storage.retentionWithinLimit =
      retentionMs >= 0 && retentionMs <= 365 * 24 * 60 * 60 * 1000;
    await page
      .getByRole("heading", {
        name: "선택적 기여가 완료되었습니다.",
        exact: true,
      })
      .waitFor();
    const payload = response.request().postDataJSON();
    storage.rawAnswersAbsent =
      !Object.hasOwn(payload, "answers") &&
      !Object.hasOwn(payload.profile, "answers");
    storage.signedReviewUsed = typeof payload.privacyReviewToken === "string";
    storage.consentAccepted = payload.consentAccepted === true;
    storage.createdRowCount = await rowCount(receipt.submissionId);
    assert.equal(storage.createdRowCount, 1);
    await page
      .getByRole("link", { name: "지금 삭제 화면 열기", exact: true })
      .click();
    await page
      .getByLabel("제출 ID", { exact: true })
      .fill(receipt.submissionId);
    await page
      .getByLabel("삭제 코드", { exact: true })
      .fill(receipt.deletionToken);
    const [deleted] = await Promise.all([
      page.waitForResponse(
        (r) => r.url() === new URL("/api/submissions/delete", origin).href,
      ),
      page
        .getByRole("button", { name: "기여 데이터 영구 삭제", exact: true })
        .click(),
    ]);
    storage.deleteStatus = deleted.status();
    // The UI does not consume this response body. Some Chromium/CDP versions
    // never finish Response.body() for it; verify the actual UI and DB row.
    storage.deleted = deleted.ok();
    await page
      .getByRole("heading", {
        name: "기여 데이터를 삭제했습니다.",
        exact: true,
      })
      .waitFor();
    storage.remainingRowCount = await rowCount(receipt.submissionId);
    assert(storage.deleted && storage.remainingRowCount === 0);
    assert(
      storage.rawAnswersAbsent &&
        storage.signedReviewUsed &&
        storage.consentAccepted &&
        storage.retentionWithinLimit,
    );
    storage.ok = true;
  } catch (error) {
    Object.assign(storage, safeError(error), { ok: false });
  } finally {
    // Delete only the synthetic row created by this run if the UI path failed.
    if (receipt && storage.remainingRowCount !== 0) {
      const { error } = await db
        .from("teacher_context_submissions")
        .delete()
        .eq("id", receipt.submissionId);
      storage.cleanupSucceeded =
        !error && (await rowCount(receipt.submissionId)) === 0;
    }
  }
}

function stats(items) {
  const sent = items.filter((r) => r.startedAtMs && r.completedAtMs);
  const times = sent.map((r) => r.durationMs).sort((a, b) => a - b);
  const events = sent
    .flatMap((r) => [
      [r.startedAtMs, 1],
      [r.completedAtMs, -1],
    ])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0,
    peak = 0;
  for (const [, delta] of events) {
    active += delta;
    peak = Math.max(peak, active);
  }
  const starts = sent.map((r) => r.startedAtMs);
  return {
    requests: items.reduce((sum, r) => sum + (r.requests ?? 0), 0),
    peakConcurrent: peak,
    launchSpreadMs: starts.length
      ? Math.max(...starts) - Math.min(...starts)
      : null,
    p50Ms: times[Math.ceil(times.length * 0.5) - 1] ?? null,
    p95Ms: times[Math.ceil(times.length * 0.95) - 1] ?? null,
    maxMs: times.at(-1) ?? null,
  };
}

try {
  if (verifyStorage) {
    loadEnvFile(".env.local");
    assert(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
    db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: (url, options) =>
            fetch(url, { ...options, signal: AbortSignal.timeout(20_000) }),
        },
      },
    );
    storage.serverConnection = (await rowCount(randomUUID())) === 0;
    const denied = await fetch(
      new URL(
        "/rest/v1/teacher_context_submissions?select=id&limit=0",
        process.env.SUPABASE_URL,
      ),
      { method: "HEAD", signal: AbortSignal.timeout(20_000) },
    );
    storage.unauthenticatedStatus = denied.status;
    assert([401, 403].includes(denied.status));
  }
  console.log(
    JSON.stringify({
      stage,
      participants,
      beganAt,
      target: origin.origin,
      synthetic: true,
      bypass: false,
      storage,
    }),
  );
  for (let start = 0; start < participants; start += 5) {
    await Promise.all(
      Array.from({ length: Math.min(5, participants - start) }, (_, i) =>
        prepare(start + i),
      ),
    );
    console.log(
      JSON.stringify({
        stage: "ready",
        prepared: Math.min(start + 5, participants),
        participants,
      }),
    );
  }
  stage = "generate";
  const responses = sessions.map((s) =>
    receiveJson(s.page, "/api/profile/generate", s.result.generation, 160_000),
  );
  // Attach rejection handlers immediately while the final follow-ups finish.
  responses.forEach((p) => p.catch(() => {}));
  await Promise.all(sessions.map(queueGeneration));
  generationGate.resolve();
  console.log(
    JSON.stringify({ stage, participants, at: new Date().toISOString() }),
  );
  await Promise.all(sessions.map((s, i) => finishGeneration(s, responses[i])));
  stage = "privacy";
  const ready = sessions.filter((s) => s.result.generation.reviewReady);
  privacyParticipants = ready.length;
  console.log(JSON.stringify({ stage, ready: ready.length, participants }));
  await Promise.all(ready.map(finalReview));
  console.log(
    JSON.stringify({
      stage: "privacy-complete",
      clear: sessions.filter((s) => s.result.privacy.verdict === "clear")
        .length,
      warnings: sessions.filter(
        (s) => s.result.privacy.verdict === "needs_review",
      ).length,
      completed: sessions.filter((s) => s.result.privacy.resultRendered).length,
    }),
  );
  stage = "download";
  await Promise.all(
    sessions.filter((s) => s.result.privacy.resultRendered).map(downloadResult),
  );
  console.log(
    JSON.stringify({
      stage: "download-complete",
      completed: sessions.filter((s) => s.result.download.ok).length,
    }),
  );
  if (verifyStorage) {
    stage = "storage";
    const eligible = sessions.find(
      (s) => s.result.download.ok && s.result.privacy.verdict === "clear",
    );
    if (eligible) await verifyContribution(eligible);
    else Object.assign(storage, { ok: false, errorType: "NoClearProfile" });
  }
  const results = sessions
    .map((s) => s.result)
    .sort((a, b) => a.participant - b.participant);
  const generation = stats(results.map((r) => r.generation));
  const privacy = stats(results.map((r) => r.privacy));
  const download = stats(results.map((r) => r.download));
  const succeeded = results.filter(
    (r) =>
      r.fixedAnswers === 14 &&
      r.generation.requests === 1 &&
      r.generation.reviewReady &&
      r.privacy.requests === 1 &&
      r.privacy.resultRendered &&
      r.download.ok &&
      r.contributionOffByDefault &&
      r.exportWithoutStorage &&
      r.followUpErrors === 0 &&
      r.runtimeErrors === 0,
  ).length;
  report = {
    target: origin.origin,
    beganAt,
    finishedAt: new Date().toISOString(),
    browserVersion: browser.version(),
    participants,
    synthetic: true,
    bypass: false,
    distinctTabs: tabIds.size,
    succeeded,
    failed: participants - succeeded,
    generation,
    privacy,
    download,
    privacyClear: results.filter((r) => r.privacy.verdict === "clear").length,
    privacyWarnings: results.filter((r) => r.privacy.verdict === "needs_review")
      .length,
    storage,
    results,
  };
  console.log(JSON.stringify({ ...report, results: undefined }));
  if (
    succeeded !== participants ||
    generation.peakConcurrent !== participants ||
    privacy.peakConcurrent !== participants ||
    download.peakConcurrent !== participants ||
    tabIds.size !== participants ||
    (verifyStorage && !storage.ok)
  )
    process.exitCode = 1;
} catch (error) {
  report = {
    target: origin.origin,
    beganAt,
    participants,
    stage,
    ...safeError(error),
    completed: false,
    storage,
    results: sessions.map((s) => s.result),
  };
  console.error(JSON.stringify({ ...report, results: undefined }));
  process.exitCode = 1;
} finally {
  generationGate.resolve();
  privacyGate.resolve();
  await browser.close();
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
}
