// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { contextAsOf } from "@/lib/export/profile-variants";
import { ResultActions } from "./result-actions";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("reports core generation failure without writing to the clipboard", () => {
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  const writeText = vi.fn();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(
    <ResultActions
      profile={profile}
      markdown="# full"
      contextAsOf={{ ...contextAsOf(profile), date: "invalid" }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "핵심본 복사" }));
  expect(
    screen.getByText(
      "핵심본 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요.",
    ),
  ).toHaveAttribute("aria-live", "polite");
  expect(writeText).not.toHaveBeenCalled();
});
