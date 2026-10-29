// @vitest-environment jsdom
import { useEffect, type ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import {
  LocalProfilesProvider,
  useLocalProfiles,
} from "@/components/local-profiles/local-profiles-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { PLATFORM_GUIDES } from "@/content/platform-guides";
import type { PlatformGuide } from "@/content/platform-guides/schema";
import * as downloads from "@/lib/export/download";
import * as skill from "@/lib/export/skill";
import * as repository from "@/lib/storage/profiles/repository";
import { toConfirmedSnapshot } from "@/lib/storage/profiles/serialize";
import { GuideArtifacts } from "./guide-artifacts";
import { PlatformGuideView } from "./platform-guide-view";

const id = "c1d9ab22-56cd-491b-9654-5bab1976ab91";
const now = "2026-10-30T12:00:00.000Z";
let session: ReturnType<typeof useInterviewSession>;
let local: ReturnType<typeof useLocalProfiles>;
function Probe({ children }: { children: ReactNode }) {
  const current = useInterviewSession();
  const storage = useLocalProfiles();
  useEffect(() => {
    session = current;
    local = storage;
  });
  return children;
}

async function setup({
  enabled = true,
  linked = true,
  changed = false,
  target = "guide-target",
  omitTarget = false,
  guide,
}: {
  enabled?: boolean;
  linked?: boolean;
  changed?: boolean;
  target?: string;
  omitTarget?: boolean;
  guide?: PlatformGuide;
} = {}) {
  const factory = new IDBFactory();
  const options = {
    factory,
    now: () => now,
    randomId: () => id,
    notify: () => {},
  };
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  if (enabled) {
    await repository.enableLocalProfiles(options);
    const confirmed = toConfirmedSnapshot(profile, now);
    if (!confirmed.ok) throw new Error("Invalid fixture");
    await repository.createLocalProfile(
      { origin: "interview", confirmed: confirmed.snapshot, suggestedTags: [] },
      options,
    );
  }
  render(
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory}>
        <Probe>
          {guide ? (
            <PlatformGuideView guide={guide} />
          ) : (
            <GuideArtifacts
              artifacts={[
                "profile-markdown",
                "skill-package",
                "usage-instructions",
              ]}
              exportTarget={omitTarget ? undefined : target}
            />
          )}
        </Probe>
      </LocalProfilesProvider>
    </InterviewSessionProvider>,
  );
  await waitFor(() =>
    expect(local.availability).toBe(enabled ? "enabled" : "disabled"),
  );
  const opened = structuredClone(profile);
  if (changed) opened.profileTitle = "저장된 확정본과 다른 문서";
  act(() =>
    session.openProfile({
      profile: opened,
      suggestedTags: [],
      mode: "view",
      link: linked ? { recordId: id, revision: 1, baseline: profile } : null,
    }),
  );
  const record = vi.spyOn(repository, "recordExport");
  const markdown = vi
    .spyOn(downloads, "downloadMarkdown")
    .mockImplementation(() => {});
  const file = vi
    .spyOn(downloads, "downloadTextFile")
    .mockReturnValue({ ok: true });
  return { factory, record, markdown, file };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ["전체본", "full"],
  ["핵심본", "core"],
  ["모듈 선택본", "modules"],
] as const)(
  "records a successful %s Markdown download with its target and format",
  async (label, format) => {
    const f = await setup();
    fireEvent.click(screen.getByRole("radio", { name: label }));
    fireEvent.click(
      screen.getByRole("button", { name: "교사 Markdown 다운로드" }),
    );
    await waitFor(() =>
      expect(f.record).toHaveBeenCalledWith(
        id,
        { target: "guide-target", format, confirmedAt: now },
        expect.objectContaining({ factory: f.factory }),
      ),
    );
    expect(f.markdown.mock.invocationCallOrder[0]).toBeLessThan(
      f.record.mock.invocationCallOrder[0]!,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Markdown 다운로드를 시작했습니다.",
    );
  },
);

it("records a successful ZIP download independently of the selected Markdown variant", async () => {
  const f = await setup();
  fireEvent.click(screen.getByRole("radio", { name: "핵심본" }));
  fireEvent.click(screen.getByRole("button", { name: "ZIP 패키지 다운로드" }));
  await waitFor(() =>
    expect(f.record).toHaveBeenCalledWith(
      id,
      { target: "guide-target", format: "skill-package", confirmedAt: now },
      expect.objectContaining({ factory: f.factory }),
    ),
  );
  expect(f.file.mock.invocationCallOrder[0]).toBeLessThan(
    f.record.mock.invocationCallOrder[0]!,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "ZIP 패키지 다운로드를 시작했습니다.",
  );
});

it.each([
  ["disabled storage", { enabled: false }],
  ["unlinked session", { linked: false }],
  ["different content", { changed: true }],
  ["missing target", { omitTarget: true }],
] as const)(
  "does not record successful downloads for %s",
  async (_name, options) => {
    const f = await setup(options);
    fireEvent.click(
      screen.getByRole("button", { name: "교사 Markdown 다운로드" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "ZIP 패키지 다운로드" }),
    );
    await act(async () => {
      await repository.listLocalProfiles({ factory: f.factory });
    });
    expect(f.markdown).toHaveBeenCalledOnce();
    expect(f.file).toHaveBeenCalledOnce();
    expect(f.record).not.toHaveBeenCalled();
    if ("enabled" in options && !options.enabled)
      expect(await f.factory.databases()).toEqual([]);
  },
);

it.each(["Markdown", "ZIP"])(
  "does not record a failed %s download",
  async (kind) => {
    const f = await setup();
    if (kind === "Markdown")
      f.markdown.mockImplementation(() => {
        throw new Error("Download failed");
      });
    else f.file.mockReturnValue({ ok: false, error: "download_failed" });
    fireEvent.click(
      screen.getByRole("button", {
        name:
          kind === "Markdown"
            ? "교사 Markdown 다운로드"
            : "ZIP 패키지 다운로드",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "다운로드하지 못했습니다.",
    );
    expect(f.record).not.toHaveBeenCalled();
  },
);

it("does not record a rejected ZIP package or an empty module selection", async () => {
  const f = await setup();
  vi.spyOn(skill, "createSkillPackageFile").mockReturnValue({
    ok: false,
    error: "invalid",
  });
  fireEvent.click(screen.getByRole("button", { name: "ZIP 패키지 다운로드" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "검토를 마친 문서에서만 ZIP 패키지를 만들 수 있습니다.",
  );
  fireEvent.click(screen.getByRole("radio", { name: "모듈 선택본" }));
  fireEvent.click(screen.getByRole("button", { name: "전체 해제" }));
  const markdown = screen.getByRole("button", {
    name: "교사 Markdown 다운로드",
  });
  expect(markdown).toBeDisabled();
  fireEvent.click(markdown);
  expect(f.file).not.toHaveBeenCalled();
  expect(f.markdown).not.toHaveBeenCalled();
  expect(f.record).not.toHaveBeenCalled();
});

it("never records instruction downloads or successful and failed instruction copies", async () => {
  const f = await setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: "test" });
  fireEvent.click(
    screen.getByRole("button", { name: "지침 SKILL.md 내려받기" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "공통 활용 지침 복사" }));
  expect(
    await screen.findByText("공통 활용 지침을 복사했습니다."),
  ).toBeVisible();
  writeText.mockRejectedValue(new Error("Clipboard denied"));
  fireEvent.click(screen.getByRole("button", { name: "공통 활용 지침 복사" }));
  expect(
    await screen.findByText(
      "복사하지 못했습니다. 아래 지침을 직접 선택해 복사해 주세요.",
    ),
  ).toBeVisible();
  expect(f.file).toHaveBeenCalledOnce();
  expect(f.record).not.toHaveBeenCalled();
});

it("keeps successful download feedback when recording rejects", async () => {
  const f = await setup();
  f.record.mockRejectedValue(new Error("Storage unavailable"));
  fireEvent.click(
    screen.getByRole("button", { name: "교사 Markdown 다운로드" }),
  );
  await waitFor(() => expect(f.record).toHaveBeenCalledOnce());
  expect(screen.getByRole("status")).toHaveTextContent(
    "Markdown 다운로드를 시작했습니다.",
  );
  expect(screen.queryByText(/Storage unavailable/)).not.toBeInTheDocument();
});

it.each(PLATFORM_GUIDES)(
  "passes guide id through method artifacts and renders update notes for $name",
  async (guide) => {
    const f = await setup({ guide });
    for (const method of guide.methods) {
      const card = document.getElementById(method.id)!;
      expect(
        within(card).getByText(`문서를 바꿀 때: ${method.updateNote}`),
      ).toBeVisible();
    }
    fireEvent.click(
      screen.getAllByRole("button", { name: "교사 Markdown 다운로드" })[0]!,
    );
    await waitFor(() =>
      expect(f.record).toHaveBeenCalledWith(
        id,
        { target: guide.id, format: "full", confirmedAt: now },
        expect.objectContaining({ factory: f.factory }),
      ),
    );
  },
);

it("omits update-note text when absent and passes an unfamiliar guide id without a branch", async () => {
  const guide = structuredClone(PLATFORM_GUIDES[0]!);
  guide.id = "another-guide";
  guide.methods = [guide.methods[0]!];
  delete guide.methods[0]!.updateNote;
  const f = await setup({ guide });
  expect(screen.queryByText(/문서를 바꿀 때:/)).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "교사 Markdown 다운로드" }),
  );
  await waitFor(() =>
    expect(f.record).toHaveBeenCalledWith(
      id,
      { target: "another-guide", format: "full", confirmedAt: now },
      expect.objectContaining({ factory: f.factory }),
    ),
  );
});
