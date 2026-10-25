// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import { PLATFORM_GUIDES } from "@/content/platform-guides";
import { COMMON_USAGE_INSTRUCTIONS } from "@/content/usage-instructions";
import { FICTIONAL_PROFILES } from "@/content/examples";
import type { PlatformGuide } from "@/content/platform-guides/schema";
import { PlatformGuideView } from "./platform-guide-view";
import * as downloads from "@/lib/export/download";
import { createUsageInstructionsFile } from "@/lib/export/skill";
import { readStoredZip } from "@/lib/export/zip.test-helper";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";

function Content({ guide }: { guide: PlatformGuide }) {
  const { openProfile } = useInterviewSession();
  return (
    <>
      <button
        onClick={() =>
          openProfile({
            profile: structuredClone(FICTIONAL_PROFILES[0]!),
            suggestedTags: [],
            mode: "view",
            link: null,
          })
        }
      >
        문서 열기
      </button>
      <PlatformGuideView guide={guide} />
    </>
  );
}
function mount(guide: PlatformGuide) {
  return render(
    <InterviewSessionProvider>
      <Content guide={guide} />
    </InterviewSessionProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(PLATFORM_GUIDES)(
  "offers instructions but disables document downloads without a profile: $name",
  async (guide) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    const file = vi
      .spyOn(downloads, "downloadTextFile")
      .mockReturnValue({ ok: true });
    vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: "test" });
    vi.stubGlobal("indexedDB", { open });
    mount(guide);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      guide.name,
    );
    for (const button of screen.getAllByRole("button", { name: /다운로드$/ }))
      expect(button).toBeDisabled();
    const instructions = screen.getAllByRole("button", {
      name: "지침 SKILL.md 내려받기",
    })[0]!;
    expect(instructions).toBeEnabled();
    fireEvent.click(instructions);
    expect(file).toHaveBeenCalledWith(createUsageInstructionsFile(), {
      bom: false,
    });
    expect(
      screen.getAllByText("문서를 만들거나 내 프로파일에서 여세요.").length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByRole("button", { name: "공통 활용 지침 복사" })[0]!,
    );
    await screen.findByRole("status");
    expect(writeText).toHaveBeenCalledWith(COMMON_USAGE_INSTRUCTIONS);
    expect(open).not.toHaveBeenCalled();
    expect(
      screen.getByRole("complementary", { name: "외부 서비스 이용 안내" }),
    ).toHaveTextContent("자동 동기화되지 않습니다");
    expect(screen.getByRole("complementary")).toHaveTextContent(
      "파일을 다시 등록해야 합니다",
    );
    for (const link of screen.getAllByRole("link", {
      name: "공식 도움말 열기 (새 탭)",
    })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  },
);
it("uses the existing Markdown downloader and a BOM-free two-file package", async () => {
  const markdown = vi
    .spyOn(downloads, "downloadMarkdown")
    .mockImplementation(() => {});
  const file = vi
    .spyOn(downloads, "downloadTextFile")
    .mockReturnValue({ ok: true });
  const guide = PLATFORM_GUIDES.find((g) =>
    g.methods.some((m) => m.requiredArtifacts.includes("skill-package")),
  )!;
  mount(guide);
  fireEvent.click(screen.getByRole("button", { name: "문서 열기" }));
  fireEvent.click(
    screen.getAllByRole("button", { name: "교사 Markdown 다운로드" })[0]!,
  );
  expect(markdown).toHaveBeenCalledWith(
    expect.stringContaining(FICTIONAL_PROFILES[0]!.profileTitle),
    expect.stringMatching(/\.md$/),
  );
  fireEvent.click(screen.getByRole("button", { name: "ZIP 패키지 다운로드" }));
  expect(file).toHaveBeenCalledWith(
    expect.objectContaining({
      path: "teacher-context.zip",
      content: expect.any(Uint8Array),
    }),
    { bom: false },
  );
  const bytes = file.mock.calls[0]![0].content;
  if (typeof bytes === "string") throw new Error("Expected binary package");
  const entries = readStoredZip(bytes);
  expect(entries.map((entry) => entry.path)).toEqual([
    "teacher-context/SKILL.md",
    "teacher-context/references/teacher-profile.md",
  ]);
  expect(new TextDecoder().decode(entries[1]!.content)).toBe(
    profileToMarkdown(FICTIONAL_PROFILES[0]!),
  );
});
it("provides actionable clipboard and download failures without losing the document", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    userAgent: "test",
  });
  vi.spyOn(downloads, "downloadMarkdown").mockImplementation(() => {
    throw new Error("failed");
  });
  mount(PLATFORM_GUIDES[0]!);
  fireEvent.click(
    screen.getAllByRole("button", { name: "공통 활용 지침 복사" })[0]!,
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("직접 선택해 복사"),
  );
  fireEvent.click(screen.getByRole("button", { name: "문서 열기" }));
  const button = screen.getAllByRole("button", {
    name: "교사 Markdown 다운로드",
  })[0]!;
  fireEvent.click(button);
  expect(screen.getByRole("status")).toHaveTextContent(
    "다운로드하지 못했습니다",
  );
  expect(button).toBeEnabled();
});
