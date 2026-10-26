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
import { profileToPlainText } from "@/lib/export/profile-to-text";
import {
  contextAsOf,
  profileToCoreMarkdown,
} from "@/lib/export/profile-variants";
import { ResultActions } from "./result-actions";

function fictionalProfile() {
  const profile = FICTIONAL_PROFILES[1];
  if (!profile) throw new Error("Missing fictional profile");
  return structuredClone(profile);
}

function setClipboard(writeText: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ResultActions", () => {
  it("keeps interactive export controls out of printed documents", () => {
    render(
      <ResultActions
        profile={fictionalProfile()}
        contextAsOf={contextAsOf(fictionalProfile())}
        markdown="# Markdown document"
      />,
    );

    expect(screen.getByLabelText("문서 내보내기")).toHaveAttribute(
      "data-print-hidden",
      "true",
    );
  });

  it("copies the canonical plain-text export and announces success", async () => {
    const profile = fictionalProfile();
    const writeText = vi.fn<(value: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    setClipboard(writeText);

    render(
      <ResultActions
        profile={profile}
        contextAsOf={contextAsOf(profile)}
        markdown="# Markdown document"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "일반 텍스트 복사" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(profileToPlainText(profile)),
    );
    expect(
      screen.getByRole("button", { name: "일반 텍스트 복사됨" }),
    ).toBeVisible();
    expect(
      screen.getByText("일반 텍스트 복사가 완료되었습니다."),
    ).toHaveAttribute("aria-live", "polite");
  });

  it("keeps Markdown and compact copy variants distinct", async () => {
    const profile = fictionalProfile();
    const writeText = vi.fn<(value: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    setClipboard(writeText);

    render(
      <ResultActions
        profile={profile}
        contextAsOf={contextAsOf(profile)}
        markdown="# Markdown document"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "전체 컨텍스트 복사" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith("# Markdown document"),
    );

    fireEvent.click(screen.getByRole("button", { name: "핵심본 복사" }));
    const core = profileToCoreMarkdown(profile, { asOf: contextAsOf(profile) });
    if (!core.ok) throw new Error("Expected a valid core export");
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(core.markdown),
    );
    expect(screen.getByRole("button", { name: "핵심본 복사됨" })).toBeVisible();
  });

  it("announces a clipboard permission failure without throwing", async () => {
    setClipboard(() => Promise.reject(new Error("clipboard denied")));

    render(
      <ResultActions
        profile={fictionalProfile()}
        contextAsOf={contextAsOf(fictionalProfile())}
        markdown="# Markdown document"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "일반 텍스트 복사" }));

    expect(
      await screen.findByText(
        "일반 텍스트 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요.",
      ),
    ).toHaveAttribute("aria-live", "polite");
  });
});
