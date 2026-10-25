import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { LocalProfileRecord } from "../src/lib/storage/profiles/schema";
import {
  generatedProfile,
  safeAnswer,
  fulfillJson,
  startElementaryInterview,
  answerFirstQuestionAndFinishInterview,
  approveDraftAndFinishReview,
} from "./helpers";

const databaseName = "tcontext-local-profiles";
const editedClaim = "활동 전에 생각을 정리할 시간을 충분히 제공합니다.";
const addedClaim = "학생은 글이나 그림으로 생각을 표현하는 방법을 선택합니다.";
const readyProfile = {
  ...generatedProfile,
  modules: generatedProfile.modules.map((module) => ({
    ...module,
    claims: module.claims.map((claim) => ({
      ...claim,
      basis: "direct",
      confirmedByUser: true,
    })),
  })),
};

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
  }, databaseName);
}

async function expectNoDatabase(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await indexedDB.databases()).map((db) => db.name),
      ),
    )
    .not.toContain(databaseName);
}

async function mockApis(page: Page, warning = false) {
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
      review: warning
        ? {
            status: "needs_review",
            items: [
              {
                text: generatedProfile.shortSummary,
                reason: "표현을 직접 확인해 주세요.",
                suggestedRewrite: "수업 지원 중심으로 정리해 주세요.",
              },
            ],
          }
        : { status: "clear", items: [] },
      ...(warning ? {} : { reviewToken: "mock-review-token" }),
    }),
  );
  return unexpected;
}

async function finishReview(page: Page, warning = false) {
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
  if (warning) {
    const proceed = page.getByRole("button", {
      name: "경고 확인하고 결과 보기",
    });
    await expect(proceed).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: /식별 가능한 정보가 남아 있을 수 있음을 이해했습니다/,
      })
      .check();
    await proceed.click();
  }
  await expect(page).toHaveURL(/\/result$/);
}

async function saveResult(page: Page) {
  const panel = page.getByRole("region", {
    name: "이 브라우저에 보관하기 (서버로 보내지 않음)",
  });
  const consent = panel.getByRole("checkbox");
  await expect(consent).not.toBeChecked();
  await expect(
    panel.getByRole("button", { name: "이 브라우저에 저장" }),
  ).toBeDisabled();
  await expectNoDatabase(page);
  await consent.check();
  await expectNoDatabase(page);
  await panel.getByRole("button", { name: "이 브라우저에 저장" }).click();
  await expect(panel.getByRole("status")).toContainText("저장됨");
  await expect.poll(async () => (await readRecords(page)).length).toBe(1);
}

async function confirmAction(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", {
      name:
        name === "로컬 저장 끄고 모두 삭제"
          ? "모두 삭제"
          : name === "프로파일 삭제"
            ? "삭제"
            : "덮어쓰기",
      exact: true,
    })
    .click();
}

async function importSaved(page: Page) {
  await page.goto("/profiles");
  await page
    .getByRole("checkbox", {
      name: "로컬 저장을 켜는 데 동의합니다.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "로컬 저장 켜기", exact: true })
    .click();
  await expect(
    page.getByText("저장한 프로파일 0개 / 10개", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("JSON 백업 파일 선택").setInputFiles({
    name: "profile.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(readyProfile)),
  });
  await page
    .getByRole("button", { name: "새 항목으로 저장", exact: true })
    .click();
  await expect(page).toHaveURL(/\/review$/);
  await finishReview(page);
  await expect
    .poll(
      async () => (await readRecords(page))[0]?.confirmed?.profile.profileTitle,
    )
    .toBe(generatedProfile.profileTitle);
  await expect.poll(async () => (await readRecords(page))[0]?.draft).toBeNull();
}

function firstModule(page: Page) {
  return page.getByRole("region", {
    name: "교사 기본 프로파일과 현재 역할",
    exact: true,
  });
}

test.describe("opt-in local profiles", () => {
  test.setTimeout(120_000);

  test("resumes an existing draft from confirmed view without replacing it", async ({
    page,
  }) => {
    await mockApis(page);
    await importSaved(page);
    await page
      .getByRole("link", { name: "다시 수정하기", exact: true })
      .click();
    await firstModule(page).getByLabel("문장 직접 수정").fill(editedClaim);
    await expect
      .poll(
        async () =>
          (await readRecords(page))[0]?.draft?.profile.modules[0]?.claims[0]
            ?.text,
      )
      .toBe(editedClaim);
    const before = (await readRecords(page))[0]!.draft;
    await page
      .getByRole("navigation", { name: "주요 메뉴" })
      .getByRole("link", { name: "내 프로파일" })
      .click();
    await page.getByRole("button", { name: "보기", exact: true }).click();
    await page
      .getByRole("link", { name: "다시 수정하기", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(
      dialog.getByRole("heading", { name: "편집 중인 초안이 있습니다" }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "초안 이어서 수정", exact: true })
      .click();
    await expect(firstModule(page).getByLabel("문장 직접 수정")).toHaveValue(
      editedClaim,
    );
    expect((await readRecords(page))[0]!.draft).toEqual(before);
  });

  test("saves an interview, reopens a browser, restores edits and round-trips a JSON backup", async ({
    page,
    context,
    browser,
    baseURL,
  }, testInfo) => {
    const unexpected = await mockApis(page);
    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);
    await approveDraftAndFinishReview(page);
    await saveResult(page);
    const original = (await readRecords(page))[0]!;
    expect(original.confirmed?.profile.profileTitle).toBe(
      generatedProfile.profileTitle,
    );
    expect(JSON.stringify(original)).not.toContain(safeAnswer);
    expect(JSON.stringify(original)).not.toContain("mock-review-token");
    const storageState = await context.storageState({ indexedDB: true });
    await context.close();
    const reopened = await browser.newContext({
      ...testInfo.project.use,
      baseURL,
      storageState,
    });
    const next = await reopened.newPage();
    const nextUnexpected = await mockApis(next);
    try {
      await next.goto("/");
      await next
        .getByRole("link", { name: "저장한 프로파일 1개 · 열기" })
        .click();
      await next.getByRole("button", { name: "보기", exact: true }).click();
      await expect(
        next.getByRole("heading", {
          name: generatedProfile.profileTitle,
          exact: true,
        }),
      ).toBeVisible();
      await next
        .getByRole("link", { name: "다시 수정하기", exact: true })
        .click();
      await firstModule(next).getByLabel("문장 직접 수정").fill(editedClaim);
      await expect(next.getByTestId("unresolved-count")).toHaveText(
        "확인할 문장 1개",
      );
      await expect(
        firstModule(next).getByText("수정됨", { exact: true }),
      ).toBeVisible();
      await firstModule(next)
        .getByRole("button", {
          name: "교사 기본 프로파일과 현재 역할 문장 추가",
          exact: true,
        })
        .click();
      await firstModule(next)
        .getByLabel("문장 직접 수정")
        .nth(1)
        .fill(addedClaim);
      await expect(
        firstModule(next).getByText("새 문장", { exact: true }),
      ).toBeVisible();
      await expect(next.getByText(/이 브라우저에 초안 저장됨/)).toBeVisible();
      await expect
        .poll(async () =>
          (await readRecords(next))[0]?.draft?.profile.modules[0]?.claims.map(
            (c) => c.text,
          ),
        )
        .toEqual([editedClaim, addedClaim]);
      await next.reload();
      await expect(
        next.getByRole("heading", { name: "검토할 초안이 없습니다." }),
      ).toBeVisible();
      await next
        .getByRole("navigation", { name: "주요 메뉴" })
        .getByRole("link", { name: "내 프로파일" })
        .click();
      await expect(
        next.getByText("편집 중 초안", { exact: true }),
      ).toBeVisible();
      await next.getByRole("button", { name: "수정하기", exact: true }).click();
      await expect(
        firstModule(next).getByLabel("문장 직접 수정").first(),
      ).toHaveValue(editedClaim);
      await expect(
        firstModule(next).getByLabel("문장 직접 수정").nth(1),
      ).toHaveValue(addedClaim);
      await finishReview(next);
      await expect
        .poll(async () => (await readRecords(next))[0]?.draft)
        .toBeNull();
      const confirmed = (await readRecords(next))[0]!.confirmed!.profile;
      const mdEvent = next.waitForEvent("download");
      await next
        .getByRole("button", {
          name: "수업 설계용 Markdown 다운로드",
          exact: true,
        })
        .click();
      const md = await mdEvent;
      expect(md.suggestedFilename()).toMatch(
        /^tcontext-teacher-profile-elementary-\d{8}\.md$/,
      );
      const markdown = await readFile((await md.path())!, "utf8");
      expect(markdown.charCodeAt(0)).toBe(0xfeff);
      expect(markdown).toContain(editedClaim);
      expect(markdown).toContain(addedClaim);
      expect(markdown).not.toContain(safeAnswer);
      const backupEvent = next.waitForEvent("download");
      await next
        .getByRole("button", { name: "JSON 백업 다운로드", exact: true })
        .click();
      const backup = await backupEvent;
      expect(backup.suggestedFilename()).toMatch(
        /^tcontext-teacher-profile-elementary-\d{8}\.json$/,
      );
      const backupBytes = await readFile((await backup.path())!);
      expect(
        backupBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
      ).toBe(false);
      expect(JSON.parse(backupBytes.toString()).profile).toEqual(confirmed);
      await next
        .getByRole("link", { name: "내 프로파일 열기", exact: true })
        .click();
      await confirmAction(next, "로컬 저장 끄고 모두 삭제");
      await expectNoDatabase(next);
      await next.reload();
      await next
        .getByRole("checkbox", {
          name: "로컬 저장을 켜는 데 동의합니다.",
          exact: true,
        })
        .check();
      await next
        .getByRole("button", { name: "로컬 저장 켜기", exact: true })
        .click();
      await next.getByLabel("JSON 백업 파일 선택").setInputFiles({
        name: backup.suggestedFilename(),
        mimeType: "application/json",
        buffer: backupBytes,
      });
      await next
        .getByRole("button", { name: "새 항목으로 저장", exact: true })
        .click();
      await expect(next).toHaveURL(/\/review$/);
      const imported = (await readRecords(next))[0]!;
      expect(imported.confirmed).toBeNull();
      expect(imported.draft?.profile.privacyReview.status).toBe("needs_review");
      expect(imported.draft?.profile.privacyReview.items[0]?.text).toBe(
        "최종 개인정보 검사를 완료하지 않은 초안",
      );
      await finishReview(next);
      await expect
        .poll(async () => (await readRecords(next))[0]?.confirmed?.profile)
        .toEqual(confirmed);
      await next
        .getByRole("link", { name: "내 프로파일 열기", exact: true })
        .click();
      await confirmAction(next, "프로파일 삭제");
      await expect.poll(async () => (await readRecords(next)).length).toBe(0);
      await confirmAction(next, "로컬 저장 끄고 모두 삭제");
      await expectNoDatabase(next);
      expect(unexpected).toEqual([]);
      expect(nextUnexpected).toEqual([]);
    } finally {
      await reopened.close();
    }
  });

  test("requires a fresh warning acknowledgement after editing a saved profile", async ({
    page,
  }) => {
    const unexpected = await mockApis(page);
    await importSaved(page);
    const warningUnexpected = await mockApis(page, true);
    await page
      .getByRole("link", { name: "다시 수정하기", exact: true })
      .click();
    await firstModule(page).getByLabel("문장 직접 수정").fill(editedClaim);
    await expect(
      firstModule(page).getByRole("button", { name: "내용 확인", exact: true }),
    ).toBeVisible();
    await finishReview(page, true);
    await expect(
      page.getByRole("heading", {
        name: "개인정보 경고가 남아 있어 이 문서는 서버에 기여할 수 없습니다.",
      }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await readRecords(page))[0]?.confirmed?.profile.privacyReview.status,
      )
      .toBe("needs_review");
    await expect
      .poll(async () => (await readRecords(page))[0]?.draft)
      .toBeNull();
    await page
      .getByRole("link", { name: "다시 수정하기", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", {
        name: /식별 가능한 정보가 남아 있을 수 있음을 이해했습니다/,
      }),
    ).toHaveCount(0);
    await finishReview(page, true);
    expect(unexpected).toEqual([]);
    expect(warningUnexpected).toEqual([]);
  });

  test("exports and imports in memory without consent, a database, or profile text in Web Storage", async ({
    page,
  }) => {
    const unexpected = await mockApis(page);
    await page.goto("/profiles");
    await expect(
      page.getByRole("button", { name: "로컬 저장 켜기", exact: true }),
    ).toBeDisabled();
    await expectNoDatabase(page);
    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);
    await approveDraftAndFinishReview(page);
    const backupEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "JSON 백업 다운로드", exact: true })
      .click();
    const backup = await backupEvent;
    const bytes = await readFile((await backup.path())!);
    const mdEvent = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "수업 설계용 Markdown 다운로드",
        exact: true,
      })
      .click();
    const md = await mdEvent;
    expect(await readFile((await md.path())!, "utf8")).not.toContain(
      safeAnswer,
    );
    await expectNoDatabase(page);
    const webStorage = await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    );
    for (const text of [
      safeAnswer,
      generatedProfile.profileTitle,
      generatedProfile.shortSummary,
      ...generatedProfile.modules.flatMap((m) => m.claims.map((c) => c.text)),
    ])
      expect(webStorage).not.toContain(text);
    await page
      .getByRole("navigation", { name: "주요 메뉴" })
      .getByRole("link", { name: "내 프로파일" })
      .click();
    await page.getByLabel("JSON 백업 파일 선택").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: bytes,
    });
    await page
      .getByRole("button", { name: "저장하지 않고 열기", exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "다른 문서 열기", exact: true })
      .click();
    await expect(page).toHaveURL(/\/review$/);
    await expectNoDatabase(page);
    expect(unexpected).toEqual([]);
  });

  test("detects a two-tab conflict and supports reload and explicit overwrite", async ({
    page,
    context,
  }) => {
    await mockApis(page);
    await importSaved(page);
    const other = await context.newPage();
    await mockApis(other);
    await other.goto("/profiles");
    await other.getByRole("button", { name: "수정하기", exact: true }).click();
    await page
      .getByRole("link", { name: "다시 수정하기", exact: true })
      .click();
    await firstModule(page).getByLabel("문장 직접 수정").fill(editedClaim);
    await expect
      .poll(
        async () =>
          (await readRecords(page))[0]?.draft?.profile.modules[0]?.claims[0]
            ?.text,
      )
      .toBe(editedClaim);
    await firstModule(other).getByLabel("문장 직접 수정").fill(addedClaim);
    await expect(
      other.getByText(/저장하지 못함: 다른 탭에서 수정한 기록/),
    ).toBeVisible();
    expect(
      (await readRecords(page))[0]?.draft?.profile.modules[0]?.claims[0]?.text,
    ).toBe(editedClaim);
    await other
      .getByRole("button", { name: "저장된 최신 내용 불러오기", exact: true })
      .click();
    await expect(firstModule(other).getByLabel("문장 직접 수정")).toHaveValue(
      editedClaim,
    );
    await firstModule(other).getByLabel("문장 직접 수정").fill(addedClaim);
    await expect
      .poll(
        async () =>
          (await readRecords(page))[0]?.draft?.profile.modules[0]?.claims[0]
            ?.text,
      )
      .toBe(addedClaim);
    const finalText = "마지막 활동에는 각자 선택한 방식으로 배움을 정리합니다.";
    await firstModule(page).getByLabel("문장 직접 수정").fill(finalText);
    await expect(
      page.getByText(/저장하지 못함: 다른 탭에서 수정한 기록/),
    ).toBeVisible();
    await confirmAction(page, "이 탭 내용으로 저장");
    await expect
      .poll(
        async () =>
          (await readRecords(page))[0]?.draft?.profile.modules[0]?.claims[0]
            ?.text,
      )
      .toBe(finalText);
    expect(
      (await readRecords(page))[0]?.confirmed?.profile.modules[0]?.claims[0]
        ?.text,
    ).toBe(generatedProfile.modules[0]!.claims[0]!.text);
    await other.close();
  });

  test("preserves saved records when tab records are cleared and a new interview is generated", async ({
    page,
  }) => {
    await mockApis(page);
    await importSaved(page);
    const original = (await readRecords(page))[0]!;
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "개인정보 처리 안내", exact: true })
      .click();
    await page
      .getByRole("button", { name: "이 탭의 모든 기록 삭제", exact: true })
      .click();
    expect(await readRecords(page)).toEqual([original]);
    await page
      .getByRole("navigation", { name: "주요 메뉴" })
      .getByRole("link", { name: "내 프로파일" })
      .click();
    await page.getByRole("button", { name: "수정하기", exact: true }).click();
    await page
      .getByRole("button", {
        name: "인터뷰와 초안을 모두 지우고 다시 시작",
        exact: true,
      })
      .click();
    expect(await readRecords(page)).toEqual([original]);
    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);
    await approveDraftAndFinishReview(page);
    expect(await readRecords(page)).toEqual([original]);
    const panel = page.getByRole("region", {
      name: "이 브라우저에 보관하기 (서버로 보내지 않음)",
    });
    await expect(panel.getByRole("checkbox")).toHaveCount(0);
    await panel
      .getByRole("button", { name: "이 브라우저에 저장", exact: true })
      .click();
    await expect.poll(async () => (await readRecords(page)).length).toBe(2);
    expect((await readRecords(page)).find((r) => r.id === original.id)).toEqual(
      original,
    );
  });

  test("keeps local profile controls usable at 320px and supports keyboard entry", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto("/profiles");
    await expect(
      page.getByRole("heading", { name: "내 프로파일", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(0);
    const consent = page.getByRole("checkbox", {
      name: "로컬 저장을 켜는 데 동의합니다.",
      exact: true,
    });
    await consent.focus();
    await page.keyboard.press("Space");
    await expect(consent).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "로컬 저장 켜기", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("저장한 프로파일 0개 / 10개", { exact: true }),
    ).toBeVisible();
    await confirmAction(page, "로컬 저장 끄고 모두 삭제");
    await expectNoDatabase(page);
  });
});
