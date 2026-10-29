import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  AS_OF_NOTICE,
  CORE_AS_OF_NOTICE,
} from "../src/content/export-variants";
import {
  LOCAL_PROFILE_DB_NAME,
  localProfileRecordSchema,
} from "../src/lib/storage/profiles/schema";
import {
  MODULES,
  generatedProfile,
  safeAnswer,
  fulfillJson,
  startElementaryInterview,
  answerFirstQuestionAndFinishInterview,
  approveDraftAndFinishReview,
} from "./helpers";

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
      reviewToken: "context-export-test-token",
    }),
  );
  return unexpected;
}

async function reviewedResult(page: Page) {
  await startElementaryInterview(page);
  await answerFirstQuestionAndFinishInterview(page);
  await approveDraftAndFinishReview(page);
  return page.getByRole("region", { name: "필요한 만큼만 전달하기" });
}

async function downloadedMarkdown(page: Page, button: Locator) {
  const event = page.waitForEvent("download");
  await button.click();
  const download = await event;
  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  const content = await readFile(filePath!, "utf8");
  expect(content.charCodeAt(0)).toBe(0xfeff);
  expect(content).not.toContain(safeAnswer);
  expect(content).not.toContain("context-export-test-token");
  return { filename: download.suggestedFilename(), markdown: content.slice(1) };
}

async function clipboardText(page: Page) {
  // Windows represents clipboard newlines as CRLF.
  return (await page.evaluate(() => navigator.clipboard.readText())).replace(
    /\r\n/g,
    "\n",
  );
}

async function expectNoDatabase(page: Page) {
  expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
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

test.describe("context export variants", () => {
  test.setTimeout(120_000);

  test("keeps full and core previews, copies, downloads and guide exports consistent without storage", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const unexpected = await mockApis(page);
    const panel = await reviewedResult(page);
    const preview = panel.getByRole("textbox", {
      name: "내보낼 내용 미리보기",
    });
    await expect(preview).toHaveAttribute("readonly", "");
    const full = await preview.inputValue();
    const fullFile = await downloadedMarkdown(
      page,
      panel.getByRole("button", { name: "Markdown 다운로드", exact: true }),
    );
    expect(fullFile.filename).toMatch(
      /^tcontext-teacher-profile-elementary-\d{8}\.md$/,
    );
    expect(fullFile.markdown).toBe(full);
    const originalFile = await downloadedMarkdown(
      page,
      page.getByRole("button", {
        name: "수업 설계용 Markdown 다운로드",
        exact: true,
      }),
    );
    expect(originalFile).toEqual(fullFile);
    await panel.getByRole("button", { name: "복사", exact: true }).click();
    await expect.poll(() => clipboardText(page)).toBe(full);

    await panel.getByRole("radio", { name: "핵심본", exact: true }).click();
    const core = await preview.inputValue();
    expect(core).toContain('export_variant: "core"');
    for (const profileModule of MODULES) {
      expect(core).toContain(profileModule.summary);
      expect(core).not.toContain(profileModule.claim.text);
    }
    for (const item of [
      ...generatedProfile.teachingDesignPrinciples,
      ...generatedProfile.classSupportConsiderations,
      ...generatedProfile.realisticConstraints,
      ...generatedProfile.aiCollaborationInstructions,
    ])
      expect(core).toContain(item);
    expect(core).toContain(CORE_AS_OF_NOTICE("2026-07-31", "generated"));
    expect(core).not.toContain("# 수업마다 추가할 작업 컨텍스트");
    expect(core).not.toContain("# AI에게 바로 전달할 실행 프롬프트");
    const coreFile = await downloadedMarkdown(
      page,
      panel.getByRole("button", { name: "Markdown 다운로드", exact: true }),
    );
    expect(coreFile.filename).toMatch(/-core\.md$/);
    expect(coreFile.markdown).toBe(core);
    await page
      .getByRole("button", { name: "핵심본 복사", exact: true })
      .click();
    await expect.poll(() => clipboardText(page)).toBe(core);
    await expectNoDatabase(page);

    await page
      .getByRole("link", { name: "AI에서 활용하기", exact: true })
      .click();
    await page.locator('a[href="/ai-guide/chatgpt"]').click();
    await page
      .getByRole("radio", { name: "핵심본", exact: true })
      .first()
      .click();
    const guideFile = await downloadedMarkdown(
      page,
      page
        .getByRole("button", { name: "교사 Markdown 다운로드", exact: true })
        .first(),
    );
    expect(guideFile.filename).toMatch(/-core\.md$/);
    expect(guideFile.markdown).toBe(core);
    await expectNoDatabase(page);
    expect(unexpected).toEqual([]);
  });

  test("selects module and section exports with a keyboard at 320px without creating storage", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const unexpected = await mockApis(page);
    const panel = await reviewedResult(page);
    await page.setViewportSize({ width: 320, height: 850 });
    await expectNoOverflow(page);
    await panel.getByRole("radio", { name: "전체본", exact: true }).focus();
    // Radix defers roving focus; release the arrow after focus has moved so
    // its focus handler still sees the held arrow and selects that radio.
    await page.keyboard.down("ArrowRight");
    await expect(
      panel.getByRole("radio", { name: "핵심본", exact: true }),
    ).toBeFocused();
    await page.keyboard.up("ArrowRight");
    await expect(
      panel.getByRole("radio", { name: "핵심본", exact: true }),
    ).toBeChecked();
    await expectNoOverflow(page);
    await page.keyboard.down("ArrowRight");
    await expect(
      panel.getByRole("radio", { name: "모듈 선택본", exact: true }),
    ).toBeFocused();
    await page.keyboard.up("ArrowRight");
    await expect(
      panel.getByRole("radio", { name: "모듈 선택본", exact: true }),
    ).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(
      panel.getByRole("button", { name: "전체 선택", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      panel.getByRole("button", { name: "전체 해제", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    const firstModule = panel.getByRole("checkbox", {
      name: MODULES[0].title,
      exact: true,
    });
    await expect(firstModule).toBeFocused();
    await page.keyboard.press("Space");
    await expect(firstModule).toBeChecked();
    for (const profileModule of MODULES.slice(1, 4)) {
      await page.keyboard.press("Tab");
      await expect(
        panel.getByRole("checkbox", { name: profileModule.title, exact: true }),
      ).toBeFocused();
    }
    await page.keyboard.press("Space");
    await expect(
      panel.getByRole("checkbox", { name: MODULES[3].title, exact: true }),
    ).toBeChecked();
    for (const name of [
      ...MODULES.slice(4).map((profileModule) => profileModule.title),
      "수업 설계 원칙",
      "학급 지원 고려사항",
    ]) {
      await page.keyboard.press("Tab");
      await expect(
        panel.getByRole("checkbox", { name, exact: true }),
      ).toBeFocused();
    }
    await page.keyboard.press("Space");
    await expect(
      panel.getByRole("checkbox", { name: "학급 지원 고려사항", exact: true }),
    ).not.toBeChecked();
    await expectNoOverflow(page);

    const selected = await panel
      .getByRole("textbox", { name: "내보낼 내용 미리보기" })
      .inputValue();
    expect(selected).toContain('export_variant: "modules"');
    expect(selected).toContain(
      `이 문서는 교사 프로파일 중 다음 영역만 담고 있습니다: ${MODULES[0].title}·${MODULES[3].title}.`,
    );
    expect(selected.match(/^## M\d\. .+$/gm)).toEqual([
      `## M1. ${MODULES[0].title}`,
      `## M4. ${MODULES[3].title}`,
    ]);
    expect(selected).not.toContain("## 학급 지원 고려사항");
    expect(selected).toContain("## AI 협업 지침과 판단 경계");
    expect(selected).toContain(AS_OF_NOTICE("2026-07-31", "generated"));
    const file = await downloadedMarkdown(
      page,
      panel.getByRole("button", { name: "Markdown 다운로드", exact: true }),
    );
    expect(file.filename).toMatch(/-modules\.md$/);
    expect(file.markdown).toBe(selected);
    await panel.getByRole("button", { name: "복사", exact: true }).click();
    await expect.poll(() => clipboardText(page)).toBe(selected);
    await panel.getByRole("button", { name: "전체 해제", exact: true }).click();
    await expect(
      panel.getByText("모듈을 하나 이상 고르세요", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByRole("textbox", { name: "내보낼 내용 미리보기" }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: "복사", exact: true }),
    ).toBeDisabled();
    await expect(
      panel.getByRole("button", { name: "Markdown 다운로드", exact: true }),
    ).toBeDisabled();
    await expectNoDatabase(page);
    expect(unexpected).toEqual([]);
  });

  test("exports summaries without individual claims and uses the confirmed date for a saved profile", async ({
    page,
  }) => {
    const unexpected = await mockApis(page);
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
    // Existing confirmed snapshots may still contain unresolved claims. The review
    // helper resolves them, so exercise this valid storage boundary separately.
    const confirmedAt = "2026-10-25T15:30:00.000Z";
    const record = localProfileRecordSchema.parse({
      id: "00000000-0000-4000-8000-000000000013",
      storageSchemaVersion: 1,
      createdAt: confirmedAt,
      updatedAt: confirmedAt,
      revision: 1,
      origin: "interview",
      suggestedTags: [],
      confirmed: { profile: generatedProfile, confirmedAt },
      draft: null,
    });
    await page.evaluate(
      async ({ name, saved }) => {
        if (!(await indexedDB.databases()).some((db) => db.name === name))
          throw new Error("Local storage must be enabled through the UI first");
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open(name);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("profiles", "readwrite");
            transaction.objectStore("profiles").put(saved);
            transaction.oncomplete = () => {
              db.close();
              resolve();
            };
            transaction.onabort = () => {
              db.close();
              reject(transaction.error);
            };
          };
        });
      },
      { name: LOCAL_PROFILE_DB_NAME, saved: record },
    );
    await page.reload();
    await page.getByRole("button", { name: "보기", exact: true }).click();
    await expect(page).toHaveURL(/\/result$/);
    const panel = page.getByRole("region", { name: "필요한 만큼만 전달하기" });
    const preview = panel.getByRole("textbox", {
      name: "내보낼 내용 미리보기",
    });
    const full = await preview.inputValue();
    expect(full).toContain(MODULES[1].claim.text);
    expect(full).toContain(MODULES[2].claim.text);
    await panel.getByRole("radio", { name: "핵심본", exact: true }).click();
    await expect(preview).toHaveValue(/context_as_of: "2026-10-26"/);
    const core = await preview.inputValue();
    expect(core).toContain('context_as_of_source: "confirmed"');
    expect(core).toContain(CORE_AS_OF_NOTICE("2026-10-26", "confirmed"));
    for (const profileModule of MODULES)
      expect(core).not.toContain(profileModule.claim.text);
    expect(core).not.toContain("# 수업마다 추가할 작업 컨텍스트");
    expect(core).not.toContain("# AI에게 바로 전달할 실행 프롬프트");
    const file = await downloadedMarkdown(
      page,
      panel.getByRole("button", { name: "Markdown 다운로드", exact: true }),
    );
    expect(file.filename).toMatch(/-core\.md$/);
    expect(file.markdown).toBe(core);
    expect(unexpected).toEqual([]);
  });
});
