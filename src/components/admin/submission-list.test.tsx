import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminSubmissionList } from "@/components/admin/submission-list";

describe("AdminSubmissionList", () => {
  it("shows an explicit empty state", () => {
    render(<AdminSubmissionList submissions={[]} />);
    expect(
      screen.getByRole("heading", { name: "저장된 문서가 없습니다." }),
    ).toBeInTheDocument();
  });

  it("renders a uniquely named detail link", () => {
    render(
      <AdminSubmissionList
        submissions={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            createdAt: "2026-08-05T00:00:00.000Z",
            retentionUntil: "2027-08-04T00:00:00.000Z",
            schoolLevel: "elementary",
            teacherRole: "homeroom_teacher",
            modelName: "gpt-5.6-terra",
            schemaVersion: "1.0",
            promptVersion: "1.4",
            profileTitle: "저장된 문서",
            shortSummary: "",
            documentAccess: "summary",
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "문서 열기: 저장된 문서" }),
    ).toHaveAttribute(
      "href",
      "/admin/submissions/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("요약이 입력되지 않았습니다.")).toBeInTheDocument();
    expect(screen.getByText("요약만")).toBeInTheDocument();
    expect(screen.getByText("요약 보기")).toBeInTheDocument();
  });

  it("labels a fully approved document separately", () => {
    render(
      <AdminSubmissionList
        submissions={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            createdAt: "2026-08-05T00:00:00.000Z",
            retentionUntil: "2027-08-04T00:00:00.000Z",
            schoolLevel: "elementary",
            teacherRole: "homeroom_teacher",
            modelName: "gpt-5.6-terra",
            schemaVersion: "1.0",
            promptVersion: "1.4",
            profileTitle: "전문 문서",
            shortSummary: "검토와 저장 동의가 끝난 문서",
            documentAccess: "full",
          },
        ]}
      />,
    );

    expect(screen.getByText("전문 열람 가능")).toBeInTheDocument();
    expect(screen.getByText("전문 보기")).toBeInTheDocument();
  });
});
