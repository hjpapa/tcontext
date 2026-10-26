// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { VARIANT_SECTION_TITLES } from "@/content/export-variants";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import {
  contextAsOf,
  OPTIONAL_SECTION_IDS,
  profileToCoreMarkdown,
  profileToModuleMarkdown,
  type VariantResult,
} from "@/lib/export/profile-variants";
import { createUsageInstructionsFile } from "@/lib/export/skill";
import { readStoredZip } from "@/lib/export/zip.test-helper";
import { PROFILE_MODULE_IDS, PROFILE_MODULE_TITLES } from "@/types/profile";
import { GuideArtifacts } from "./guide-artifacts";

const PROFILE = FICTIONAL_PROFILES[1]!;

function Content() {
  const { openProfile } = useInterviewSession();
  return (
    <>
      <button
        onClick={() =>
          openProfile({
            profile: structuredClone(PROFILE),
            suggestedTags: [],
            mode: "view",
            link: null,
          })
        }
      >
        문서 열기
      </button>
      <GuideArtifacts
        artifacts={["profile-markdown", "skill-package", "usage-instructions"]}
      />
    </>
  );
}

function mount() {
  return render(
    <InterviewSessionProvider>
      <Content />
    </InterviewSessionProvider>,
  );
}

function successfulMarkdown(result: VariantResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected valid export fixture");
  return result.markdown;
}

function blobBytes(blob: Blob) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function browserDownloads() {
  const blobs: Blob[] = [];
  const names: string[] = [];
  const createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:guide-export";
  });
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  return { blobs, names, createObjectURL, revokeObjectURL };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GuideArtifacts export variants", () => {
  it.each([
    ["전체본", "full"],
    ["핵심본", "core"],
    ["모듈 선택본", "modules"],
  ] as const)(
    "downloads %s as BOM Markdown with the chosen content and filename",
    async (label, variant) => {
      const asOf = contextAsOf(PROFILE);
      const expected =
        variant === "full"
          ? profileToMarkdown(PROFILE)
          : successfulMarkdown(
              variant === "core"
                ? profileToCoreMarkdown(PROFILE, { asOf })
                : profileToModuleMarkdown(PROFILE, {
                    asOf,
                    modules: PROFILE_MODULE_IDS,
                    sections: OPTIONAL_SECTION_IDS,
                  }),
            );
      const browser = browserDownloads();
      const open = vi.fn();
      vi.stubGlobal("indexedDB", { open });
      mount();
      fireEvent.click(screen.getByRole("button", { name: "문서 열기" }));
      expect(screen.getByRole("radio", { name: "전체본" })).toBeChecked();
      fireEvent.click(screen.getByRole("radio", { name: label }));
      fireEvent.click(
        screen.getByRole("button", { name: "교사 Markdown 다운로드" }),
      );
      expect(browser.blobs).toHaveLength(1);
      const bytes = await blobBytes(browser.blobs[0]!);
      expect(Array.from(bytes.subarray(0, 3))).toEqual([239, 187, 191]);
      expect(new TextDecoder().decode(bytes.subarray(3))).toBe(expected);
      expect(browser.names[0]).toMatch(
        variant === "full"
          ? /-\d{8}\.md$/u
          : new RegExp(`-${variant}\\.md$`, "u"),
      );
      expect(browser.revokeObjectURL).toHaveBeenCalledWith("blob:guide-export");
      expect(open).not.toHaveBeenCalled();
    },
  );

  it("disables the picker and document downloads until a document is open", () => {
    mount();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    for (const radio of radios) expect(radio).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "교사 Markdown 다운로드" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "ZIP 패키지 다운로드" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "지침 SKILL.md 내려받기" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "공통 활용 지침 복사" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "문서 열기" }));
    for (const radio of radios) expect(radio).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "교사 Markdown 다운로드" }),
    ).toBeEnabled();
  });

  it("blocks an empty module selection and downloads the chosen modules and sections", async () => {
    const browser = browserDownloads();
    mount();
    fireEvent.click(screen.getByRole("button", { name: "문서 열기" }));
    fireEvent.click(screen.getByRole("radio", { name: "모듈 선택본" }));
    fireEvent.click(screen.getByRole("button", { name: "전체 해제" }));
    const download = screen.getByRole("button", {
      name: "교사 Markdown 다운로드",
    });
    expect(download).toBeDisabled();
    expect(screen.getByText("모듈을 하나 이상 고르세요")).toBeVisible();
    fireEvent.click(download);
    expect(browser.createObjectURL).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "ZIP 패키지 다운로드" }),
    ).toBeEnabled();
    for (const id of [PROFILE_MODULE_IDS[0], PROFILE_MODULE_IDS[2]]) {
      fireEvent.click(
        screen.getByRole("checkbox", { name: PROFILE_MODULE_TITLES[id] }),
      );
    }
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: VARIANT_SECTION_TITLES.teachingDesignPrinciples,
      }),
    );
    expect(download).toBeEnabled();
    fireEvent.click(download);
    const bytes = await blobBytes(browser.blobs[0]!);
    const body = new TextDecoder().decode(bytes.subarray(3));
    expect(body).toBe(
      successfulMarkdown(
        profileToModuleMarkdown(PROFILE, {
          asOf: contextAsOf(PROFILE),
          modules: [PROFILE_MODULE_IDS[0], PROFILE_MODULE_IDS[2]],
          sections: ["classSupportConsiderations", "realisticConstraints"],
        }),
      ),
    );
    expect(body).not.toContain("## 수업 설계 원칙");
    expect(body).toContain("## AI 협업 지침과 판단 경계");
    expect(browser.names[0]).toMatch(/-modules\.md$/u);
  });

  it("keeps the ZIP reference and instruction file unchanged after selecting the core variant", async () => {
    const browser = browserDownloads();
    mount();
    fireEvent.click(screen.getByRole("button", { name: "문서 열기" }));
    fireEvent.click(screen.getByRole("radio", { name: "핵심본" }));
    fireEvent.click(
      screen.getByRole("button", { name: "ZIP 패키지 다운로드" }),
    );
    const zip = await blobBytes(browser.blobs[0]!);
    const entries = readStoredZip(zip);
    expect(entries.map((entry) => entry.path)).toEqual([
      "teacher-context/SKILL.md",
      "teacher-context/references/teacher-profile.md",
    ]);
    expect(new TextDecoder().decode(entries[1]!.content)).toBe(
      profileToMarkdown(PROFILE),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "지침 SKILL.md 내려받기" }),
    );
    const instructions = await blobBytes(browser.blobs[1]!);
    expect(Array.from(instructions.subarray(0, 3))).not.toEqual([
      239, 187, 191,
    ]);
    expect(new TextDecoder().decode(instructions)).toBe(
      createUsageInstructionsFile().content,
    );
    expect(browser.names).toEqual(["teacher-context.zip", "SKILL.md"]);
  });
});
