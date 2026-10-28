// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { VARIANT_SECTION_TITLES } from "@/content/export-variants";
import {
  contextAsOf,
  OPTIONAL_SECTION_IDS,
  profileToCoreMarkdown,
  profileToModuleMarkdown,
  type VariantResult,
} from "@/lib/export/profile-variants";
import {
  PENDING_PRIVACY_REVIEW,
  PROFILE_MODULE_IDS,
  PROFILE_MODULE_TITLES,
} from "@/types/profile";
import { ExportVariantPanel } from "./export-variant-panel";

function profileFixture() {
  return structuredClone(FICTIONAL_PROFILES[1]!);
}

function successfulMarkdown(result: VariantResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected valid export fixture");
  return result.markdown;
}

function preview() {
  return screen.getByRole<HTMLTextAreaElement>("textbox", {
    name: "내보낼 내용 미리보기",
  });
}

function blobBytes(blob: Blob) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function browserExports() {
  const blobs: Blob[] = [];
  const names: string[] = [];
  const writeText = vi.fn<(value: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    return "blob:context-export";
  });
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  return { blobs, names, writeText, createObjectURL, revokeObjectURL };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ExportVariantPanel", () => {
  it.each([
    ["전체본", "full"],
    ["핵심본", "core"],
    ["모듈 선택본", "modules"],
  ] as const)(
    "exports the exact %s preview by copy and BOM Markdown without opening IndexedDB",
    async (label, variant) => {
      const profile = profileFixture();
      const asOf = contextAsOf(profile, "2026-10-25T16:00:00.000Z");
      const sessionMarkdown =
        "# 세션에서 전달한 전체본\n\n  원래 공백과 줄바꿈을 유지합니다.\n";
      const expected =
        variant === "full"
          ? sessionMarkdown
          : successfulMarkdown(
              variant === "core"
                ? profileToCoreMarkdown(profile, { asOf })
                : profileToModuleMarkdown(profile, {
                    asOf,
                    modules: PROFILE_MODULE_IDS,
                    sections: OPTIONAL_SECTION_IDS,
                  }),
            );
      const browser = browserExports();
      const open = vi.fn();
      vi.stubGlobal("indexedDB", { open });
      render(
        <ExportVariantPanel
          profile={profile}
          markdown={sessionMarkdown}
          contextAsOf={asOf}
        />,
      );

      expect(screen.getByRole("radio", { name: "전체본" })).toBeChecked();
      fireEvent.click(screen.getByRole("radio", { name: label }));
      expect(preview()).toHaveValue(expected);
      expect(preview()).toHaveAttribute("readonly");
      expect(preview()).not.toHaveAttribute("aria-live");
      fireEvent.click(screen.getByRole("button", { name: "복사" }));
      await waitFor(() =>
        expect(browser.writeText).toHaveBeenCalledWith(expected),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Markdown 다운로드" }),
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
      expect(browser.revokeObjectURL).toHaveBeenCalledWith(
        "blob:context-export",
      );
      expect(open).not.toHaveBeenCalled();
    },
  );

  it("selects and clears modules, disables empty exports, and applies section toggles", () => {
    const profile = profileFixture();
    const asOf = contextAsOf(profile);
    render(
      <ExportVariantPanel
        profile={profile}
        markdown="# full"
        contextAsOf={asOf}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "모듈 선택본" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(10);
    for (const checkbox of screen.getAllByRole("checkbox"))
      expect(checkbox).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "전체 해제" }));
    expect(screen.getByText("모듈을 하나 이상 고르세요")).toBeVisible();
    expect(
      screen.queryByRole("textbox", { name: "내보낼 내용 미리보기" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "복사" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Markdown 다운로드" }),
    ).toBeDisabled();
    for (const id of PROFILE_MODULE_IDS) {
      expect(
        screen.getByRole("checkbox", {
          name: PROFILE_MODULE_TITLES[id],
        }),
      ).not.toBeChecked();
    }
    for (const id of OPTIONAL_SECTION_IDS) {
      expect(
        screen.getByRole("checkbox", {
          name: VARIANT_SECTION_TITLES[id],
        }),
      ).toBeChecked();
    }
    const selected = [PROFILE_MODULE_IDS[0], PROFILE_MODULE_IDS[2]];
    for (const id of selected) {
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: PROFILE_MODULE_TITLES[id],
        }),
      );
    }
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: VARIANT_SECTION_TITLES.teachingDesignPrinciples,
      }),
    );
    expect(preview()).toHaveValue(
      successfulMarkdown(
        profileToModuleMarkdown(profile, {
          asOf,
          modules: selected,
          sections: ["classSupportConsiderations", "realisticConstraints"],
        }),
      ),
    );
    expect(preview().value).not.toContain("## 수업 설계 원칙");
    expect(preview().value).toContain("## AI 협업 지침과 판단 경계");
    expect(screen.getByRole("button", { name: "복사" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "전체 선택" }));
    for (const id of PROFILE_MODULE_IDS) {
      expect(
        screen.getByRole("checkbox", {
          name: PROFILE_MODULE_TITLES[id],
        }),
      ).toBeChecked();
    }
    expect(preview()).toHaveValue(
      successfulMarkdown(
        profileToModuleMarkdown(profile, {
          asOf,
          modules: PROFILE_MODULE_IDS,
          sections: ["classSupportConsiderations", "realisticConstraints"],
        }),
      ),
    );
  });

  it.each(["pending", "invalid"] as const)(
    "blocks variant actions when the profile is %s",
    (kind) => {
      const profile = profileFixture();
      if (kind === "pending") profile.privacyReview = PENDING_PRIVACY_REVIEW;
      else profile.modules = [];
      render(
        <ExportVariantPanel
          profile={profile}
          markdown="# unchanged full"
          contextAsOf={contextAsOf(profile)}
        />,
      );
      for (const label of ["핵심본", "모듈 선택본"]) {
        fireEvent.click(screen.getByRole("radio", { name: label }));
        expect(
          screen.queryByRole("textbox", { name: "내보낼 내용 미리보기" }),
        ).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "복사" })).toBeDisabled();
        expect(
          screen.getByRole("button", {
            name: "Markdown 다운로드",
          }),
        ).toBeDisabled();
        expect(screen.getByText(/검토.*문서|문서.*검토/u)).toBeVisible();
      }
    },
  );
});
