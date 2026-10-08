// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  UNVERIFIED_PRIVACY_REVIEW,
  type TeacherContextProfile,
} from "@/types/profile";
import { ContributionPanel } from "./contribution-panel";

const session = vi.hoisted(() => ({
  privacyReviewToken: null as string | null,
  setContributionReceipt: vi.fn(),
}));

vi.mock("@/components/layout/interview-session-provider", () => ({
  useInterviewSession: () => ({
    contributionReceipt: null,
    privacyReviewToken: session.privacyReviewToken,
    setContributionReceipt: session.setContributionReceipt,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  session.privacyReviewToken = null;
  session.setContributionReceipt.mockClear();
});

function clearProfile(): TeacherContextProfile {
  const fixture = FICTIONAL_PROFILES[0];
  if (!fixture) throw new Error("Missing fictional profile");
  return {
    ...structuredClone(fixture),
    privacyReview: { status: "clear", items: [] },
  };
}

async function consentAndContribute() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("checkbox", { name: /선택적으로 기여/ }));
  await user.click(
    screen.getByRole("button", { name: "동의하고 데이터 기여" }),
  );
}

describe("ContributionPanel", () => {
  it("does not offer a server contribution when a privacy warning remains", () => {
    const fixture = FICTIONAL_PROFILES[0];
    if (!fixture) throw new Error("Missing fictional profile");
    const profile = structuredClone(fixture);
    profile.privacyReview = {
      status: "needs_review",
      items: [
        {
          text: "확인이 필요한 문장",
          reason: "식별 가능성을 직접 확인해야 합니다.",
          suggestedRewrite: "역할과 지원 원칙 중심으로 바꿔 주세요.",
        },
      ],
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <ContributionPanel
        profile={profile}
        markdown="# 경고가 포함된 로컬 문서"
        consentVersion="1.0"
        retentionDays={30}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "개인정보 경고가 남아 있어 이 문서는 서버에 기여할 수 없습니다.",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "동의하고 데이터 기여" }),
    ).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not offer a server contribution while the AI review is unverified", () => {
    const profile = clearProfile();
    profile.privacyReview = UNVERIFIED_PRIVACY_REVIEW;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <ContributionPanel
        profile={profile}
        markdown="# 확인 안 됨 로컬 문서"
        consentVersion="1.0"
        retentionDays={30}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "AI 개인정보 검사를 마치지 못해 이 문서는 아직 기여할 수 없습니다.",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "동의하고 데이터 기여" }),
    ).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the signed review token with an explicit contribution", async () => {
    session.privacyReviewToken = "v1.1785456000000.signed";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          submissionId: "11111111-1111-4111-8111-111111111111",
          deletionToken: "d".repeat(43),
          createdAt: "2026-10-08T00:00:00.000Z",
          retentionUntil: "2027-10-07T00:00:00.000Z",
        }),
        { status: 201 },
      ),
    );

    render(
      <ContributionPanel
        profile={clearProfile()}
        markdown="# 문서"
        consentVersion="1.0"
        retentionDays={365}
      />,
    );
    await consentAndContribute();

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as {
      privacyReviewToken?: string;
      consentAccepted?: boolean;
    };
    expect(body).toMatchObject({
      consentAccepted: true,
      privacyReviewToken: "v1.1785456000000.signed",
    });
    expect(session.setContributionReceipt).toHaveBeenCalledOnce();
  });

  it("explains an expired review and links back to the review screen", async () => {
    session.privacyReviewToken = "v1.1785456000000.signed";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "privacy_review_required",
            message:
              "개인정보 검사 후 1시간이 지나 검사 확인이 만료되었습니다. 검토 화면에서 개인정보 검사를 다시 실행해 주세요.",
          },
        }),
        { status: 422 },
      ),
    );

    render(
      <ContributionPanel
        profile={clearProfile()}
        markdown="# 문서"
        consentVersion="1.0"
        retentionDays={365}
      />,
    );
    await consentAndContribute();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("검사 확인이 만료되었습니다");
    expect(alert).toHaveTextContent("문서 다운로드에는 영향이 없습니다.");
    expect(
      screen.getByRole("link", { name: "검토 화면으로 돌아가기" }),
    ).toHaveAttribute("href", "/review");
    expect(session.setContributionReceipt).not.toHaveBeenCalled();
  });

  it("keeps other server failures generic", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "database_unavailable", message: "내부 오류 상세" },
        }),
        { status: 503 },
      ),
    );

    render(
      <ContributionPanel
        profile={clearProfile()}
        markdown="# 문서"
        consentVersion="1.0"
        retentionDays={365}
      />,
    );
    await consentAndContribute();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "기여 데이터를 저장하지 못했습니다. 문서 다운로드에는 영향이 없습니다.",
    );
    expect(alert).not.toHaveTextContent("내부 오류 상세");
    expect(
      screen.queryByRole("link", { name: "검토 화면으로 돌아가기" }),
    ).not.toBeInTheDocument();
  });
});
