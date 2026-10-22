// Opt-in production rehearsal through the normal UI. No bypass headers,
// credentials, request mocks, stored browser state, traces or profile logs.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { z } from "zod";

import { teacherContextProfileSchema } from "../src/types/profile.ts";

const target = z.url().parse(process.argv[2] ?? "https://tcontext.vercel.app");
const origin = new URL(target);
if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
  throw new Error("Use HTTPS, or localhost for a local rehearsal");
}
if (
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
) {
  throw new Error("Use an origin without credentials, path, query or fragment");
}
const participants = z.coerce
  .number()
  .int()
  .min(1)
  .max(50)
  .parse(process.argv[3] ?? 35);
if (!process.argv.includes("--live-ai")) {
  throw new Error(
    "Pass --live-ai to authorize the synthetic AI requests and API usage",
  );
}
const reportPath = resolve(
  process.argv.find((value) => value.startsWith("--report="))?.slice(9) ??
    "test-results/training-browser-load.json",
);
const generatedSchema = z.object({
  profile: teacherContextProfileSchema,
  suggestedTags: z.array(z.unknown()),
});
const syntheticAnswer =
  "학생이 자신의 생각을 설명하고 친구의 질문을 듣고 수정할 시간을 늘리고 싶습니다. 초등학교 담임으로서 학생의 시도와 질문을 존중하며 결과뿐 아니라 생각을 바꾼 과정을 살핍니다. 짧은 안내 뒤 개인 메모, 짝 대화, 전체 공유를 연결합니다. 말하기가 부담스러울 때는 글이나 그림으로 먼저 생각을 준비할 수 있게 합니다. 활동 순서를 눈에 보이게 제시하고 한 번에 한 단계씩 안내합니다. 수업 시간이 부족하면 여러 활동을 모두 끝내기보다 핵심 활동 하나를 우선합니다. 기기를 쓰기 어려운 날에도 종이와 칠판으로 진행할 대안을 준비합니다. 피드백은 다음 시도에서 바꿀 한 가지를 구체적으로 안내합니다. AI는 질문과 자료의 초안을 돕고 최종 선택과 수정은 교사가 맡습니다.";

const browser = await chromium.launch({
  headless: !process.argv.includes("--headed"),
});
const sessions = [];
const tabIds = new Set();
let stage = "prepare";
let report;
const beganAt = new Date().toISOString();

async function prepare(index) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const result = {
    participant: index + 1,
    requests: 0,
    status: null,
    schemaValid: false,
    rendered: false,
    consoleErrors: 0,
    forbiddenWrites: 0,
  };
  const session = { context, page, result };
  sessions.push(session);
  page.on("pageerror", () => {
    result.consoleErrors += 1;
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin.origin) return;
    if (url.pathname.startsWith("/api/submissions/"))
      result.forbiddenWrites += 1;
    if (
      url.pathname === "/api/profile/generate" &&
      request.method() === "POST"
    ) {
      result.requests += 1;
      result.requestStartedAtMs = Date.now();
      // Retain only the shape, never the interview content or tab ID.
      const input = request.postDataJSON();
      result.answerCount = input.answers?.length;
      result.inputCharacters = input.answers?.reduce(
        (sum, answer) => sum + answer.answer.length,
        0,
      );
      result.hasTabHeader = Boolean(request.headers()["x-tcontext-tab"]);
      if (result.hasTabHeader) tabIds.add(request.headers()["x-tcontext-tab"]);
    }
  });
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
  await page
    .getByRole("textbox", { name: "답변", exact: true })
    .fill(syntheticAnswer);
  await page.getByRole("button", { name: "다음 질문", exact: true }).click();
  // A genuine AI follow-up may add a question. Follow the visible UI to the
  // final question; leave it empty so the synchronized click only generates.
  for (let step = 0; step < 20; step += 1) {
    const skip = page.getByRole("button", { name: "건너뛰기", exact: true });
    await skip.waitFor({ state: "visible" });
    await page
      .getByRole("textbox", { name: "답변", exact: true })
      .waitFor({ state: "visible" });
    // Wait for the previous answer/follow-up request to release the controls.
    await page.waitForFunction(
      () => !document.querySelector("textarea")?.disabled,
    );
    if (
      await page
        .getByRole("button", { name: "초안 만들기", exact: true })
        .isVisible()
    )
      return session;
    const question = await page.getByRole("heading", { level: 1 }).innerText();
    await skip.click();
    await page
      .getByRole("heading", { level: 1, name: question, exact: true })
      .waitFor({ state: "hidden" });
  }
  throw new Error("Preparation did not reach the final question");
}

async function generate(session) {
  const { page, result } = session;
  try {
    const received = page.waitForResponse(
      (response) =>
        response.url() === new URL("/api/profile/generate", origin).href &&
        response.request().method() === "POST",
      { timeout: 140_000 },
    );
    const [response] = await Promise.all([
      received,
      page.getByRole("button", { name: "건너뛰기", exact: true }).click(),
    ]);
    result.status = response.status();
    result.securityChallenge =
      response.headers()["x-vercel-mitigated"] === "challenge";
    const body = await response.json().catch(() => null);
    result.completedAtMs = Date.now();
    result.durationMs = result.completedAtMs - result.requestStartedAtMs;
    result.schemaValid =
      response.ok() && generatedSchema.safeParse(body).success;
    if (!response.ok())
      result.errorCode =
        typeof body?.error?.code === "string"
          ? body.error.code
          : "non_json_error";
    if (result.schemaValid) {
      await page.waitForURL("**/review", { timeout: 15_000 });
      await page
        .getByRole("heading", {
          name: "선생님의 말과 AI의 해석을 한 문장씩 확인해 주세요.",
          exact: true,
        })
        .waitFor({ state: "visible" });
      result.rendered = await page
        .getByRole("button", {
          name: "검토 중 초안 Markdown 다운로드",
          exact: true,
        })
        .isEnabled();
    }
  } catch (error) {
    result.errorCode = error.name;
    result.completedAtMs ??= Date.now();
  }
  return result;
}

try {
  console.log(
    JSON.stringify({
      stage,
      target: origin.origin,
      participants,
      beganAt,
      synthetic: true,
      bypass: false,
    }),
  );
  // Prepare a small batch at a time, but hold every final-generation click
  // until ALL participants are ready. Only that last burst is the load test.
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
  console.log(
    JSON.stringify({ stage, participants, at: new Date().toISOString() }),
  );
  const results = await Promise.all(sessions.map(generate));
  const sent = results.filter((r) => r.requestStartedAtMs);
  const starts = sent.map((r) => r.requestStartedAtMs);
  const events = sent
    .flatMap((r) => [
      [r.requestStartedAtMs, 1],
      [r.completedAtMs, -1],
    ])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0,
    peak = 0;
  for (const [, change] of events) {
    active += change;
    peak = Math.max(peak, active);
  }
  const durations = results
    .filter((r) => r.durationMs !== undefined)
    .map((r) => r.durationMs)
    .sort((a, b) => a - b);
  const succeeded = results.filter(
    (r) =>
      r.status === 200 &&
      r.schemaValid &&
      r.rendered &&
      r.requests === 1 &&
      r.consoleErrors === 0 &&
      r.forbiddenWrites === 0,
  ).length;
  report = {
    target: origin.origin,
    beganAt,
    finishedAt: new Date().toISOString(),
    participants,
    mode: "independent-browser-contexts-normal-ui",
    browserVersion: browser.version(),
    distinctTabCount: tabIds.size,
    synthetic: true,
    bypass: false,
    succeeded,
    failed: participants - succeeded,
    generationRequests: results.reduce((sum, r) => sum + r.requests, 0),
    peakConcurrentGenerationRequests: peak,
    launchSpreadMs: starts.length
      ? Math.max(...starts) - Math.min(...starts)
      : null,
    p50Ms: durations[Math.ceil(durations.length * 0.5) - 1] ?? null,
    p95Ms: durations[Math.ceil(durations.length * 0.95) - 1] ?? null,
    maxMs: durations.at(-1) ?? null,
    results,
  };
  console.log(JSON.stringify({ ...report, results: undefined }));
  if (
    succeeded !== participants ||
    peak !== participants ||
    tabIds.size !== participants
  )
    process.exitCode = 1;
} catch (error) {
  report = {
    target: origin.origin,
    beganAt,
    participants,
    stage,
    errorType: error.name,
    completed: false,
  };
  console.error(JSON.stringify(report));
  process.exitCode = 1;
} finally {
  await browser.close();
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
}
