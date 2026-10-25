// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { InterviewSessionProvider } from "@/components/layout/interview-session-provider";
import { GEMINI_GUIDE } from "@/content/platform-guides/gemini";
import type { PlatformGuide } from "@/content/platform-guides/schema";
import { PlatformGuideView } from "./platform-guide-view";
afterEach(cleanup);
it("switches recommendation, badges and collapsed migration guidance using only content statuses", () => {
  // Historical/future status fixtures are simulations, not published facts.
  const before: PlatformGuide = structuredClone(GEMINI_GUIDE);
  before.methods.find((method) => method.id === "gemini-gem")!.status =
    "recommended";
  before.methods.find((method) => method.id === "gemini-skill")!.status =
    "announced";
  const mount = (guide: PlatformGuide) => (
    <InterviewSessionProvider>
      <PlatformGuideView guide={guide} />
    </InterviewSessionProvider>
  );
  const { rerender } = render(mount(before));
  expect(
    within(screen.getByRole("region", { name: "Gem" })).getByText("권장"),
  ).toBeVisible();
  expect(
    screen.getByText("skill · 출시 예정 안내").closest("details"),
  ).not.toHaveAttribute("open");
  const after: PlatformGuide = structuredClone(before);
  after.methods.find((method) => method.id === "gemini-gem")!.status =
    "retired";
  after.methods.find((method) => method.id === "gemini-skill")!.status =
    "recommended";
  rerender(mount(after));
  expect(
    within(screen.getByRole("region", { name: "skill" })).getByText("권장"),
  ).toBeVisible();
  expect(screen.queryByText("출시 예정")).toBeNull();
  const old = screen.getByRole("region", {
    name: "Gem",
    hidden: true,
  });
  expect(old).not.toBeVisible();
  expect(within(old).getByText("종료")).toBeInTheDocument();
  expect(
    within(old).queryByRole("button", { name: /다운로드/, hidden: true }),
  ).toBeNull();
  expect(
    screen.getByText("이전에 사용한 방법의 전환 안내").closest("details"),
  ).not.toHaveAttribute("open");
  expect(
    before.methods.find((method) => method.id === "gemini-gem")!.status,
  ).toBe("recommended");
});
