import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createInterviewState, setInterviewAnswer } from "@/lib/interview";
import {
  LOCAL_PROGRESS_KEY,
  LOCAL_RESUME_PREFERENCE_KEY,
  saveLocalProgress,
  setLocalResumeEnabled,
} from "@/lib/storage/local";
import {
  SESSION_PROGRESS_KEY,
  saveSessionProgress,
} from "@/lib/storage/session";

import {
  InterviewSessionProvider,
  useInterviewSession,
} from "./interview-session-provider";

function progressedInterview(
  schoolLevel: "elementary" | "middle",
  currentQuestionIndex: number,
) {
  const initial = createInterviewState({
    schoolLevel,
    role: "homeroom_teacher",
    privacyNoticeAccepted: true,
    now: "2026-08-10T00:00:00.000Z",
  });
  const firstQuestion = initial.questions[0];
  if (!firstQuestion) throw new Error("Expected an interview question");
  return {
    ...setInterviewAnswer(
      initial,
      firstQuestion.id,
      "브라우저 저장소에 남으면 안 되는 원문",
      "answered",
      "2026-08-10T00:01:00.000Z",
    ),
    currentQuestionIndex,
  };
}

function SessionProbe() {
  const { interview, progressHydrated, restoredProgress } =
    useInterviewSession();

  return (
    <div>
      <span data-testid="hydrated">{String(progressHydrated)}</span>
      <span data-testid="school">{interview?.schoolLevel ?? "none"}</span>
      <span data-testid="question">
        {interview?.questions[interview.currentQuestionIndex]?.id ?? "none"}
      </span>
      <span data-testid="answer-count">
        {String(Object.keys(interview?.answers ?? {}).length)}
      </span>
      <span data-testid="source">{restoredProgress?.source ?? "none"}</span>
      <span data-testid="previous-count">
        {String(restoredProgress?.previousCompletedQuestionCount ?? 0)}
      </span>
    </div>
  );
}

function renderProvider() {
  render(
    <InterviewSessionProvider>
      <SessionProbe />
    </InterviewSessionProvider>,
  );
}

describe("InterviewSessionProvider progress restoration", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("restores same-tab session position first and never recreates answers", () => {
    setLocalResumeEnabled(true);
    saveLocalProgress(progressedInterview("middle", 5));
    saveSessionProgress(progressedInterview("elementary", 3));

    renderProvider();

    expect(screen.getByTestId("hydrated")).toHaveTextContent("true");
    expect(screen.getByTestId("school")).toHaveTextContent("elementary");
    expect(screen.getByTestId("question")).toHaveTextContent(
      "common-lesson-flow",
    );
    expect(screen.getByTestId("answer-count")).toHaveTextContent("0");
    expect(screen.getByTestId("source")).toHaveTextContent("session");
    expect(screen.getByTestId("previous-count")).toHaveTextContent("1");
    expect(window.sessionStorage.getItem(SESSION_PROGRESS_KEY)).not.toContain(
      "브라우저 저장소에 남으면 안 되는 원문",
    );
  });

  it("uses opted-in device progress when a new tab has no session progress", () => {
    setLocalResumeEnabled(true);
    saveLocalProgress(progressedInterview("middle", 4));

    renderProvider();

    expect(screen.getByTestId("school")).toHaveTextContent("middle");
    expect(screen.getByTestId("question")).toHaveTextContent(
      "common-class-support",
    );
    expect(screen.getByTestId("answer-count")).toHaveTextContent("0");
    expect(screen.getByTestId("source")).toHaveTextContent("device");
    expect(window.localStorage.getItem(LOCAL_RESUME_PREFERENCE_KEY)).toBe(
      "true",
    );
    expect(window.localStorage.getItem(LOCAL_PROGRESS_KEY)).not.toContain(
      "브라우저 저장소에 남으면 안 되는 원문",
    );
  });

  it("clears a completed bookmark instead of restoring a fake completion", () => {
    const state = progressedInterview("elementary", 9);
    saveSessionProgress(state);
    const serialized = window.sessionStorage.getItem(SESSION_PROGRESS_KEY);
    if (!serialized) throw new Error("Expected session progress");
    const stored = JSON.parse(serialized) as {
      completedQuestionCount: number;
      fixedQuestionIds: string[];
      followUpCount: number;
    };
    window.sessionStorage.setItem(
      SESSION_PROGRESS_KEY,
      JSON.stringify({
        ...stored,
        completedQuestionCount:
          stored.fixedQuestionIds.length + stored.followUpCount,
      }),
    );

    renderProvider();

    expect(screen.getByTestId("school")).toHaveTextContent("none");
    expect(screen.getByTestId("source")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem(SESSION_PROGRESS_KEY)).toBeNull();
  });
});
