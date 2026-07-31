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
    promptVersion: "1.0",
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
  await privacyConfirmation.click();
  await expect(privacyConfirmation).toBeChecked();
  await page.getByRole("button", { name: "확인하고 학교급 선택하기" }).click();

  await expect(
    page.getByRole("heading", {
      name: "지금의 학교급과 역할을 알려주세요.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "초등학교" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "담임교사" })).toBeChecked();
  await page.getByRole("button", { name: "14개 질문 시작하기" }).click();

  await expect(page.getByText("질문 1 / 14")).toBeVisible();
}

async function answerFirstQuestionAndFinishInterview(page: Page) {
  await page.getByRole("textbox", { name: "답변" }).fill(safeAnswer);
  await page.getByRole("button", { name: "다음 질문" }).click();
  await expect(page.getByText("질문 2 / 14")).toBeVisible();

  for (let questionNumber = 2; questionNumber <= 14; questionNumber += 1) {
    await page.getByRole("button", { name: "건너뛰기" }).click();
    if (questionNumber < 14) {
      await expect(
        page.getByText(`질문 ${questionNumber + 1} / 14`),
      ).toBeVisible();
    }
  }

  await expect(page).toHaveURL(/\/review$/);
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
      page.getByText(/개인정보 또는 개인을 규정하는 표현이 감지되어/),
    ).toBeVisible();
    await expect(
      page.locator("mark").filter({ hasText: "김민수 학생" }),
    ).toBeVisible();
    await expect(
      page.locator("mark").filter({ hasText: "010-1234-5678" }),
    ).toBeVisible();
    await expect(page.getByText("질문 1 / 14")).toBeVisible();
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
    await page.getByRole("button", { name: "Markdown 다운로드" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^tcontext-teacher-profile-elementary-\d{8}\.md$/,
    );
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const markdown = await readFile(downloadPath!, "utf8");
    expect(markdown).toContain("# AI 활용을 위한 교사 프로파일 컨텍스트");
    expect(markdown).toContain(teacherEditedSummary);
    expect(markdown).toContain("AI가 답변을 종합해 해석함");
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
    expect(contributionPayload.profile).toEqual(privacyPayload.profile);
    expect(contributionPayload.confirmedTags).toEqual(
      contributionPayload.profile?.confirmedTags,
    );
    expect(contributionPayload.privacyReview).toEqual(
      contributionPayload.profile?.privacyReview,
    );
    expect(contributionPayload.profileMarkdown).toContain(
      "# AI 활용을 위한 교사 프로파일 컨텍스트",
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
