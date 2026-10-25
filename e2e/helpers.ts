import { expect, type Page, type Route } from "@playwright/test";

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

export {
  MODULES,
  emptyConfirmedTags,
  generatedProfile,
  safeAnswer,
  fixedQuestionCount,
  teacherEditedSummary,
  fulfillJson,
  startElementaryInterview,
  answerFirstQuestionAndFinishInterview,
  approveDraftAndFinishReview,
};
