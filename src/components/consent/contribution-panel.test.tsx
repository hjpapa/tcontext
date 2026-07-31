// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FICTIONAL_PROFILES } from "@/content/examples";
import { ContributionPanel } from "./contribution-panel";

vi.mock("@/components/layout/interview-session-provider", () => ({
  useInterviewSession: () => ({
    contributionReceipt: null,
    setContributionReceipt: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
});
