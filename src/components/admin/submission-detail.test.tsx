import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminSubmissionDetail } from "@/components/admin/submission-detail";
import { FICTIONAL_PROFILES } from "@/content/examples";
import type { AdminSubmissionDetail as AdminSubmissionDetailData } from "@/lib/supabase/admin-submissions";

const profile = FICTIONAL_PROFILES[0];
if (!profile) throw new Error("profile fixture missing");

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-08-05T00:00:00.000Z",
  retentionUntil: "2027-08-04T00:00:00.000Z",
  schoolLevel: profile.metadata.schoolLevel,
  teacherRole: "homeroom_teacher" as const,
  modelName: profile.metadata.modelName,
  schemaVersion: profile.metadata.schemaVersion,
  promptVersion: profile.metadata.promptVersion,
  profileTitle: profile.profileTitle,
  shortSummary: profile.shortSummary,
  appVersion: "0.1.0",
  source: "web",
};

describe("AdminSubmissionDetail", () => {
  it("renders the document and download only for a fully approved row", () => {
    const submission: AdminSubmissionDetailData = {
      ...base,
      documentAccess: "full",
      consentVersion: "1.0",
      consentedAt: "2026-08-05T00:00:00.000Z",
      profile,
      profileMarkdown: "# 저장된 Markdown 원문",
    };

    render(<AdminSubmissionDetail submission={submission} />);

    expect(screen.getByText("전문 열람 가능")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Markdown 다운로드" }),
    ).toHaveAttribute(
      "href",
      "/admin/submissions/11111111-1111-4111-8111-111111111111/download",
    );
    expect(
      screen.getByRole("article", {
        name: "저장된 교사 컨텍스트 문서",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("저장된 Markdown 원문 보기")).toBeInTheDocument();
  });

  it("renders only summary and basic metadata for an ineligible legacy row", () => {
    const submission: AdminSubmissionDetailData = {
      ...base,
      documentAccess: "summary",
      accessReason: "claims_unconfirmed",
    };

    render(<AdminSubmissionDetail submission={submission} />);

    expect(screen.getByText("요약만")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "이 문서는 요약만 열람할 수 있습니다",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/교사가 아직 확인하지 않은 문장/u),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Markdown 다운로드" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("article", {
        name: "저장된 교사 컨텍스트 문서",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("저장된 Markdown 원문 보기"),
    ).not.toBeInTheDocument();
  });
});
