import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { COMMON_USAGE_INSTRUCTIONS } from "../src/content/usage-instructions";
import { readStoredZip } from "../src/lib/export/zip.test-helper";
import {
  generatedProfile,
  safeAnswer,
  fulfillJson,
  startElementaryInterview,
  answerFirstQuestionAndFinishInterview,
  approveDraftAndFinishReview,
} from "./helpers";

const platforms = [
  { id: "chatgpt", name: "ChatGPT" },
  { id: "gemini", name: "Google Gemini" },
  { id: "claude", name: "Claude" },
];
async function clipboardText(page: Page) {
  // Windows converts clipboard newlines to CRLF; compare the exact text in LF.
  return (await page.evaluate(() => navigator.clipboard.readText())).replace(
    /\r\n/g,
    "\n",
  );
}
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
      reviewToken: "guide-test-token",
    }),
  );
  return unexpected;
}
test.describe("AI usage guides", () => {
  test.setTimeout(120_000);
  test("supports instruction copying without a document and stays within 320px", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto("/profiles");
    await page
      .getByRole("link", { name: "AI에서 활용하기", exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "AI에서 활용하기",
    );
    for (const platform of platforms) {
      await page.locator(`a[href="/ai-guide/${platform.id}"]`).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        `${platform.name} 활용 가이드`,
      );
      for (const button of await page
        .getByRole("button", { name: /다운로드$/ })
        .all())
        await expect(button).toBeDisabled();
      const instructionsEvent = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "지침 SKILL.md 내려받기", exact: true })
        .first()
        .click();
      const instructions = await instructionsEvent;
      expect(instructions.suggestedFilename()).toBe("SKILL.md");
      const instructionText = await readFile(
        (await instructions.path())!,
        "utf8",
      );
      expect(instructionText).toMatch(/^---\nname: "teacher-context-guide"\n/);
      expect(instructionText).toContain(COMMON_USAGE_INSTRUCTIONS);
      expect(instructionText).not.toContain(generatedProfile.profileTitle);
      expect(instructionText.match(/^---$/gm)).toHaveLength(2);
      await expect(
        page.getByText("문서를 만들거나 내 프로파일에서 여세요.").first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "공통 활용 지침 복사", exact: true })
        .first()
        .click();
      await expect
        .poll(() => clipboardText(page))
        .toBe(COMMON_USAGE_INSTRUCTIONS);
      for (const link of await page
        .getByRole("link", { name: "공식 도움말 열기 (새 탭)", exact: true })
        .all()) {
        await expect(link).toHaveAttribute("href", /^https:\/\//);
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      }
      await expect(
        page.getByRole("complementary", { name: "외부 서비스 이용 안내" }),
      ).toContainText("자동 동기화되지 않습니다");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
      await page
        .getByRole("link", { name: "모든 AI 활용 가이드", exact: true })
        .click();
    }
    expect(
      await page.evaluate(async () =>
        (await indexedDB.databases()).map((db) => db.name),
      ),
    ).not.toContain("tcontext-local-profiles");
    const response = await page.goto("/ai-guide/unknown-platform");
    expect(response?.status()).toBe(404);
  });

  for (const platform of platforms)
    test(`downloads the reviewed document and copies instructions for ${platform.name}`, async ({
      page,
      context,
    }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      const unexpected = await mockApis(page);
      await startElementaryInterview(page);
      await answerFirstQuestionAndFinishInterview(page);
      await approveDraftAndFinishReview(page);
      await page
        .getByRole("link", { name: "AI에서 활용하기", exact: true })
        .click();
      await page.locator(`a[href="/ai-guide/${platform.id}"]`).click();
      const mdEvent = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "교사 Markdown 다운로드", exact: true })
        .first()
        .click();
      const md = await mdEvent;
      expect(md.suggestedFilename()).toMatch(
        /^tcontext-teacher-profile-elementary-\d{8}\.md$/,
      );
      const markdown = await readFile((await md.path())!, "utf8");
      expect(markdown.charCodeAt(0)).toBe(0xfeff);
      expect(markdown).toContain(generatedProfile.profileTitle);
      expect(markdown).not.toContain(safeAnswer);
      expect(markdown).not.toContain("guide-test-token");
      await page
        .getByRole("button", { name: "공통 활용 지침 복사", exact: true })
        .first()
        .click();
      await expect
        .poll(() => clipboardText(page))
        .toBe(COMMON_USAGE_INSTRUCTIONS);
      const skillButton = page.getByRole("button", {
        name: "ZIP 패키지 다운로드",
        exact: true,
      });
      if (await skillButton.count()) {
        const skillEvent = page.waitForEvent("download");
        await skillButton.click();
        const skill = await skillEvent;
        expect(skill.suggestedFilename()).toBe("teacher-context.zip");
        const bytes = await readFile((await skill.path())!);
        const entries = readStoredZip(bytes);
        expect(entries.map((entry) => entry.path)).toEqual([
          "teacher-context/SKILL.md",
          "teacher-context/references/teacher-profile.md",
        ]);
        const instructions = new TextDecoder().decode(entries[0]!.content);
        expect(instructions).toMatch(
          /^---\nname: "teacher-context"\ndescription: /,
        );
        expect(instructions.match(/^---$/gm)).toHaveLength(2);
        expect(instructions).toContain(COMMON_USAGE_INSTRUCTIONS);
        expect(instructions).not.toContain(generatedProfile.profileTitle);
        const reference = new TextDecoder().decode(entries[1]!.content);
        expect(reference).toBe(markdown.slice(1));
        expect(reference).not.toContain(safeAnswer);
      }
      expect(
        await page.evaluate(async () =>
          (await indexedDB.databases()).map((db) => db.name),
        ),
      ).not.toContain("tcontext-local-profiles");
      expect(unexpected).toEqual([]);
    });
});
