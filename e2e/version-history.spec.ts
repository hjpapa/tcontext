import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CORE_AS_OF_NOTICE } from "../src/content/export-variants";
import { readStoredZip } from "../src/lib/export/zip.test-helper";
import {
  LOCAL_PROFILE_DB_NAME,
  localProfileRecordSchema,
  type LocalProfileRecord,
} from "../src/lib/storage/profiles/schema";
import { teacherContextProfileSchema } from "../src/types/profile";
import {
  MODULES,
  generatedProfile,
  safeAnswer,
  fulfillJson,
  startElementaryInterview,
  answerFirstQuestionAndFinishInterview,
  approveDraftAndFinishReview,
} from "./helpers";

const editedClaim = "활동 전에 생각을 정리할 시간을 충분히 제공합니다.";
const reviewToken = "version-history-test-token";
const readyProfile = teacherContextProfileSchema.parse({
  ...generatedProfile,
  modules: generatedProfile.modules.map((module) => ({
    ...module,
    claims: module.claims.map((claim) => ({
      ...claim,
      basis: "direct",
      confirmedByUser: true,
    })),
  })),
});

async function mockApis(page: Page) {
  const unexpected: string[] = [];
  await page.route("**/api/**", async (route) => {
    unexpected.push(new URL(route.request().url()).pathname);
    await route.abort();
  });
  await page.route("**/api/interview/follow-up", (route) =>
    fulfillJson(route, { needed: false, question: null }),
  );
  await page.route("**/api/profile/generate", (route) =>
    fulfillJson(route, { profile: generatedProfile, suggestedTags: [] }),
  );
  await page.route("**/api/privacy/review", (route) =>
    fulfillJson(route, {
      source: "openai",
      review: { status: "clear", items: [] },
      reviewToken,
    }),
  );
  return unexpected;
}

async function reviewedResult(page: Page) {
  await startElementaryInterview(page);
  await answerFirstQuestionAndFinishInterview(page);
  await approveDraftAndFinishReview(page);
}

async function readRecords(page: Page): Promise<LocalProfileRecord[]> {
  return page.evaluate(async (name) => {
    if (!(await indexedDB.databases()).some((db) => db.name === name))
      return [];
    return new Promise<LocalProfileRecord[]>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("profiles", "readonly");
        const records = tx.objectStore("profiles").getAll();
        tx.oncomplete = () => {
          db.close();
          resolve(records.result);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }, LOCAL_PROFILE_DB_NAME);
}

async function expectNoDatabase(page: Page) {
  await expect
    .poll(() => page.evaluate(() => indexedDB.databases()))
    .toEqual([]);
}

async function saveResult(page: Page) {
  const panel = page.getByRole("region", {
    name: "이 브라우저에 보관하기 (서버로 보내지 않음)",
  });
  await expectNoDatabase(page);
  await expect(panel.getByRole("checkbox")).not.toBeChecked();
  await expect(
    panel.getByRole("button", { name: "이 브라우저에 저장" }),
  ).toBeDisabled();
  await panel.getByRole("checkbox").check();
  await expectNoDatabase(page);
  await panel.getByRole("button", { name: "이 브라우저에 저장" }).click();
  await expect(panel.getByRole("status")).toContainText("저장됨");
  await expect.poll(async () => (await readRecords(page)).length).toBe(1);
}

async function finishReview(page: Page) {
  const confirmations = page.getByRole("button", {
    name: /^(내용 확인|이 추론 승인)$/,
  });
  while (await confirmations.count()) await confirmations.first().click();
  await expect(page.getByTestId("unresolved-count")).toHaveText(
    "확인할 문장 0개",
  );
  await page
    .getByRole("checkbox", { name: /문서 제목, 전체·모듈 요약/ })
    .check();
  await page.getByRole("button", { name: "검토 마치고 개인정보 검사" }).click();
  await expect(page).toHaveURL(/\/result$/);
  await expect.poll(async () => (await readRecords(page))[0]?.draft).toBeNull();
}

async function editFirstClaim(page: Page) {
  await page.getByRole("link", { name: "다시 수정하기" }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page
    .getByRole("region", { name: MODULES[0].title, exact: true })
    .getByRole("textbox", { name: "문장 직접 수정" })
    .fill(editedClaim);
  await expect
    .poll(
      async () =>
        (await readRecords(page))[0]?.draft?.profile.modules[0]?.claims[0]
          ?.text,
    )
    .toBe(editedClaim);
}

async function openLibrary(page: Page) {
  await page
    .getByRole("navigation", { name: "주요 메뉴" })
    .getByRole("link", { name: "내 프로파일", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profiles$/);
}

async function openVersions(page: Page) {
  await openLibrary(page);
  await expect(page.getByText("버전 2개", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "버전 기록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "버전 기록", exact: true }),
  ).toBeVisible();
  const versions = page
    .getByRole("list", { name: "확정 버전 기록" })
    .locator(":scope > li");
  await expect(versions).toHaveCount(2);
  return versions;
}

async function expectNoOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
}

async function expectCoreDate(page: Page, date: string) {
  const panel = page.getByRole("region", { name: "필요한 만큼만 전달하기" });
  await panel.getByRole("radio", { name: "핵심본", exact: true }).click();
  await expect(
    panel.getByRole("textbox", { name: "내보낼 내용 미리보기" }),
  ).toHaveValue(new RegExp(CORE_AS_OF_NOTICE(date, "confirmed")));
}

async function enableAndSeed(page: Page, record: unknown) {
  await page.goto("/profiles");
  await page
    .getByRole("checkbox", { name: "로컬 저장을 켜는 데 동의합니다." })
    .check();
  await page
    .getByRole("button", { name: "로컬 저장 켜기", exact: true })
    .click();
  await expect(
    page.getByText("저장한 프로파일 0개 / 10개", { exact: true }),
  ).toBeVisible();
  await page.evaluate(
    async ({ name, value }) => {
      if (!(await indexedDB.databases()).some((db) => db.name === name))
        throw new Error("Local storage must be enabled through the UI first");
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("profiles", "readwrite");
          tx.objectStore("profiles").put(value);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    { name: LOCAL_PROFILE_DB_NAME, value: record },
  );
  await page.reload();
  await expect(
    page.getByText("저장한 프로파일 1개 / 10개", { exact: true }),
  ).toBeVisible();
}

async function downloadedBytes(page: Page, button: Locator) {
  const event = page.waitForEvent("download");
  await button.click();
  const download = await event;
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!);
}

test.describe("local version history and skill packages", () => {
  test.setTimeout(120_000);

  test("compares an interview edit and restores its original date using the keyboard at 320px", async ({
    page,
  }) => {
    const unexpected = await mockApis(page);
    await page.clock.setFixedTime(new Date("2026-10-25T01:00:00.000Z"));
    await reviewedResult(page);
    await saveResult(page);
    const original = (await readRecords(page))[0]!.confirmed!;

    await page.clock.setFixedTime(new Date("2026-10-26T01:00:00.000Z"));
    await editFirstClaim(page);
    await finishReview(page);
    const updated = (await readRecords(page))[0]!;
    expect(updated.confirmed?.profile.modules[0]?.claims[0]?.text).toBe(
      editedClaim,
    );
    expect(updated.confirmed?.confirmedAt).not.toBe(original.confirmedAt);
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0]?.confirmedAt).toBe(original.confirmedAt);

    await page.setViewportSize({ width: 320, height: 568 });
    const versions = await openVersions(page);
    await expect(versions.first()).toContainText(
      `바뀐 영역: ${MODULES[0].title}`,
    );
    await expectNoOverflow(page);
    const compare = versions
      .nth(1)
      .getByRole("button", { name: "현재와 비교" });
    await compare.focus();
    await expect(compare).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(compare).toHaveAttribute("aria-expanded", "true");
    const comparison = versions.nth(1).getByRole("region", {
      name: MODULES[0].title,
      exact: true,
    });
    await expect(
      comparison.getByRole("region", { name: "이전 버전" }),
    ).toContainText(MODULES[0].claim.text);
    await expect(
      comparison.getByRole("region", { name: "현재 확정본" }),
    ).toContainText(editedClaim);
    await expect(comparison.getByText("수정", { exact: true })).toHaveCount(2);
    await expectNoOverflow(page);

    await versions
      .nth(1)
      .getByRole("button", { name: "이 버전으로 복원" })
      .focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog", { name: "이 버전으로 복원" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "취소", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "복원", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => (await readRecords(page))[0]?.confirmed?.confirmedAt)
      .toBe(original.confirmedAt);
    const restored = (await readRecords(page))[0]!;
    expect(restored.confirmed?.profile).toEqual(original.profile);
    expect(restored.history).toHaveLength(1);
    expect(restored.history[0]?.confirmedAt).toBe(
      updated.confirmed?.confirmedAt,
    );
    await expect(versions).toHaveCount(2);
    await expectNoOverflow(page);
    await versions
      .first()
      .getByRole("button", { name: "보기", exact: true })
      .click();
    await expect(page).toHaveURL(/\/result$/);
    await expectCoreDate(page, "2026-10-25");
    expect(unexpected).toEqual([]);
  });

  test("disables restoration while a real edit is saved as a draft", async ({
    page,
  }) => {
    const unexpected = await mockApis(page);
    const previous = structuredClone(readyProfile);
    previous.modules[0]!.claims[0]!.text =
      "질문 뒤 조용히 생각할 시간을 둡니다.";
    const record = localProfileRecordSchema.parse({
      id: "3de44a32-c1db-4e60-bb20-16d7d2d14c71",
      storageSchemaVersion: 2,
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: "2026-10-21T00:00:00.000Z",
      revision: 2,
      origin: "interview",
      suggestedTags: [],
      confirmed: {
        profile: readyProfile,
        confirmedAt: "2026-10-21T00:00:00.000Z",
      },
      draft: null,
      history: [
        {
          profile: previous,
          confirmedAt: "2026-10-20T00:00:00.000Z",
          replacedAt: "2026-10-21T00:00:00.000Z",
        },
      ],
      exports: [],
    });
    await enableAndSeed(page, record);
    await page.getByRole("button", { name: "보기", exact: true }).click();
    await expect(page).toHaveURL(/\/result$/);
    await editFirstClaim(page);
    const versions = await openVersions(page);
    const restore = versions
      .nth(1)
      .getByRole("button", { name: "이 버전으로 복원" });
    const reason = "편집 중인 초안을 확정하거나 버린 뒤 복원할 수 있습니다";
    await expect(restore).toBeDisabled();
    await expect(restore).toHaveAccessibleDescription(reason);
    await expect(page.getByText(reason, { exact: true })).toBeVisible();
    const withDraft = (await readRecords(page))[0]!;
    expect(withDraft.confirmed).toEqual(record.confirmed);
    expect(withDraft.history).toEqual(record.history);
    expect(withDraft.draft?.profile.modules[0]?.claims[0]?.text).toBe(
      editedClaim,
    );
    expect(unexpected).toEqual([]);
  });

  test("records core copy and identifies its destination after a new confirmation", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const unexpected = await mockApis(page);
    await reviewedResult(page);
    await saveResult(page);
    const original = (await readRecords(page))[0]!.confirmed!;
    await page
      .getByRole("button", { name: "핵심본 복사", exact: true })
      .click();
    await expect(
      page.getByText("핵심본 복사가 완료되었습니다.", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => (await readRecords(page))[0]?.exports.length)
      .toBe(1);
    const exported = (await readRecords(page))[0]!.exports[0]!;
    expect(exported).toEqual({
      target: "result",
      format: "core",
      confirmedAt: original.confirmedAt,
      exportedAt: expect.any(String),
    });
    const clipboard = (
      await page.evaluate(() => navigator.clipboard.readText())
    ).replace(/\r\n/g, "\n");
    expect(clipboard).toContain(original.profile.shortSummary);
    expect(clipboard).not.toContain(safeAnswer);
    expect(clipboard).not.toContain(reviewToken);
    await openLibrary(page);
    await expect(page.getByText(/최근 내보낸 기록/)).toBeVisible();
    await page.getByRole("button", { name: "보기", exact: true }).click();
    await expect(page).toHaveURL(/\/result$/);
    await editFirstClaim(page);
    await finishReview(page);
    const notice = page.getByRole("region", {
      name: "이전 버전 내보내기 안내",
    });
    await expect(
      notice.getByRole("heading", { name: "이전 버전을 내보낸 곳이 있습니다" }),
    ).toBeVisible();
    await expect(notice).toContainText("결과 화면 · 핵심본");
    expect((await readRecords(page))[0]?.exports).toEqual([exported]);
    await openLibrary(page);
    await expect(
      page.getByText("이전 버전을 내보낸 곳 1곳", { exact: true }),
    ).toBeVisible();
    expect(unexpected).toEqual([]);
  });

  test("downloads a checked skill with exact core and full reference bytes without storage consent", async ({
    page,
  }) => {
    const unexpected = await mockApis(page);
    await reviewedResult(page);
    await expectNoDatabase(page);
    await page
      .getByRole("link", { name: "AI에서 활용하기", exact: true })
      .click();
    await page.locator('a[href="/ai-guide/gemini"]').click();
    await expect(page).toHaveURL(/\/ai-guide\/gemini$/);
    const attachment = page.locator("#gemini-chat-attachment");
    const markdownButton = attachment.getByRole("button", {
      name: "교사 Markdown 다운로드",
    });
    await attachment
      .getByRole("radio", { name: "전체본", exact: true })
      .click();
    const fullBytes = await downloadedBytes(page, markdownButton);
    expect(fullBytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    await attachment
      .getByRole("radio", { name: "핵심본", exact: true })
      .click();
    const coreBytes = await downloadedBytes(page, markdownButton);
    const core = coreBytes.toString("utf8").slice(1);
    const zip = await downloadedBytes(
      page,
      page.getByRole("button", { name: "ZIP 패키지 다운로드" }),
    );
    await expect(
      page.getByText("공개 Agent Skills 형식 검사 통과", { exact: true }),
    ).toBeVisible();
    const entries = readStoredZip(zip);
    expect(entries.map((entry) => entry.path)).toEqual([
      "teacher-context/SKILL.md",
      "teacher-context/references/teacher-profile.md",
    ]);
    const skill = new TextDecoder().decode(entries[0]!.content);
    const bodyStart = core.indexOf("\n---\n") + "\n---\n".length;
    expect(bodyStart).toBeGreaterThan("\n---\n".length);
    expect(skill.endsWith(core.slice(bodyStart))).toBe(true);
    expect(skill).toContain(generatedProfile.shortSummary);
    expect(Buffer.from(entries[1]!.content)).toEqual(fullBytes.subarray(3));
    const reference = new TextDecoder().decode(entries[1]!.content);
    expect(reference).toContain(MODULES[0].claim.text);
    for (const content of [skill, reference]) {
      expect(content).not.toContain(safeAnswer);
      expect(content).not.toContain(reviewToken);
    }
    await expectNoDatabase(page);
    expect(unexpected).toEqual([]);
  });

  test("reads a raw v1 record and persists v2 history after editing, then restores its old date", async ({
    page,
  }) => {
    const unexpected = await mockApis(page);
    const confirmedAt = "2026-10-20T15:30:00.000Z";
    const legacy = {
      id: "058e1052-9d48-4c90-a4ab-30a2873eab38",
      storageSchemaVersion: 1,
      createdAt: confirmedAt,
      updatedAt: confirmedAt,
      revision: 1,
      origin: "interview",
      suggestedTags: [],
      confirmed: { profile: readyProfile, confirmedAt },
      draft: null,
    };
    await enableAndSeed(page, legacy);
    await expect(page.getByText("버전 1개", { exact: true })).toBeVisible();
    expect((await readRecords(page))[0]?.storageSchemaVersion).toBe(1);
    await page.getByRole("button", { name: "보기", exact: true }).click();
    await expect(page).toHaveURL(/\/result$/);
    await expectCoreDate(page, "2026-10-21");
    expect((await readRecords(page))[0]?.storageSchemaVersion).toBe(1);
    await editFirstClaim(page);
    await finishReview(page);
    const migrated = localProfileRecordSchema.parse(
      (await readRecords(page))[0],
    );
    expect(migrated.storageSchemaVersion).toBe(2);
    expect(migrated.confirmed?.profile.modules[0]?.claims[0]?.text).toBe(
      editedClaim,
    );
    expect(migrated.history).toHaveLength(1);
    expect(migrated.history[0]?.profile).toEqual(readyProfile);
    expect(migrated.history[0]?.confirmedAt).toBe(confirmedAt);
    const versions = await openVersions(page);
    await versions
      .nth(1)
      .getByRole("button", { name: "이 버전으로 복원" })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "복원", exact: true })
      .click();
    await expect
      .poll(async () => (await readRecords(page))[0]?.confirmed?.confirmedAt)
      .toBe(confirmedAt);
    await expect(versions).toHaveCount(2);
    await versions
      .first()
      .getByRole("button", { name: "보기", exact: true })
      .click();
    await expect(page).toHaveURL(/\/result$/);
    await expectCoreDate(page, "2026-10-21");
    expect((await readRecords(page))[0]?.confirmed?.profile).toEqual(
      readyProfile,
    );
    expect(unexpected).toEqual([]);
  });
});
