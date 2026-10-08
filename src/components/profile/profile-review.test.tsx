// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  UNVERIFIED_PRIVACY_REVIEW,
  type TeacherContextProfile,
} from "@/types/profile";

import { ProfileReview } from "./profile-review";

type SessionSnapshot = ReturnType<typeof useInterviewSession>;
const latestSession: { current: SessionSnapshot | null } = { current: null };

function reviewedDraft(): TeacherContextProfile {
  const fixture = FICTIONAL_PROFILES[0];
  if (!fixture) throw new Error("Missing fictional profile");
  const profile = structuredClone(fixture);
  return {
    ...profile,
    modules: profile.modules.map((module) => ({
      ...module,
      claims: module.claims.map((claim) => ({
        ...claim,
        basis: claim.basis === "needs_confirmation" ? "direct" : claim.basis,
        confirmedByUser: true,
      })),
    })),
  };
}

function SeededReview({ profile }: { profile: TeacherContextProfile }) {
  const value = useInterviewSession();
  const { setProfile } = value;
  useEffect(() => {
    latestSession.current = value;
  });
  useEffect(() => {
    setProfile(profile);
  }, [profile, setProfile]);
  return value.profile ? <ProfileReview /> : null;
}

function renderReview() {
  render(
    <InterviewSessionProvider>
      <SeededReview profile={reviewedDraft()} />
    </InterviewSessionProvider>,
  );
}

async function runFinalCheck(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("checkbox", { name: /문서 제목, 전체·모듈 요약/ }),
  );
  await user.click(
    screen.getByRole("button", { name: /검토 마치고 개인정보 검사/ }),
  );
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ProfileReview final privacy check", () => {
  beforeEach(() => {
    push.mockClear();
    latestSession.current = null;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    [
      "an AI timeout",
      () =>
        Promise.resolve(
          jsonResponse(
            {
              error: {
                code: "ai_timeout",
                message: "AI 응답 시간이 초과되었습니다.",
              },
            },
            504,
          ),
        ),
    ],
    [
      "this service's own rate limit",
      () =>
        Promise.resolve(
          jsonResponse(
            {
              error: {
                code: "rate_limit_exceeded",
                message: "요청이 너무 많습니다.",
              },
            },
            429,
          ),
        ),
    ],
    [
      "a dropped connection",
      () => Promise.reject(new TypeError("fetch failed")),
    ],
  ])(
    "opens the unverified path to the result after %s",
    async (_label, respond) => {
      const user = userEvent.setup();
      vi.spyOn(globalThis, "fetch").mockImplementation(respond);
      renderReview();

      await runFinalCheck(user);

      expect(
        await screen.findByText("AI 개인정보 최종 검사를 마치지 못했습니다."),
      ).toBeVisible();
      const continueButton = screen.getByRole("button", {
        name: /직접 확인하고 결과 보기/,
      });
      expect(continueButton).toBeDisabled();

      await user.click(
        screen.getByRole("checkbox", {
          name: /AI 개인정보 검사를 마치지 못한 문서임을 이해했습니다/,
        }),
      );
      await user.click(continueButton);

      expect(push).toHaveBeenCalledWith("/result");
      expect(latestSession.current?.profile?.privacyReview).toEqual(
        UNVERIFIED_PRIVACY_REVIEW,
      );
      expect(latestSession.current?.markdown).toContain(
        "**개인정보 확인 안 됨:**",
      );
      expect(latestSession.current?.privacyReviewToken).toBeNull();
    },
  );

  it("keeps a request error on the review screen", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "invalid_request",
            message: "요청 형식이 올바르지 않습니다.",
          },
        },
        400,
      ),
    );
    renderReview();

    await runFinalCheck(user);

    expect(
      await screen.findByText("요청 형식이 올바르지 않습니다."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /직접 확인하고 결과 보기/ }),
    ).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the signed review token only for a clear result", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          source: "openai",
          review: { status: "clear", items: [] },
          reviewToken: "v1.1785456000000.signed",
        },
        200,
      ),
    );
    renderReview();

    await runFinalCheck(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/result"));
    expect(latestSession.current?.privacyReviewToken).toBe(
      "v1.1785456000000.signed",
    );
    expect(latestSession.current?.profile?.privacyReview).toEqual({
      status: "clear",
      items: [],
    });
  });
});
