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
  it("generates the V2 lesson-design document with all seven canonical modules", () => {
    const markdown = profileToMarkdown(fictionalProfile(1));
    expect(markdown).toMatch(/^---\ndocument_type: "teacher_profile_context"/);
    expect(markdown).toContain('document_format_version: "2.0"');
    expect(markdown).toContain('language: "ko-KR"');
    expect(markdown).toContain('school_level: "초등학교"');
    expect(markdown).toContain("## 0. 문서의 목적과 사용 방법");
    expect(markdown).toContain("# 교사 프로파일");
    expect(markdown).toContain("## M1. 교사 기본 프로파일과 현재 역할");
    expect(markdown).toContain("## M7. 현실적인 환경·제약과 디지털·AI 활용");
    expect(markdown).toContain("# 수업 설계 실행 가이드");
    expect(markdown).toContain("# 수업마다 추가할 작업 컨텍스트");
    expect(markdown).toContain("# AI에게 바로 전달할 실행 프롬프트");
    expect(markdown).toContain("# 유지·갱신 안내");
  });

  it("includes a reusable lesson task YAML and omits raw analytics tags", () => {
    const markdown = profileToMarkdown(fictionalProfile(1));

    expect(markdown).toContain(
      'task_type: "수업 설계 | 슬라이드 | 활동지 | 평가 | 수업 검토"',
    );
    expect(markdown).toContain('achievement_standard: ""');
    expect(markdown).toContain('classwide_learning_supports: ""');
    expect(markdown).toContain(
      'desired_output: "수업안 | 슬라이드 구성안 | 활동지 | 평가 기준"',
    );
    expect(markdown).toContain(
      "현재 작업 정보가 프로파일과 다르면 현재 작업 정보를 우선하세요.",
    );
    expect(markdown).not.toContain("teacher_final_judgment");
    expect(markdown).not.toContain("psychological_safety");
  });

  it("exports a controlled secondary teaching subject without changing legacy documents", () => {
    const secondary = fictionalProfile(2);
    secondary.metadata.teachingSubject = "science";

    const markdown = profileToMarkdown(secondary);
    expect(markdown).toContain('teaching_subject: "과학"');
    expect(markdown).toContain('subject: "과학"');
    expect(profileToPlainText(secondary)).toContain("담당 교과: 과학");
    expect(profileToCompactText(secondary)).toContain(
      "[학교급·역할·담당 교과] 중학교 · 교과전담 또는 교과교사 · 과학",
    );

    const legacy = fictionalProfile(1);
    const legacyMarkdown = profileToMarkdown(legacy);
    expect(legacyMarkdown).not.toContain("teaching_subject:");
    expect(legacyMarkdown).toContain('subject: ""');
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
    expect(markdown).toContain("서버에 선택 저장할 수 없습니다");
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

  it("creates plain and module-grouped compact variants without unconfirmed claims", () => {
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
    const plainText = profileToPlainText(profile);
    expect(plainText).toContain("학교급: 유치원");
    expect(plainText).toContain("역할: 담임교사");
    expect(plainText).toContain("확인되지 않은 해석");
    const compact = profileToCompactText(profile);
    expect(compact).not.toContain("확인되지 않은 해석");
    expect(compact).toContain("[확인된 맥락 · 교사 기본 프로파일과 현재 역할]");
    expect(compact).toContain(
      "현재 수업의 교과·단원·성취기준·시간 정보가 프로필과 다르면 현재 수업 정보를 우선하세요.",
    );
  });

  it("keeps the lesson-design use guide and all four synthesis lists in print", () => {
    const printable = profileToPrintableHtml(fictionalProfile(1));

    expect(printable).toContain("0. 문서의 목적과 사용 방법");
    expect(printable).toContain("현재 작업 정보를 우선한다");
    expect(printable).toContain("핵심 수업 설계 원칙");
    expect(printable).toContain("학급 지원 고려사항");
    expect(printable).toContain("현실적인 제약과 대체안");
    expect(printable).toContain("AI와 협업할 때의 지침과 판단 경계");
    expect(printable).toContain("생성 결과 자기 점검");
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
