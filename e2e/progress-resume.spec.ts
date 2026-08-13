import { expect, test } from "@playwright/test";

import { createInterviewState, setInterviewAnswer } from "../src/lib/interview";
import {
  SESSION_PROGRESS_KEY,
  toStoredInterviewProgress,
} from "../src/lib/storage";

test("restores only the question position and explains that answers were not restored", async ({
  page,
}) => {
  const initial = createInterviewState({
    schoolLevel: "elementary",
    role: "homeroom_teacher",
    privacyNoticeAccepted: true,
    now: "2026-08-10T00:00:00.000Z",
  });
  const firstQuestion = initial.questions[0];
  if (!firstQuestion) throw new Error("Expected an interview question");
  const privateAnswer = "복원되어서는 안 되는 실제 인터뷰 답변";
  const progressed = {
    ...setInterviewAnswer(
      initial,
      firstQuestion.id,
      privateAnswer,
      "answered",
      "2026-08-10T00:01:00.000Z",
    ),
    currentQuestionIndex: 3,
  };
  const serialized = JSON.stringify(toStoredInterviewProgress(progressed));

  await page.addInitScript(
    ({ key, progress }) => window.sessionStorage.setItem(key, progress),
    { key: SESSION_PROGRESS_KEY, progress: serialized },
  );
  await page.goto("/interview");

  await expect(page.getByText("진행 위치만 복원했어요")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "새 수업을 준비할 때 가장 먼저 정하는 것은 무엇인가요?",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/이전에 처리한 1개 질문의 내용은 복원되지 않았고/),
  ).toBeVisible();
  await expect(page.getByText(/답변 0개/)).toBeVisible();
  await expect(page.getByLabel("답변")).toHaveValue("");

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
  expect(browserStorage).not.toContain('"answers"');
});
