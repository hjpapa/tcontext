import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { InterviewSessionProvider } from "@/components/layout/interview-session-provider";
import { createInterviewState } from "@/lib/interview";

import { InterviewFlow } from "./interview-flow";

const FLAGGED_ANSWER = "김민수 학생은 토론에서 질문을 먼저 합니다.";
const SAFE_ANSWER = "학생이 자신의 생각을 설명하고 수정했을 때입니다.";

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

function interviewQuestions() {
  const [first, second] = createInterviewState({
    schoolLevel: "elementary",
    role: "homeroom_teacher",
    privacyNoticeAccepted: true,
  }).questions;
  if (!first || !second) throw new Error("Expected interview questions");
  return { first, second };
}

describe("InterviewFlow privacy warnings", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("warns about a flagged answer and continues only when the teacher chooses to", async () => {
    const { first, second } = interviewQuestions();
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ needed: false, question: null }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = await startInterview();
    const answerBox = () => screen.getByRole("textbox", { name: "답변" });

    await user.type(answerBox(), FLAGGED_ANSWER);
    await user.click(screen.getByRole("button", { name: /다음 질문/u }));

    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent("개인정보로 보이는 표현이 있습니다.");
    expect(warning).toHaveTextContent("김민수 학생");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { level: 1, name: first.prompt }),
    ).toBeInTheDocument();

    await user.click(
      within(warning).getByRole("button", { name: /그대로 계속/u }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: second.prompt }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      current: { answer: string };
    };
    expect(body.current.answer).toBe(FLAGGED_ANSWER);
  });

  it("checks an edited answer again instead of reusing the earlier choice", async () => {
    const { second } = interviewQuestions();
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ needed: false, question: null }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = await startInterview();
    const answerBox = () => screen.getByRole("textbox", { name: "답변" });

    await user.type(answerBox(), FLAGGED_ANSWER);
    await user.click(screen.getByRole("button", { name: /다음 질문/u }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.clear(answerBox());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.type(answerBox(), SAFE_ANSWER);
    await user.click(screen.getByRole("button", { name: /다음 질문/u }));

    expect(
      await screen.findByRole("heading", { level: 1, name: second.prompt }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
