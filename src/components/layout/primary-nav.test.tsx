// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "./interview-session-provider";
import { PrimaryNav } from "./primary-nav";

const navigation = vi.hoisted(() => ({ pathname: "/ai-guide" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

function SessionControls() {
  const { openProfile, setProfile, setMarkdown } = useInterviewSession();
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
        완성 문서 설정
      </button>
      <button
        onClick={() =>
          openProfile({
            profile: structuredClone(FICTIONAL_PROFILES[0]!),
            suggestedTags: [],
            mode: "edit",
            link: null,
          })
        }
      >
        검토 문서 설정
      </button>
      <button
        onClick={() => {
          setProfile(null);
          setMarkdown("");
        }}
      >
        메모리 문서 제거
      </button>
      <PrimaryNav />
    </>
  );
}

function mount(pathname = "/ai-guide") {
  navigation.pathname = pathname;
  return render(
    <InterviewSessionProvider>
      <SessionControls />
    </InterviewSessionProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

it("keeps the existing start link visible when there is no document", () => {
  mount();
  expect(
    screen.queryByRole("link", { name: "현재 문서" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /인터뷰 시작/ })).not.toHaveClass(
    "hidden",
  );
});

it.each(["/ai-guide", "/result"])(
  "links a finished document to results with the correct current-page state on %s",
  (pathname) => {
    mount(pathname);
    fireEvent.click(screen.getByRole("button", { name: "완성 문서 설정" }));
    const link = screen.getByRole("link", { name: "현재 문서" });
    expect(link).toHaveAttribute("href", "/result");
    if (pathname === "/result") {
      expect(link).toHaveAttribute("aria-current", "page");
      expect(link).toHaveClass("bg-secondary", "text-primary");
      expect(
        screen.queryByRole("link", { name: /인터뷰 시작/ }),
      ).not.toBeInTheDocument();
    } else {
      expect(link).not.toHaveAttribute("aria-current");
      expect(screen.getByRole("link", { name: /인터뷰 시작/ })).toHaveClass(
        "hidden",
        "sm:inline-flex",
      );
    }
    expect(within(link).getByText("문서", { exact: true })).toHaveClass(
      "sm:hidden",
    );
    expect(within(link).getByText("현재 문서", { exact: true })).toHaveClass(
      "hidden",
      "sm:inline",
    );
    const links = within(
      screen.getByRole("navigation", { name: "주요 메뉴" }),
    ).getAllByRole("link");
    expect(links.slice(0, 4).map((item) => item.getAttribute("href"))).toEqual([
      "/examples",
      "/profiles",
      "/result",
      "/privacy",
    ]);
  },
);

it("links a document still under review to the review screen", () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "검토 문서 설정" }));
  expect(screen.getByRole("link", { name: "현재 문서" })).toHaveAttribute(
    "href",
    "/review",
  );
  expect(screen.getByRole("link", { name: "현재 문서" })).not.toHaveAttribute(
    "aria-current",
  );
  expect(screen.getByRole("link", { name: /인터뷰 시작/ })).toHaveClass(
    "hidden",
    "sm:inline-flex",
  );
});

it.each([
  "/interview",
  "/interview/details",
  "/review",
  "/review/details",
  "/admin",
  "/admin/submissions/one",
])("hides the current-document link on the workflow route %s", (pathname) => {
  mount(pathname);
  fireEvent.click(screen.getByRole("button", { name: "완성 문서 설정" }));
  expect(
    screen.queryByRole("link", { name: "현재 문서" }),
  ).not.toBeInTheDocument();
});

it("updates from memory only and restores the start link after clearing the document", () => {
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  mount("/examples");
  fireEvent.click(screen.getByRole("button", { name: "완성 문서 설정" }));
  expect(screen.getByRole("link", { name: "현재 문서" })).toHaveAttribute(
    "href",
    "/result",
  );
  fireEvent.click(screen.getByRole("button", { name: "메모리 문서 제거" }));
  expect(
    screen.queryByRole("link", { name: "현재 문서" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /인터뷰 시작/ })).not.toHaveClass(
    "hidden",
  );
  expect(setItem).not.toHaveBeenCalled();
});
