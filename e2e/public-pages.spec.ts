import { expect, test, type Page } from "@playwright/test";

function sectionWithHeading(page: Page, name: string | RegExp) {
  const heading = page.getByRole("heading", { name });

  return page.getByRole("main").locator("section").filter({ has: heading });
}

async function expectNoHorizontalOverflow(page: Page) {
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

test.describe("public pages", () => {
  test("home exposes the app landmarks and primary journeys", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(
      page.getByRole("navigation", { name: "주요 메뉴" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toContainText(
      "만든 사람 jjpapa(docsusil)",
    );

    const hero = sectionWithHeading(page, /교사인 나의 맥락을/);
    await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      hero.getByRole("link", { name: "인터뷰 시작하기" }),
    ).toHaveAttribute("href", "/interview");
    await expect(
      hero.getByRole("link", { name: "가상 예시 보기" }),
    ).toHaveAttribute("href", "/examples");

    const moduleList = hero.getByRole("list", { name: "문서 모듈" });
    await expect(moduleList.getByRole("listitem")).toHaveCount(7);
    await expect(
      page.getByRole("heading", { name: "경험에서 시작하는 질문" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "교사가 끝까지 편집" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "저장 없이도 완성" }),
    ).toBeVisible();
  });

  test("app shell supports skip navigation and marks the current page", async ({
    page,
  }) => {
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "본문으로 바로가기" });
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await expect(page).toHaveURL(/#main-content$/);
    await page.goto("/");

    const primaryNav = page.getByRole("navigation", { name: "주요 메뉴" });
    const examplesLink = primaryNav.getByRole("link", { name: "문서 예시" });
    await expect(examplesLink).toHaveAttribute("href", "/examples");
    await examplesLink.click();

    await expect(page).toHaveURL(/\/examples(?:\?|$)/);
    await expect(
      page
        .getByRole("navigation", { name: "주요 메뉴" })
        .getByRole("link", { name: "문서 예시" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("examples switch school level and expose the lesson-design guide with keyboard disclosures", async ({
    page,
  }) => {
    await page.goto("/examples");

    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      /열네 번의 답변이/,
    );

    const schoolNavigation = page.getByRole("navigation", {
      name: "학교급별 예시 선택",
    });
    await expect(
      schoolNavigation.getByRole("link", { name: /초등학교/ }),
    ).toHaveAttribute("aria-current", "page");

    await schoolNavigation.getByRole("link", { name: /중학교/ }).click();
    await expect(page).toHaveURL(/\/examples\?school=middle#profile-example$/);

    const updatedSchoolNavigation = page.getByRole("navigation", {
      name: "학교급별 예시 선택",
    });
    await expect(
      updatedSchoolNavigation.getByRole("link", { name: /중학교/ }),
    ).toHaveAttribute("aria-current", "page");

    const profile = page.locator("#profile-example");
    await expect(profile).toHaveRole("article");
    await expect(profile.getByText("중학교", { exact: true })).toBeVisible();

    const evidenceSection = sectionWithHeading(page, /사실과 해석을/);
    await expect(
      evidenceSection.getByText("직접 진술", { exact: true }),
    ).toBeVisible();
    await expect(
      evidenceSection.getByText("AI 추론", { exact: true }),
    ).toBeVisible();
    await expect(
      evidenceSection.getByText("확인 필요", { exact: true }),
    ).toBeVisible();

    const moduleSummary = profile
      .locator("summary")
      .filter({ hasText: "교사 기본 프로파일과 현재 역할" });
    const moduleDetails = moduleSummary.locator("..");

    await expect(moduleDetails).not.toHaveAttribute("open", "");
    await moduleSummary.focus();
    await expect(moduleSummary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(moduleDetails).toHaveAttribute("open", "");
    await expect(moduleDetails.getByText(/^근거 문장 \d+개$/)).toBeVisible();

    await page.keyboard.press("Space");
    await expect(moduleDetails).not.toHaveAttribute("open", "");

    const taskContextSummary = profile
      .locator("summary")
      .filter({ hasText: "수업 작업 컨텍스트 YAML 미리보기" });
    const taskContextDetails = taskContextSummary.locator("..");

    await expect(taskContextDetails).not.toHaveAttribute("open", "");
    await taskContextSummary.focus();
    await expect(taskContextSummary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(taskContextDetails).toHaveAttribute("open", "");
    await expect(taskContextDetails.locator("code")).toContainText(
      'task_type: "수업 설계 | 슬라이드 | 활동지 | 평가 | 수업 검토"',
    );
    await page.keyboard.press("Space");
    await expect(taskContextDetails).not.toHaveAttribute("open", "");

    const executionGuidanceSummary = profile
      .locator("summary")
      .filter({ hasText: "AI 실행 지침 미리보기" });
    const executionGuidanceDetails = executionGuidanceSummary.locator("..");

    await expect(executionGuidanceDetails).not.toHaveAttribute("open", "");
    await executionGuidanceSummary.focus();
    await expect(executionGuidanceSummary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(executionGuidanceDetails).toHaveAttribute("open", "");
    await expect(
      executionGuidanceDetails.getByText(/질문을 최대 세 개만 한다/),
    ).toBeVisible();
  });

  test("home and examples do not overflow a 320px viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });

    for (const path of ["/", "/examples?school=middle"] as const) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);

      const header = page.getByRole("banner");
      const primaryNav = page.getByRole("navigation", { name: "주요 메뉴" });
      const brandLink = header.getByRole("link", { name: /TContext/ });
      await expect(brandLink).toBeVisible();

      const brandMarkBox = await brandLink
        .locator(":scope > span")
        .first()
        .boundingBox();
      expect(brandMarkBox).not.toBeNull();
      expect(brandMarkBox!.width).toBeGreaterThan(0);
      expect(
        Math.abs(brandMarkBox!.width - brandMarkBox!.height),
      ).toBeLessThanOrEqual(0.5);

      await expect(primaryNav).toBeVisible();
      await expect(
        primaryNav.getByRole("link", { name: "문서 예시" }),
      ).toBeVisible();
    }
  });
});
