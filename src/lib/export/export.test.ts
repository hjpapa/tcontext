// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  downloadMarkdown,
  profileMarkdownFilename,
  sanitizeDownloadFilename,
} from "./download";
import { profileToMarkdown } from "./profile-to-markdown";
import { profileToCompactText, profileToPlainText } from "./profile-to-text";
import { profileToPrintableHtml } from "./printable";

function fictionalProfile(index: number) {
  const profile = FICTIONAL_PROFILES[index];
  if (!profile) throw new Error(`Missing fictional profile at index ${index}`);
  return structuredClone(profile);
}

describe("profile export", () => {
  it("generates YAML front matter and all seven canonical sections", () => {
    const markdown = profileToMarkdown(fictionalProfile(1));
    expect(markdown).toMatch(/^---\ntitle:/);
    expect(markdown).toContain('school_level: "elementary"');
    expect(markdown).toContain("## 1. 교사 기본 프로파일과 현재 역할");
    expect(markdown).toContain("## 7. 현실적인 환경·제약과 디지털·AI 활용");
    expect(markdown).toContain("## 수업마다 추가할 작업 컨텍스트");
  });

  it("warns about unresolved claims while keeping download possible", () => {
    const profile = fictionalProfile(0);
    const claim = profile.modules[0]?.claims[0];
    if (!claim) throw new Error("Missing fictional claim");
    claim.basis = "needs_confirmation";
    claim.confirmedByUser = false;
    const markdown = profileToMarkdown(profile);
    expect(markdown).toContain("needs_claim_review: true");
    expect(markdown).toContain("검토 필요");
  });

  it("keeps a visible warning when the user continues after privacy review", () => {
    const profile = fictionalProfile(0);
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

    const markdown = profileToMarkdown(profile);
    expect(markdown).toContain('privacy_review: "needs_review"');
    expect(markdown).toContain("**개인정보 경고:**");
    expect(markdown).toContain("서버에 저장하지 않은 상태로 만든 결과");
  });

  it("preserves a privacy warning in every text export", () => {
    const profile = fictionalProfile(0);
    profile.privacyReview = {
      status: "needs_review",
      items: [
        {
          text: "검토 대상 문장",
          reason: "식별 가능성이 있습니다.",
          suggestedRewrite: "집단 수준으로 바꿔 주세요.",
        },
      ],
    };

    expect(profileToMarkdown(profile)).toContain("needs_review");
    expect(profileToPlainText(profile)).toContain("개인정보 상태: 경고");
    expect(profileToCompactText(profile)).toContain("[개인정보 경고]");
    expect(profileToPrintableHtml(profile)).toContain("개인정보 경고");
  });

  it("neutralizes HTML and script content in Markdown and printable HTML", () => {
    const profile = fictionalProfile(0);
    profile.shortSummary = '<script>alert("x")</script>';
    const markdown = profileToMarkdown(profile);
    const printable = profileToPrintableHtml(profile);
    expect(markdown).not.toContain("<script>");
    expect(printable).not.toContain('<script>alert("x")</script>');
    expect(printable).toContain("&lt;script&gt;");
  });

  it("creates plain and compact variants without unconfirmed claims", () => {
    const profile = fictionalProfile(0);
    const profileModule = profile.modules[0];
    if (!profileModule) throw new Error("Missing fictional module");
    profileModule.claims.push({
      id: "pending-claim",
      text: "확인되지 않은 해석",
      basis: "needs_confirmation",
      evidenceQuestionIds: ["common-role-focus"],
      confirmedByUser: false,
    });
    expect(profileToPlainText(profile)).toContain("확인되지 않은 해석");
    expect(profileToCompactText(profile)).not.toContain("확인되지 않은 해석");
  });
});

describe("Markdown download", () => {
  it("builds the required safe filename using a UTC date", () => {
    expect(
      profileMarkdownFilename(
        "elementary",
        new Date("2026-07-30T23:50:00.000Z"),
      ),
    ).toBe("tcontext-teacher-profile-elementary-20260730.md");
    expect(sanitizeDownloadFilename("../../a:<bad>?.md")).toBe(
      "..-..-a-bad-.md",
    );
  });

  it("uses an UTF-8 Markdown Blob and revokes its object URL", () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:test");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadMarkdown("# 문서", "profile.md", document, {
      createObjectURL,
      revokeObjectURL,
    });

    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    if (!blob) throw new Error("Expected a Markdown Blob");
    expect(blob.type).toBe("text/markdown;charset=utf-8");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    click.mockRestore();
  });
});
