import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { InterviewSessionProvider } from "@/components/layout/interview-session-provider";
import { createInterviewState } from "@/lib/interview";

import { InterviewFlow } from "./interview-flow";

const FIRST_ANSWER = "학생이 자신의 생각을 설명하고 수정했을 때입니다.";
const SECOND_ANSWER = "짧은 안내 뒤에 짝 대화를 이어 갑니다.";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function startInterview() {
  const user = userEvent.setup();
  render(
    <InterviewSessionProvider>
      <InterviewFlow />
    </InterviewSessionProvider>,
  );
  await user.click(await screen.findByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: "확인하고 학교급 선택하기" }),
  );
  await user.click(screen.getByRole("button", { name: /인터뷰 시작하기/u }));
  return user;
}

describe("InterviewFlow privacy blocks", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("names the earlier answer a server privacy block points to and reopens it", async () => {
    const questions = createInterviewState({
      schoolLevel: "elementary",
      role: "homeroom_teacher",
      privacyNoticeAccepted: true,
    }).questions;
    const [first, second] = questions;
    if (!first || !second) throw new Error("Expected interview questions");

    const noFollowUp = async () =>
      jsonResponse({ needed: false, question: null });
    const fetchMock = vi
      .fn(noFollowUp)
      .mockImplementationOnce(noFollowUp)
      .mockImplementationOnce(async () =>
        jsonResponse(
          {
            error: {
              code: "privacy_risk_detected",
              message:
                "이름·연락처 등 명확한 직접 식별정보를 제거한 뒤 다시 시도해 주세요.",
              details: {
                findings: [
                  {
                    category: "student_name",
                    path: "previousAnswers.0.answer",
                  },
                ],
              },
            },
          },
          422,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const user = await startInterview();
    const answerBox = () => screen.getByRole("textbox", { name: "답변" });

    await user.type(answerBox(), FIRST_ANSWER);
    await user.click(screen.getByRole("button", { name: /다음 질문/u }));
    expect(
      await screen.findByRole("heading", { level: 1, name: second.prompt }),
    ).toBeInTheDocument();

    await user.type(answerBox(), SECOND_ANSWER);
    await user.click(screen.getByRole("button", { name: /다음 질문/u }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`질문 1. ${first.prompt}`);
    expect(alert).not.toHaveTextContent(FIRST_ANSWER);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await user.click(
      within(alert).getByRole("button", { name: "이 답변 고치기" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: first.prompt }),
    ).toBeInTheDocument();
    expect(answerBox()).toHaveValue(FIRST_ANSWER);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // The answer entered when the block happened is kept for the return trip.
    await user.click(screen.getByRole("button", { name: /다음 질문/u }));
    expect(
      await screen.findByRole("heading", { level: 1, name: second.prompt }),
    ).toBeInTheDocument();
    expect(answerBox()).toHaveValue(SECOND_ANSWER);
  });
});
