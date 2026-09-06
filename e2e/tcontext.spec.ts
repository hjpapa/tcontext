import { readFile } from "node:fs/promises";

import { expect, test, type Page, type Route } from "@playwright/test";

const MODULES = [
  {
    id: "identity_and_role",
    title: "교사 기본 프로파일과 현재 역할",
    summary: "학급 운영과 수업 설계를 함께 책임집니다.",
    claim: {
      id: "claim-direct",
      text: "학생이 자기 생각을 설명할 시간을 중요하게 봅니다.",
      basis: "direct",
      confirmedByUser: true,
    },
  },
  {
    id: "educational_philosophy",
    title: "교육관과 학생관",
    summary: "시도와 수정의 과정을 성장의 증거로 봅니다.",
    claim: {
      id: "claim-inferred",
      text: "작은 성공 경험을 연결하는 피드백을 선호하는 것으로 보입니다.",
      basis: "inferred",
      confirmedByUser: false,
    },
  },
  {
    id: "preferred_teaching",
    title: "선호하는 수업 방식",
    summary: "짧은 안내 뒤 개인 생각과 짝 대화를 연결합니다.",
    claim: {
      id: "claim-needs-confirmation",
      text: "전체 공유 전에 메모 시간을 제공하는 방식을 확인해 주세요.",
      basis: "needs_confirmation",
      confirmedByUser: false,
    },
  },
  {
    id: "class_context",
    title: "현재 학급 또는 수업 집단의 기본 맥락",
    summary: "예측 가능한 순서와 단계별 안내가 참여를 돕습니다.",
    claim: {
      id: "claim-context",
      text: "일부 학생에게는 활동 순서를 눈에 보이게 제공하면 도움이 됩니다.",
      basis: "direct",
      confirmedByUser: true,
    },
  },
  {
    id: "participation_and_emotion",
    title: "학생 참여와 정서 지원 원칙",
    summary: "부담이 낮은 참여 통로를 먼저 엽니다.",
    claim: {
      id: "claim-participation",
      text: "기록과 짝 대화 중 참여 방식을 선택할 수 있게 합니다.",
      basis: "direct",
      confirmedByUser: true,
    },
  },
  {
    id: "materials_assessment_feedback",
    title: "수업 자료·평가·피드백과 의사소통",
    summary: "결과뿐 아니라 질문과 수정 과정을 살핍니다.",
    claim: {
      id: "claim-feedback",
      text: "다음 시도에서 바꿀 한 가지를 구체적으로 안내합니다.",
      basis: "direct",
      confirmedByUser: true,
    },
  },
  {
    id: "environment_and_ai",
    title: "현실적인 환경·제약과 디지털·AI 활용",
    summary: "AI는 초안을 돕고 최종 판단은 교사가 맡습니다.",
    claim: {
      id: "claim-ai",
      text: "AI에 개인정보를 입력하지 않고 결과를 직접 확인합니다.",
      basis: "direct",
      confirmedByUser: true,
    },
  },
] as const;

const emptyConfirmedTags = {
  preferredTeachingMethods: [],
  participationPriorities: [],
  emotionalSupportPriorities: [],
  assessmentPriorities: [],
  environmentConstraints: [],
  aiBoundaries: [],
};

const generatedProfile = {
  metadata: {
    schoolLevel: "elementary",
    role: "homeroom_teacher",
    generatedAt: "2026-07-31T00:00:00.000Z",
    schemaVersion: "1.0",
    modelName: "gpt-5.4-nano",
    promptVersion: "1.3",
  },
  profileTitle: "질문과 작은 성공을 연결하는 교사 컨텍스트",
  shortSummary:
    "짧은 안내와 다양한 참여 통로를 통해 학생의 생각과 수정을 지원합니다.",
  modules: MODULES.map(({ id, title, summary, claim }) => ({
    id,
    title,
    summary,
    claims: [
      {
        ...claim,
        evidenceQuestionIds: ["common-role-focus"],
      },
    ],
  })),
  teachingDesignPrinciples: [
    "핵심 질문을 먼저 제시하고 학생이 생각할 시간을 확보합니다.",
  ],
  classSupportConsiderations: [
    "단계별 안내와 여러 참여 방식을 선택할 수 있게 합니다.",
  ],
  realisticConstraints: ["한 차시 안에 활동과 정리를 마쳐야 합니다."],
  aiCollaborationInstructions: [
    "학생을 평가하거나 진단하지 않고 수업 지원만 제안합니다.",
  ],
  confirmedTags: emptyConfirmedTags,
  privacyReview: { status: "clear", items: [] },
};

const safeAnswer =
  "짧은 안내 뒤 개인 생각과 짝 대화를 연결하고, 수정할 시간을 제공합니다.";
const fixedQuestionCount = 14;
const teacherEditedSummary =
  "교사가 직접 확인한 요약으로, 짧은 안내와 수정 기회를 우선합니다.";

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function startElementaryInterview(page: Page) {
  await page.goto("/interview");

  const privacyConfirmation = page.getByRole("checkbox", {
    name: /개인정보를 입력하지 않으며/,
  });
  await expect(async () => {
    if ((await privacyConfirmation.getAttribute("aria-checked")) !== "true") {
      await privacyConfirmation.click();
    }
    await expect(privacyConfirmation).toBeChecked();
  }).toPass();
  await page.getByRole("button", { name: "확인하고 학교급 선택하기" }).click();

  await expect(
    page.getByRole("heading", {
      name: "지금의 학교급과 역할을 알려주세요.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "초등학교" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "담임교사" })).toBeChecked();
  await page.getByRole("button", { name: "인터뷰 시작하기" }).click();

  await expect(page.getByText(`질문 1 / ${fixedQuestionCount}`)).toBeVisible();
  await expect(page.locator("#interview-answer")).not.toHaveAttribute(
    "placeholder",
  );
  await expect(
    page.getByText("개인정보 없이 답하는 방법", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("개인정보 주의:")).toHaveCount(0);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
}

async function answerFirstQuestionAndFinishInterview(page: Page) {
  await page.getByRole("textbox", { name: "답변" }).fill(safeAnswer);
  await page.getByRole("button", { name: "다음 질문" }).click();
  await expect(page.getByText(`질문 2 / ${fixedQuestionCount}`)).toBeVisible();
  await expect(page.getByText("개인정보 주의:")).toHaveCount(0);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);

  for (
    let questionNumber = 2;
    questionNumber <= fixedQuestionCount;
    questionNumber += 1
  ) {
    await page.getByRole("button", { name: "건너뛰기" }).click();
    if (questionNumber < fixedQuestionCount) {
      await expect(
        page.getByText(`질문 ${questionNumber + 1} / ${fixedQuestionCount}`),
      ).toBeVisible();
    }
  }

  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByTestId("unresolved-count")).toBeVisible();
}

async function approveDraftAndFinishReview(page: Page) {
  await expect(page.getByTestId("unresolved-count")).toHaveText(
    "확인할 문장 2개",
  );
  await page.getByRole("button", { name: "이 추론 승인" }).click();
  await page.getByRole("button", { name: "내용 확인" }).click();
  await expect(page.getByTestId("unresolved-count")).toHaveText(
    "확인할 문장 0개",
  );
  await page
    .getByRole("checkbox", {
      name: /문서 제목, 전체·모듈 요약/,
    })
    .click();

  await page.getByRole("button", { name: "검토 마치고 개인정보 검사" }).click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(
    page.getByRole("heading", {
      name: generatedProfile.profileTitle,
    }),
  ).toBeVisible();
}

test.describe("anonymous teacher-context flow", () => {
  test("requires and sends a controlled subject for middle and high school", async ({
    page,
  }) => {
    let followUpPayload: Record<string, unknown> | null = null;
    await page.route("**/api/interview/follow-up", async (route) => {
      followUpPayload = (await route.request().postDataJSON()) as Record<
        string,
        unknown
      >;
      await fulfillJson(route, { needed: false, question: null });
    });

    await page.goto("/interview");
    await page
      .getByRole("checkbox", { name: /개인정보를 입력하지 않으며/ })
      .click();
    await page
      .getByRole("button", { name: "확인하고 학교급 선택하기" })
      .click();
    await page.getByRole("radio", { name: "중학교" }).click();

    const subjectSelect = page.getByRole("combobox", { name: "담당 교과" });
    await expect(subjectSelect).toBeVisible();
    await page.getByRole("radio", { name: "고등학교" }).click();
    await expect(subjectSelect).toBeVisible();
    await page.getByRole("button", { name: "인터뷰 시작하기" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "담당 교과를 선택해 주세요",
    );

    await subjectSelect.selectOption("science");
    await page.getByRole("button", { name: "인터뷰 시작하기" }).click();
    await page.getByRole("textbox", { name: "답변" }).fill(safeAnswer);
    await page.getByRole("button", { name: "다음 질문" }).click();

    expect(followUpPayload).toMatchObject({
      schoolLevel: "high",
      teachingSubject: "science",
    });
  });

  test("continues when the optional AI follow-up service is unavailable", async ({
    page,
  }) => {
    await page.route("**/api/interview/follow-up", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "ai_invalid_response",
            message: "AI가 검증 가능한 응답을 생성하지 못했습니다.",
          },
        }),
      });
    });

    await startElementaryInterview(page);
    const exampleDetails = page
      .locator("details")
      .filter({ hasText: "답하기 어렵다면 예시 보기" });
    await expect(exampleDetails).not.toHaveAttribute("open", "");
    await exampleDetails.locator("summary").click();
    await expect(
      page.getByText(/^정답이 아닌 짧은 참고 예시입니다\./),
    ).toBeVisible();
    const answerBox = page.getByRole("textbox", { name: "답변" });
    await expect(answerBox).toHaveAttribute("maxlength", "2000");
    await expect(page.getByText("권장 200~800자 · 0 / 2,000자")).toBeVisible();
    await answerBox.fill(safeAnswer);
    await page.getByRole("button", { name: "다음 질문" }).click();

    await expect(page.getByText(/^질문 2 \/ \d+$/)).toBeVisible();
    await expect(exampleDetails).not.toHaveAttribute("open", "");
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });

  test("keeps actionable client errors visible on the current question", async ({
    page,
  }) => {
    await page.route("**/api/interview/follow-up", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "privacy_risk_detected",
            message: "개인정보로 보이는 표현을 바꿔 주세요.",
          },
        }),
      });
    });

    await startElementaryInterview(page);
    await page.getByRole("textbox", { name: "답변" }).fill(safeAnswer);
    await page.getByRole("button", { name: "다음 질문" }).click();

    await expect(page.getByText(/^질문 1 \/ \d+$/)).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "개인정보로 보이는 표현을 바꿔 주세요.",
    );
  });

  test("refines one profile module with AI and keeps the review editable", async ({
    page,
  }) => {
    const refineRequests: Array<Record<string, unknown>> = [];
    const refinedSummary =
      "수정과 재시도를 배움의 중요한 과정으로 해석하는 교육관입니다.";
    const refinedProfile = {
      ...generatedProfile,
      modules: generatedProfile.modules.map((module) =>
        module.id === "educational_philosophy"
          ? { ...module, summary: refinedSummary }
          : module,
      ),
    };

    await page.route("**/api/interview/follow-up", async (route) => {
      await fulfillJson(route, { needed: false, question: null });
    });
    await page.route("**/api/profile/generate", async (route) => {
      await fulfillJson(route, {
        profile: generatedProfile,
        suggestedTags: [],
      });
    });
    await page.route("**/api/profile/refine", async (route) => {
      refineRequests.push(route.request().postDataJSON());
      await fulfillJson(route, { profile: refinedProfile });
    });

    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);

    const philosophyModule = page.getByRole("region", {
      name: "교육관과 학생관",
    });
    const instruction = philosophyModule.getByLabel("이 모듈만 AI로 다시 작성");
    await instruction.fill("교육관이 더 구체적으로 드러나게 작성해 주세요.");
    await philosophyModule
      .getByRole("button", { name: "이 모듈만 다시 작성" })
      .click();

    await expect(
      philosophyModule.getByLabel("모듈 요약 직접 수정"),
    ).toHaveValue(refinedSummary);
    await expect(philosophyModule.getByRole("status")).toContainText(
      "이 모듈을 다시 작성했습니다.",
    );
    await expect(instruction).toHaveValue("");
    expect(refineRequests).toHaveLength(1);
    expect(refineRequests[0]).toMatchObject({
      moduleId: "educational_philosophy",
      instruction: "교육관이 더 구체적으로 드러나게 작성해 주세요.",
    });
  });

  test("keeps the module and instruction when AI refinement fails", async ({
    page,
  }) => {
    const instructionText =
      "교육관이 실제 수업 장면과 연결되도록 다시 작성해 주세요.";
    const safeErrorMessage =
      "AI 재작성 서비스를 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
    const philosophyModuleBeforeRefine = generatedProfile.modules.find(
      (module) => module.id === "educational_philosophy",
    );

    await page.route("**/api/interview/follow-up", async (route) => {
      await fulfillJson(route, { needed: false, question: null });
    });
    await page.route("**/api/profile/generate", async (route) => {
      await fulfillJson(route, {
        profile: generatedProfile,
        suggestedTags: [],
      });
    });
    await page.route("**/api/profile/refine", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "ai_service_unavailable",
            message: safeErrorMessage,
          },
        }),
      });
    });

    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);

    const philosophyModule = page.getByRole("region", {
      name: "교육관과 학생관",
    });
    const summary = philosophyModule.getByLabel("모듈 요약 직접 수정");
    const claim = philosophyModule.getByLabel("문장 직접 수정");
    const instruction = philosophyModule.getByLabel("이 모듈만 AI로 다시 작성");
    const refineButton = philosophyModule.getByRole("button", {
      name: "이 모듈만 다시 작성",
    });

    await instruction.fill(instructionText);
    await refineButton.click();

    const errorAlert = philosophyModule
      .getByRole("alert")
      .filter({ hasText: "이 모듈을 다시 작성하지 못했습니다" });
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toBeFocused();
    await expect(errorAlert).toContainText(safeErrorMessage);
    await expect(summary).toHaveValue(philosophyModuleBeforeRefine!.summary);
    await expect(claim).toHaveValue(
      philosophyModuleBeforeRefine!.claims[0]!.text,
    );
    await expect(instruction).toHaveValue(instructionText);
    await expect(refineButton).toBeEnabled();
  });

  test("shows a privacy block next to the module without echoing private text", async ({
    page,
  }) => {
    await page.route("**/api/interview/follow-up", async (route) => {
      await fulfillJson(route, { needed: false, question: null });
    });
    await page.route("**/api/profile/generate", async (route) => {
      await fulfillJson(route, {
        profile: generatedProfile,
        suggestedTags: [],
      });
    });
    await page.route("**/api/profile/refine", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "privacy_risk_detected",
            message:
              "이름·연락처 등 명확한 직접 식별정보를 제거한 뒤 다시 시도해 주세요.",
            details: {
              findings: [
                {
                  category: "student_name",
                  path: "profile.modules.1.claims.0.text",
                },
              ],
            },
          },
        }),
      });
    });

    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);

    const philosophyModule = page.getByRole("region", {
      name: "교육관과 학생관",
    });
    await philosophyModule
      .getByLabel("이 모듈만 AI로 다시 작성")
      .fill("수업 장면이 더 잘 드러나게 작성해 주세요.");
    await philosophyModule
      .getByRole("button", { name: "이 모듈만 다시 작성" })
      .click();

    const errorAlert = philosophyModule.getByRole("alert");
    await expect(errorAlert).toBeFocused();
    await expect(errorAlert).toContainText(
      "이름·연락처 등 명확한 직접 식별정보를 제거한 뒤 다시 시도해 주세요.",
    );
    await expect(errorAlert).toContainText("교육관과 학생관 문장 1");
    await expect(errorAlert).not.toContainText("홍길동");

    const locationButton = errorAlert.getByRole("button", {
      name: "교육관과 학생관 문장 1 항목으로 이동",
    });
    await locationButton.click();
    await expect(philosophyModule.getByLabel("문장 직접 수정")).toBeFocused();
  });

  test("confirms every non-empty unresolved claim only after explicit bulk confirmation", async ({
    page,
  }) => {
    await page.route("**/api/interview/follow-up", async (route) => {
      await fulfillJson(route, { needed: false, question: null });
    });
    await page.route("**/api/profile/generate", async (route) => {
      await fulfillJson(route, {
        profile: generatedProfile,
        suggestedTags: [
          { category: "preferredTeachingMethods", tag: "inquiry" },
        ],
      });
    });

    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);

    await page.getByRole("button", { name: "남은 문장 한 번에 확인" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("AI 추론 1개");
    await expect(dialog).toContainText("확인 필요 문장 1개");
    await dialog.getByRole("button", { name: "2개 모두 확인" }).click();

    const unresolvedCount = page.getByTestId("unresolved-count");
    await expect(unresolvedCount).toHaveText("확인할 문장 0개");
    await expect(unresolvedCount).toBeFocused();
    await expect(
      page.getByText("AI 추론", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "탐구" }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /문서 제목, 전체·모듈 요약/ }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("button", { name: "남은 문장 한 번에 확인" }),
    ).toHaveCount(0);
  });

  test("ignores a late AI refinement after the teacher edits the module", async ({
    page,
  }) => {
    const teacherSummary =
      "교사가 직접 고친 요약으로, 학생의 수정 과정과 질문을 함께 살핍니다.";
    const teacherClaim =
      "학생이 스스로 고친 이유를 설명할 시간을 수업 안에 마련합니다.";
    const lateAiSummary = "늦게 도착한 AI 요약은 적용되면 안 됩니다.";
    const lateAiClaim = "늦게 도착한 AI 문장도 적용되면 안 됩니다.";
    const lateProfile = {
      ...generatedProfile,
      modules: generatedProfile.modules.map((module) =>
        module.id === "educational_philosophy"
          ? {
              ...module,
              summary: lateAiSummary,
              claims: module.claims.map((claim) => ({
                ...claim,
                text: lateAiClaim,
              })),
            }
          : module,
      ),
    };
    let releaseRefinement: (() => void) | undefined;
    const refinementGate = new Promise<void>((resolve) => {
      releaseRefinement = resolve;
    });
    let markRequestReceived: (() => void) | undefined;
    const requestReceived = new Promise<void>((resolve) => {
      markRequestReceived = resolve;
    });

    await page.route("**/api/interview/follow-up", async (route) => {
      await fulfillJson(route, { needed: false, question: null });
    });
    await page.route("**/api/profile/generate", async (route) => {
      await fulfillJson(route, {
        profile: generatedProfile,
        suggestedTags: [],
      });
    });
    await page.route("**/api/profile/refine", async (route) => {
      markRequestReceived?.();
      await refinementGate;
      await fulfillJson(route, { profile: lateProfile });
    });

    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);

    const philosophyModule = page.getByRole("region", {
      name: "교육관과 학생관",
    });
    const summary = philosophyModule.getByLabel("모듈 요약 직접 수정");
    const claim = philosophyModule.getByLabel("문장 직접 수정");
    const instruction = philosophyModule.getByLabel("이 모듈만 AI로 다시 작성");
    const refineButton = philosophyModule.getByRole("button", {
      name: "이 모듈만 다시 작성",
    });

    await instruction.fill("교육관을 더 생생하게 다시 작성해 주세요.");
    await refineButton.click();
    await requestReceived;
    await expect(
      philosophyModule.getByRole("button", {
        name: "이 모듈 다시 작성 중",
      }),
    ).toBeDisabled();

    await summary.fill(teacherSummary);
    await claim.fill(teacherClaim);
    releaseRefinement?.();

    const raceConditionAlert = philosophyModule
      .getByRole("alert")
      .filter({ hasText: "이 모듈을 다시 작성하지 못했습니다" });
    await expect(raceConditionAlert).toBeFocused();
    await expect(raceConditionAlert).toContainText(
      "AI가 작성하는 동안 문서가 수정되어 새 결과를 적용하지 않았습니다.",
    );
    await expect(summary).toHaveValue(teacherSummary);
    await expect(claim).toHaveValue(teacherClaim);
    await expect(summary).not.toHaveValue(lateAiSummary);
    await expect(claim).not.toHaveValue(lateAiClaim);
    await expect(instruction).toHaveValue(
      "교육관을 더 생생하게 다시 작성해 주세요.",
    );
    await expect(refineButton).toBeEnabled();
  });

  test("ignores a stale privacy result when the teacher edits during the check", async ({
    page,
  }) => {
    const latestSummary =
      "개인정보 검사 중 교사가 직접 고친 최신 요약을 유지합니다.";
    const privacyRequests: Array<Record<string, unknown>> = [];
    let releasePrivacyReview = () => {};
    const privacyReviewGate = new Promise<void>((resolve) => {
      releasePrivacyReview = resolve;
    });
    let markPrivacyRequestReceived = () => {};
    const privacyRequestReceived = new Promise<void>((resolve) => {
      markPrivacyRequestReceived = resolve;
    });

    await page.route("**/api/interview/follow-up", async (route) => {
      await fulfillJson(route, { needed: false, question: null });
    });
    await page.route("**/api/profile/generate", async (route) => {
      await fulfillJson(route, {
        profile: generatedProfile,
        suggestedTags: [
          { category: "preferredTeachingMethods", tag: "inquiry" },
        ],
      });
    });
    await page.route("**/api/privacy/review", async (route) => {
      privacyRequests.push(route.request().postDataJSON());
      markPrivacyRequestReceived();
      await privacyReviewGate;
      await fulfillJson(route, {
        source: "openai",
        review: { status: "clear", items: [] },
      });
    });

    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);

    await page.getByRole("button", { name: "이 추론 승인" }).click();
    await page.getByRole("button", { name: "내용 확인" }).click();
    const synthesisConfirmation = page.getByRole("checkbox", {
      name: /문서 제목, 전체·모듈 요약/,
    });
    await synthesisConfirmation.click();

    const privacyButton = page.getByRole("button", {
      name: "검토 마치고 개인정보 검사",
    });
    await privacyButton.click();
    await privacyRequestReceived;
    await expect(
      page.getByRole("button", { name: "개인정보 최종 검사 중" }),
    ).toBeDisabled();

    const summary = page.getByLabel("전체 요약 직접 수정");
    const suggestedTag = page.getByRole("checkbox", { name: "탐구" });
    await summary.fill(latestSummary);
    await suggestedTag.click();
    releasePrivacyReview();

    const staleReviewAlert = page
      .getByRole("alert")
      .filter({ hasText: "검토를 마칠 수 없습니다" });
    await expect(staleReviewAlert).toContainText(
      "개인정보 검사 중 문서가 수정되어 이전 검사 결과를 적용하지 않았습니다. 현재 내용을 확인한 뒤 다시 검사해 주세요.",
    );
    await expect(page).toHaveURL(/\/review$/);
    await expect(summary).toHaveValue(latestSummary);
    await expect(suggestedTag).toBeChecked();
    await expect(synthesisConfirmation).not.toBeChecked();
    await expect(
      page.getByText("개인정보 최종 검사를 통과했습니다.", { exact: true }),
    ).toHaveCount(0);
    await expect(privacyButton).toBeEnabled();
    expect(privacyRequests).toHaveLength(1);
    const staleRequest = privacyRequests[0] as {
      profile?: {
        shortSummary?: string;
        confirmedTags?: Record<string, unknown[]>;
      };
    };
    expect(staleRequest.profile?.shortSummary).toBe(
      generatedProfile.shortSummary,
    );
    expect(staleRequest.profile?.confirmedTags).toEqual(emptyConfirmedTags);
  });

  test("blocks PII locally, completes review, and exports without contribution", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const followUpRequests: Array<Record<string, unknown>> = [];
    const profileRequests: Array<Record<string, unknown>> = [];
    const privacyRequests: Array<Record<string, unknown>> = [];
    let contributionRequestCount = 0;

    await page.route("**/api/interview/follow-up", async (route) => {
      followUpRequests.push(route.request().postDataJSON());
      await fulfillJson(route, { needed: false, question: null });
    });
    await page.route("**/api/profile/generate", async (route) => {
      profileRequests.push(route.request().postDataJSON());
      await fulfillJson(route, {
        profile: generatedProfile,
        suggestedTags: [
          { category: "preferredTeachingMethods", tag: "inquiry" },
        ],
      });
    });
    await page.route("**/api/privacy/review", async (route) => {
      privacyRequests.push(route.request().postDataJSON());
      await fulfillJson(route, {
        source: "openai",
        review: { status: "clear", items: [] },
      });
    });
    await page.route("**/api/submissions/create", async (route) => {
      contributionRequestCount += 1;
      await fulfillJson(route, {
        submissionId: "unexpected-submission",
        deletionToken: "unexpected-token",
        createdAt: "2026-07-31T00:00:00.000Z",
        retentionUntil: "2027-07-30T00:00:00.000Z",
      });
    });

    await startElementaryInterview(page);

    const answerBox = page.getByRole("textbox", { name: "답변" });
    const privateAnswer = "김민수 학생의 전화번호는 010-1234-5678입니다.";
    await answerBox.fill(privateAnswer);
    await page.getByRole("button", { name: "다음 질문" }).click();

    await expect(
      page.getByRole("heading", {
        name: "전송 전에 이 표현을 바꿔 주세요.",
      }),
    ).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(1);
    await expect(
      page.locator("mark").filter({ hasText: "김민수 학생" }),
    ).toBeVisible();
    await expect(
      page.locator("mark").filter({ hasText: "010-1234-5678" }),
    ).toBeVisible();
    await expect(
      page.getByText(`질문 1 / ${fixedQuestionCount}`),
    ).toBeVisible();
    expect(followUpRequests).toHaveLength(0);

    await answerFirstQuestionAndFinishInterview(page);
    expect(followUpRequests).toHaveLength(1);
    expect(JSON.stringify(followUpRequests[0])).toContain(safeAnswer);
    expect(JSON.stringify(followUpRequests[0])).not.toContain("010-1234-5678");

    expect(profileRequests).toHaveLength(1);
    const generationPayload = JSON.stringify(profileRequests[0]);
    expect(generationPayload).toContain(safeAnswer);
    expect(generationPayload).not.toContain(privateAnswer);
    await expect(page.getByTestId("unresolved-count")).toHaveText(
      "확인할 문장 2개",
    );
    await expect(
      page.getByText("AI 추론", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("확인 필요", { exact: true }).first(),
    ).toBeVisible();

    const draftDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "검토 중 초안 Markdown 다운로드" })
      .click();
    const draftDownload = await draftDownloadPromise;
    const draftPath = await draftDownload.path();
    expect(draftPath).not.toBeNull();
    const draftMarkdown = await readFile(draftPath!, "utf8");
    expect(draftMarkdown).toContain('privacy_review: "needs_review"');
    expect(draftMarkdown).toContain("**개인정보 경고:**");

    await page.getByRole("button", { name: "이 추론 승인" }).click();
    await page.getByRole("button", { name: "내용 확인" }).click();
    await expect(page.getByTestId("unresolved-count")).toHaveText(
      "확인할 문장 0개",
    );
    await expect(
      page.getByRole("checkbox", { name: "탐구" }),
    ).not.toBeChecked();
    await page.getByLabel("전체 요약 직접 수정").fill(teacherEditedSummary);
    await page
      .getByRole("button", { name: "수업 설계 원칙 문장 1 삭제" })
      .click();
    await page
      .getByRole("checkbox", {
        name: /문서 제목, 전체·모듈 요약/,
      })
      .click();

    await page
      .getByRole("button", { name: "검토 마치고 개인정보 검사" })
      .click();
    await expect(page).toHaveURL(/\/result$/);
    await expect(
      page.getByRole("heading", {
        name: "질문과 작은 성공을 연결하는 교사 컨텍스트",
      }),
    ).toBeVisible();
    expect(privacyRequests).toHaveLength(1);
    const reviewPayload = privacyRequests[0] as {
      profile?: {
        shortSummary?: string;
        teachingDesignPrinciples?: string[];
        confirmedTags?: Record<string, unknown[]>;
      };
    };
    expect(reviewPayload.profile?.confirmedTags).toEqual(emptyConfirmedTags);
    expect(reviewPayload.profile?.shortSummary).toBe(teacherEditedSummary);
    expect(reviewPayload.profile?.teachingDesignPrinciples).toEqual([]);

    const consent = page.getByRole("checkbox", {
      name: /검토한 최종 프로필을 선택적으로 기여/,
    });
    await expect(consent).not.toBeChecked();
    await expect(
      page.getByRole("button", { name: "동의하고 데이터 기여" }),
    ).toBeDisabled();
    expect(contributionRequestCount).toBe(0);

    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "수업 설계용 Markdown 다운로드" })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^tcontext-teacher-profile-elementary-\d{8}\.md$/,
    );
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const markdown = await readFile(downloadPath!, "utf8");
    expect(markdown).toContain(`# ${generatedProfile.profileTitle}`);
    expect(markdown).toContain(teacherEditedSummary);
    expect(markdown).toContain("AI가 답변을 종합해 해석한 내용");
    expect(markdown).toContain("# 수업마다 추가할 작업 컨텍스트");
    expect(markdown).toContain("# AI에게 바로 전달할 실행 프롬프트");
    expect(markdown).not.toContain(privateAnswer);
    expect(contributionRequestCount).toBe(0);

    const browserStorage = await page.evaluate(() =>
      [window.sessionStorage, window.localStorage]
        .flatMap((storage) =>
          Array.from({ length: storage.length }, (_, index) => {
            const key = storage.key(index);
            return key ? `${key}:${storage.getItem(key)}` : "";
          }),
        )
        .join("\n"),
    );
    expect(browserStorage).not.toContain(privateAnswer);
    expect(browserStorage).not.toContain(safeAnswer);
  });

  test("resets a stale privacy warning and allows an explicit local-only result", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const privacyRequests: Array<Record<string, unknown>> = [];
    let contributionRequestCount = 0;
    await page.route("**/api/interview/follow-up", async (route) => {
      await fulfillJson(route, { needed: false, question: null });
    });
    await page.route("**/api/profile/generate", async (route) => {
      await fulfillJson(route, {
        profile: generatedProfile,
        suggestedTags: [],
      });
    });
    await page.route("**/api/privacy/review", async (route) => {
      const request = route.request().postDataJSON() as {
        profile?: { shortSummary?: string };
      };
      privacyRequests.push(request);
      await fulfillJson(route, {
        source: "openai",
        review: {
          status: "needs_review",
          items: [
            {
              text: request.profile?.shortSummary ?? "확인이 필요한 문장",
              reason: "자동 검사에서 확인이 필요한 표현입니다.",
              suggestedRewrite:
                "개인을 특정하지 않는 수업 지원으로 바꿔 주세요.",
            },
          ],
        },
      });
    });
    await page.route("**/api/submissions/create", async (route) => {
      contributionRequestCount += 1;
      await fulfillJson(route, { unexpected: true });
    });

    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);

    await page.getByRole("button", { name: "이 추론 승인" }).click();
    await page.getByRole("button", { name: "내용 확인" }).click();
    await page
      .getByRole("checkbox", {
        name: /문서 제목, 전체·모듈 요약/,
      })
      .click();
    await page
      .getByRole("button", { name: "검토 마치고 개인정보 검사" })
      .click();

    await expect(page).toHaveURL(/\/review$/);
    await expect(
      page.getByText("명확한 직접 식별정보로 보이는 내용이 있습니다.", {
        exact: true,
      }),
    ).toBeVisible();
    const privacyLocationButton = page.getByRole("button", {
      name: "전체 문서 요약 항목으로 이동",
    });
    await privacyLocationButton.click();
    await expect(page.getByLabel("전체 요약 직접 수정")).toBeFocused();
    const continueButton = page.getByRole("button", {
      name: "경고 확인하고 결과 보기",
    });
    await expect(continueButton).toBeDisabled();

    await page.getByLabel("전체 요약 직접 수정").fill(teacherEditedSummary);
    await expect(
      page.getByText("명확한 직접 식별정보로 보이는 내용이 있습니다.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(continueButton).toHaveCount(0);

    await page
      .getByRole("checkbox", {
        name: /문서 제목, 전체·모듈 요약/,
      })
      .click();
    await page
      .getByRole("button", { name: "검토 마치고 개인정보 검사" })
      .click();

    expect(privacyRequests).toHaveLength(2);
    const secondPrivacyPayload = privacyRequests[1] as {
      profile?: { privacyReview?: unknown; shortSummary?: string };
    };
    expect(secondPrivacyPayload.profile?.privacyReview).toEqual({
      status: "needs_review",
      items: [
        {
          text: "최종 개인정보 검사를 완료하지 않은 초안",
          reason: "현재 내용은 최종 개인정보 검사를 다시 받아야 합니다.",
          suggestedRewrite:
            "검토를 마친 뒤 최종 개인정보 검사를 실행해 주세요.",
        },
      ],
    });
    expect(secondPrivacyPayload.profile?.shortSummary).toBe(
      teacherEditedSummary,
    );

    const warningConfirmation = page.getByRole("checkbox", {
      name: /식별 가능한 정보가 남아 있을 수 있음을 이해했습니다/,
    });
    const secondContinueButton = page.getByRole("button", {
      name: "경고 확인하고 결과 보기",
    });
    await expect(warningConfirmation).not.toBeChecked();
    await expect(secondContinueButton).toBeDisabled();
    await warningConfirmation.click();
    await expect(secondContinueButton).toBeEnabled();
    await secondContinueButton.click();

    await expect(page).toHaveURL(/\/result$/);
    await expect(
      page.getByText("개인정보 경고를 확인하고 만든 문서", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "개인정보 경고가 남아 있어 이 문서는 서버에 기여할 수 없습니다.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "동의하고 데이터 기여" }),
    ).toHaveCount(0);
    expect(contributionRequestCount).toBe(0);

    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "수업 설계용 Markdown 다운로드" })
      .click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const markdown = await readFile(downloadPath!, "utf8");
    expect(markdown).toContain('privacy_review: "needs_review"');
    expect(markdown).toContain("**개인정보 경고:**");
    expect(markdown).toContain(teacherEditedSummary);
    expect(contributionRequestCount).toBe(0);
  });

  test("contributes only the reviewed profile, downloads its receipt, and deletes it", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const privacyRequests: Array<Record<string, unknown>> = [];
    const contributionRequests: Array<Record<string, unknown>> = [];
    const deletionRequests: Array<Record<string, unknown>> = [];
    const receipt = {
      submissionId: "123e4567-e89b-42d3-a456-426614174000",
      deletionToken: "delete-token-with-at-least-32-characters-12345",
      createdAt: "2026-07-31T01:02:03.000Z",
      retentionUntil: "2027-07-30T01:02:03.000Z",
    };

    await page.route("**/api/interview/follow-up", async (route) => {
      await fulfillJson(route, { needed: false, question: null });
    });
    await page.route("**/api/profile/generate", async (route) => {
      await fulfillJson(route, {
        profile: generatedProfile,
        suggestedTags: [
          { category: "preferredTeachingMethods", tag: "inquiry" },
        ],
      });
    });
    await page.route("**/api/privacy/review", async (route) => {
      privacyRequests.push(route.request().postDataJSON());
      await fulfillJson(route, {
        source: "openai",
        review: { status: "clear", items: [] },
      });
    });
    await page.route("**/api/submissions/create", async (route) => {
      contributionRequests.push(route.request().postDataJSON());
      await fulfillJson(route, receipt);
    });
    await page.route("**/api/submissions/delete", async (route) => {
      deletionRequests.push(route.request().postDataJSON());
      await fulfillJson(route, { deleted: true });
    });

    await startElementaryInterview(page);
    await answerFirstQuestionAndFinishInterview(page);
    await approveDraftAndFinishReview(page);

    const consent = page.getByRole("checkbox", {
      name: /검토한 최종 프로필을 선택적으로 기여/,
    });
    const contributeButton = page.getByRole("button", {
      name: "동의하고 데이터 기여",
    });
    await expect(
      page.getByText(/실제 보유 기간은 최대 365일입니다/),
    ).toBeVisible();
    await expect(
      page.getByText(/제출 364일 뒤 자동 삭제 대상으로 전환됩니다/),
    ).toBeVisible();
    await expect(consent).not.toBeChecked();
    await expect(contributeButton).toBeDisabled();
    await consent.click();
    await expect(consent).toBeChecked();
    await expect(contributeButton).toBeEnabled();
    await contributeButton.click();

    await expect(
      page.getByRole("heading", { name: "선택적 기여가 완료되었습니다." }),
    ).toBeVisible();
    expect(contributionRequests).toHaveLength(1);

    const contributionPayload = contributionRequests[0] as {
      profile?: Record<string, unknown>;
      profileMarkdown?: string;
      confirmedTags?: Record<string, unknown[]>;
      privacyReview?: Record<string, unknown>;
      consentAccepted?: boolean;
      consentVersion?: string;
    };
    const privacyPayload = privacyRequests[0] as {
      profile?: Record<string, unknown>;
    };
    expect(privacyRequests).toHaveLength(1);
    expect(Object.keys(contributionPayload).sort()).toEqual(
      [
        "confirmedTags",
        "consentAccepted",
        "consentVersion",
        "privacyReview",
        "profile",
        "profileMarkdown",
      ].sort(),
    );
    expect(contributionPayload.consentAccepted).toBe(true);
    expect(contributionPayload.consentVersion).toBe("1.0");
    const { privacyReview: pendingReview, ...privacyRequestProfile } =
      privacyPayload.profile ?? {};
    const { privacyReview: contributedReview, ...contributedProfile } =
      contributionPayload.profile ?? {};
    expect(contributedProfile).toEqual(privacyRequestProfile);
    expect(pendingReview).toMatchObject({ status: "needs_review" });
    expect(contributedReview).toEqual({ status: "clear", items: [] });
    expect(contributionPayload.confirmedTags).toEqual(
      contributionPayload.profile?.confirmedTags,
    );
    expect(contributionPayload.privacyReview).toEqual(
      contributionPayload.profile?.privacyReview,
    );
    expect(contributionPayload.profileMarkdown).toContain(
      `# ${generatedProfile.profileTitle}`,
    );
    expect(contributionPayload.profileMarkdown).toContain(
      'document_format_version: "2.0"',
    );
    expect(contributionPayload.profileMarkdown).toContain(
      generatedProfile.shortSummary,
    );
    expect(contributionPayload.profileMarkdown).toContain(
      "작은 성공 경험을 연결하는 피드백",
    );

    const serializedContribution = JSON.stringify(contributionPayload);
    expect(contributionPayload).not.toHaveProperty("answers");
    expect(contributionPayload.profile).not.toHaveProperty("answers");
    expect(serializedContribution).not.toContain(safeAnswer);
    expect(serializedContribution).not.toContain('"answer":');

    await expect(page.getByText(receipt.submissionId)).toBeVisible();
    await expect(page.getByText(receipt.deletionToken)).toBeVisible();
    await expect(page.getByText("자동 삭제 대상 전환")).toBeVisible();
    const expectedDeletionUrl = new URL("/delete", page.url()).toString();
    const receiptDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "삭제 정보 영수증 다운로드" })
      .click();
    const receiptDownload = await receiptDownloadPromise;
    expect(receiptDownload.suggestedFilename()).toBe(
      `tcontext-submission-receipt-${receipt.submissionId}.txt`,
    );
    const receiptPath = await receiptDownload.path();
    expect(receiptPath).not.toBeNull();
    const receiptText = await readFile(receiptPath!, "utf8");
    expect(receiptText).toContain(`제출 ID: ${receipt.submissionId}`);
    expect(receiptText).toContain(`삭제 코드: ${receipt.deletionToken}`);
    expect(receiptText).toContain(`삭제 페이지: ${expectedDeletionUrl}`);
    expect(receiptText).toContain(
      "삭제 코드를 분실하면 로그인이나 이메일로 제출 데이터를 찾거나 삭제하기 어렵습니다.",
    );

    await page.getByRole("link", { name: "지금 삭제 화면 열기" }).click();
    await expect(page).toHaveURL(/\/delete$/);
    await page.getByLabel("제출 ID").fill(receipt.submissionId);
    await page.getByLabel("삭제 코드").fill(receipt.deletionToken);
    await page.getByRole("button", { name: "기여 데이터 영구 삭제" }).click();

    await expect(
      page.getByRole("heading", { name: "기여 데이터를 삭제했습니다." }),
    ).toBeVisible();
    expect(deletionRequests).toEqual([
      {
        submissionId: receipt.submissionId,
        deletionToken: receipt.deletionToken,
      },
    ]);
  });
});
