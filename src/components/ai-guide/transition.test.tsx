// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { InterviewSessionProvider } from "@/components/layout/interview-session-provider";
import { GEMINI_GUIDE } from "@/content/platform-guides/gemini";
import { CHATGPT_GUIDE } from "@/content/platform-guides/chatgpt";
import { CLAUDE_GUIDE } from "@/content/platform-guides/claude";
import type { PlatformGuide } from "@/content/platform-guides/schema";
import { PlatformGuideView } from "./platform-guide-view";
afterEach(cleanup);
const mount = (guide: PlatformGuide) => (
  <InterviewSessionProvider>
    <PlatformGuideView guide={guide} />
  </InterviewSessionProvider>
);
it("switches recommendation, badges and collapsed migration guidance using only content statuses", () => {
  // Start from approved content; subsequent status fixtures are simulations.
  const before: PlatformGuide = structuredClone(GEMINI_GUIDE);
  const { rerender } = render(mount(before));
  expect(
    within(screen.getByRole("region", { name: "일반 대화에 첨부" })).getByText(
      "권장",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "skill" })).getByText(
      "사용 가능",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Gem" })).getByText("전환 중"),
  ).toBeVisible();
  const after: PlatformGuide = structuredClone(before);
  after.methods.find(
    (method) => method.id === "gemini-chat-attachment",
  )!.status = "available";
  after.methods.find((method) => method.id === "gemini-gem")!.status =
    "retired";
  after.methods.find((method) => method.id === "gemini-skill")!.status =
    "recommended";
  rerender(mount(after));
  expect(
    within(screen.getByRole("region", { name: "skill" })).getByText("권장"),
  ).toBeVisible();
  expect(screen.queryByText("출시 예정")).toBeNull();
  expect(
    within(screen.getByRole("region", { name: "일반 대화에 첨부" })).getByText(
      "사용 가능",
    ),
  ).toBeVisible();
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
  ).toBe("transitioning");
  const announced = structuredClone(before);
  announced.methods.find((method) => method.id === "gemini-skill")!.status =
    "announced";
  rerender(mount(announced));
  expect(
    screen.getByText("skill · 출시 예정 안내").closest("details"),
  ).not.toHaveAttribute("open");
});

it.each([
  { guide: GEMINI_GUIDE, visible: false },
  { guide: CHATGPT_GUIDE, visible: true },
  { guide: CLAUDE_GUIDE, visible: true },
])(
  "shows fallback guidance only when the fallback is not recommended: $guide.id",
  ({ guide, visible }) => {
    render(mount(guide));
    const message = screen.queryByText(/권장 방법을 이용하기 어렵다면/);
    if (visible) {
      expect(message).toBeVisible();
      expect(
        within(message!).getByRole("link", { name: "일반 대화에 첨부" }),
      ).toHaveAttribute("href", `#${guide.fallbackMethodId}`);
    } else {
      expect(message).toBeNull();
    }
  },
);
