import { expect, test, type Page } from "@playwright/test";
import {
  generatedProfile,
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
      reviewToken: "current-document-test-token",
    }),
  );
  return unexpected;
}

async function expectResponsiveMenu(page: Page) {
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  const current = nav.getByRole("link", { name: "현재 문서", exact: true });
  const start = nav.locator('a[href="/interview"]');
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(current).toBeVisible();
  await expect(current.getByText("문서", { exact: true })).toBeVisible();
  await expect(start).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(current).toBeVisible();
  await expect(current.getByText("현재 문서", { exact: true })).toBeVisible();
  await expect(start).toBeVisible();
}

test("returns to the current document through responsive menus and clears the link on reload", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const unexpected = await mockApis(page);
  await startElementaryInterview(page);
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  const current = nav.getByRole("link", { name: "현재 문서", exact: true });
  await expect(current).toHaveCount(0);
  await answerFirstQuestionAndFinishInterview(page);
  await expect(current).toHaveCount(0);
  await approveDraftAndFinishReview(page);
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  await expect(current).toHaveAttribute("href", "/result");
  await expect(current).toHaveAttribute("aria-current", "page");

  await page
    .getByRole("link", { name: "AI에서 활용하기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ai-guide$/);
  await expect(current).toBeVisible();
  await expect(current).not.toHaveAttribute("aria-current", "page");
  await current.click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page
    .getByRole("link", { name: "AI에서 활용하기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ai-guide$/);
  await expectResponsiveMenu(page);
  await nav.getByRole("link", { name: "문서 예시", exact: true }).click();
  await expect(page).toHaveURL(/\/examples(?:\?|$)/);
  await expectResponsiveMenu(page);
  await current.click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page
    .getByRole("link", { name: "AI에서 활용하기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ai-guide$/);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(current).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "AI에서 활용하기",
  );
  await expect(current).toHaveCount(0);
  await expect(nav.locator('a[href="/interview"]')).toBeVisible();
  expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);
  expect(unexpected).toEqual([]);
});
