// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { contextAsOf } from "@/lib/export/profile-variants";
import { ResultActions } from "./result-actions";
import { ExportVariantPanel } from "./export-variant-panel";
import { ResultView } from "./result-view";

const record = vi.hoisted(() => vi.fn());
vi.mock("./use-record-export", () => ({ useRecordExport: () => record }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./export-refresh-notice", () => ({
  ExportRefreshNotice: ({ recordId }: { recordId: string }) => (
    <output data-testid="notice-id">{recordId}</output>
  ),
}));
const profile = FICTIONAL_PROFILES[0]!;
const props = {
  profile,
  markdown: "# 완성 문서",
  contextAsOf: contextAsOf(profile),
};
function browser() {
  const writeText = vi
    .fn<(text: string) => Promise<void>>()
    .mockResolvedValue();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const createObjectURL = vi.fn(() => "blob:export");
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return { writeText, createObjectURL };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  record.mockReset();
});

it.each([
  ["전체 컨텍스트 복사", "full"],
  ["핵심본 복사", "core"],
] as const)(
  "reports %s only after the clipboard succeeds",
  async (label, format) => {
    const io = browser();
    let finish!: () => void;
    io.writeText.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const onExported = vi.fn();
    render(<ResultActions {...props} onExported={onExported} />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(onExported).not.toHaveBeenCalled();
    finish();
    await waitFor(() =>
      expect(onExported).toHaveBeenCalledExactlyOnceWith(format),
    );
  },
);

it("reports Markdown downloads but excludes text copy, backup and print", async () => {
  browser();
  vi.spyOn(window, "print").mockImplementation(() => {});
  const onExported = vi.fn();
  render(<ResultActions {...props} onExported={onExported} />);
  fireEvent.click(
    screen.getByRole("button", { name: "수업 설계용 Markdown 다운로드" }),
  );
  expect(onExported).toHaveBeenCalledExactlyOnceWith("full");
  onExported.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "일반 텍스트 복사" }));
  await screen.findByRole("button", { name: "일반 텍스트 복사됨" });
  fireEvent.click(screen.getByRole("button", { name: "JSON 백업 다운로드" }));
  fireEvent.click(screen.getByRole("button", { name: "인쇄·PDF 저장" }));
  expect(onExported).not.toHaveBeenCalled();
});

it("does not report failed copy or thrown Markdown download", async () => {
  const io = browser();
  io.writeText.mockRejectedValue(new Error("clipboard denied"));
  const onExported = vi.fn();
  render(<ResultActions {...props} onExported={onExported} />);
  fireEvent.click(screen.getByRole("button", { name: "핵심본 복사" }));
  await screen.findByText(/핵심본 복사에 실패했습니다/);
  io.createObjectURL.mockImplementation(() => {
    throw new Error("download denied");
  });
  const onError = (event: ErrorEvent) => event.preventDefault();
  window.addEventListener("error", onError);
  try {
    fireEvent.click(
      screen.getByRole("button", { name: "수업 설계용 Markdown 다운로드" }),
    );
  } finally {
    window.removeEventListener("error", onError);
  }
  expect(onExported).not.toHaveBeenCalled();
});

it("keeps copy success visible if optional record keeping throws", async () => {
  browser();
  render(
    <ResultActions
      {...props}
      onExported={() => {
        throw new Error("record failed");
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "핵심본 복사" }));
  expect(
    await screen.findByText("핵심본 복사가 완료되었습니다."),
  ).toBeVisible();
  expect(screen.queryByText(/복사에 실패했습니다/)).not.toBeInTheDocument();
});

it.each([
  ["전체본", "full"],
  ["핵심본", "core"],
  ["모듈 선택본", "modules"],
] as const)(
  "reports the selected %s after copy and download",
  async (label, format) => {
    browser();
    const onExported = vi.fn();
    render(<ExportVariantPanel {...props} onExported={onExported} />);
    fireEvent.click(screen.getByRole("radio", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    await waitFor(() =>
      expect(onExported).toHaveBeenCalledExactlyOnceWith(format),
    );
    onExported.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Markdown 다운로드" }));
    expect(onExported).toHaveBeenCalledExactlyOnceWith(format);
  },
);

it("keeps the pending copy format even if the selection changes before completion", async () => {
  const io = browser();
  let finish!: () => void;
  io.writeText.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const onExported = vi.fn();
  render(<ExportVariantPanel {...props} onExported={onExported} />);
  fireEvent.click(screen.getByRole("radio", { name: "핵심본" }));
  fireEvent.click(screen.getByRole("button", { name: "복사" }));
  fireEvent.click(screen.getByRole("radio", { name: "전체본" }));
  finish();
  await waitFor(() =>
    expect(onExported).toHaveBeenCalledExactlyOnceWith("core"),
  );
});

it("skips failed panel exports and isolates record failure from success messages", async () => {
  const io = browser();
  const onExported = vi.fn();
  render(<ExportVariantPanel {...props} onExported={onExported} />);
  io.writeText.mockRejectedValueOnce(new Error("clipboard denied"));
  fireEvent.click(screen.getByRole("button", { name: "복사" }));
  await screen.findByText(/복사하지 못했습니다/);
  io.createObjectURL.mockImplementationOnce(() => {
    throw new Error("download denied");
  });
  fireEvent.click(screen.getByRole("button", { name: "Markdown 다운로드" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "다운로드하지 못했습니다",
  );
  expect(onExported).not.toHaveBeenCalled();
  onExported.mockImplementation(() => {
    throw new Error("record failed");
  });
  fireEvent.click(screen.getByRole("button", { name: "복사" }));
  expect(await screen.findByText("내보낼 내용을 복사했습니다.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Markdown 다운로드" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "Markdown 다운로드를 시작했습니다.",
  );
});

function ViewHarness() {
  const { openProfile } = useInterviewSession();
  return (
    <>
      <button
        onClick={() =>
          openProfile({
            profile,
            suggestedTags: [],
            mode: "view",
            link: {
              recordId: "c1d9ab22-56cd-491b-9654-5bab1976ab91",
              revision: 1,
              baseline: profile,
            },
          })
        }
      >
        문서 열기
      </button>
      <ResultView consentVersion="test" retentionDays={30} />
    </>
  );
}
it("wires result target callbacks and the linked record notice from ResultView", async () => {
  browser();
  render(
    <InterviewSessionProvider>
      <ViewHarness />
    </InterviewSessionProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "문서 열기" }));
  await screen.findByRole("heading", { name: profile.profileTitle });
  fireEvent.click(screen.getByRole("button", { name: "핵심본 복사" }));
  await waitFor(() => expect(record).toHaveBeenCalledWith("result", "core"));
  const panel = within(
    screen.getByRole("region", { name: "필요한 만큼만 전달하기" }),
  );
  fireEvent.click(panel.getByRole("button", { name: "Markdown 다운로드" }));
  expect(record).toHaveBeenLastCalledWith("result", "full");
  expect(screen.getByTestId("notice-id")).toHaveTextContent(
    "c1d9ab22-56cd-491b-9654-5bab1976ab91",
  );
});
