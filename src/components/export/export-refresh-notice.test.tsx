// @vitest-environment jsdom
import type { ReactNode } from "react";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { LocalProfilesProvider } from "@/components/local-profiles/local-profiles-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { PLATFORM_GUIDES } from "@/content/platform-guides";
import * as repository from "@/lib/storage/profiles/repository";
import { ExportRefreshNotice } from "./export-refresh-notice";

const id = "c1d9ab22-56cd-491b-9654-5bab1976ab91";
const missingId = "dfb651f7-47e2-4a2f-82bb-5cdb3453c9a1";
const firstAt = "2026-10-25T00:00:00.000Z";
const secondAt = "2026-10-26T00:00:00.000Z";
const thirdAt = "2026-10-27T00:00:00.000Z";
const currentAt = "2026-10-28T00:00:00.000Z";
const latestAt = "2026-10-29T00:00:00.000Z";
const guide = PLATFORM_GUIDES[0]!;
const currentGuide = PLATFORM_GUIDES[1]!;
const dateLabel = (date: string) => new Date(date).toLocaleString("ko-KR");

async function fixture({ outdated = true } = {}) {
  const factory = new IDBFactory();
  const options = {
    factory,
    notify: () => {},
    randomId: () => id,
    now: () => firstAt,
  };
  await repository.enableLocalProfiles(options);
  await repository.createLocalProfile(
    {
      origin: "interview",
      confirmed: {
        profile: structuredClone(FICTIONAL_PROFILES[0]!),
        confirmedAt: firstAt,
      },
      suggestedTags: [],
    },
    options,
  );
  await repository.recordExport(
    id,
    { target: guide.id, format: "full", confirmedAt: firstAt },
    { ...options, now: () => secondAt },
  );
  if (outdated) {
    await repository.recordExport(
      id,
      { target: "unknown-tool", format: "core", confirmedAt: firstAt },
      { ...options, now: () => secondAt },
    );
    await repository.recordExport(
      id,
      { target: "result", format: "modules", confirmedAt: firstAt },
      { ...options, now: () => thirdAt },
    );
    const changed = structuredClone(FICTIONAL_PROFILES[0]!);
    changed.profileTitle += " 수정";
    await repository.saveConfirmed(
      id,
      {
        confirmed: { profile: changed, confirmedAt: currentAt },
        expectedRevision: 1,
      },
      { ...options, now: () => currentAt },
    );
    await repository.recordExport(
      id,
      {
        target: currentGuide.id,
        format: "skill-package",
        confirmedAt: currentAt,
      },
      { ...options, now: () => latestAt },
    );
  }
  return { factory, options };
}

function mount(
  factory: IDBFactory,
  mode: "outdated" | "all" = "outdated",
  recordId = id,
) {
  return render(<ExportRefreshNotice recordId={recordId} mode={mode} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <LocalProfilesProvider factory={factory}>
        {children}
      </LocalProfilesProvider>
    ),
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("shows only outdated targets with names, formats, dates and links for recognized guides", async () => {
  const { factory } = await fixture();
  mount(factory);
  expect(
    await screen.findByRole("heading", {
      name: "이전 버전을 내보낸 곳이 있습니다",
    }),
  ).toBeVisible();
  expect(
    screen.getByText(
      /TContext는 내보낸 기록만 알고, 실제로 등록했는지는 알 수 없습니다/,
    ),
  ).toBeVisible();
  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent(
    `결과 화면 · 모듈 선택본 · ${dateLabel(thirdAt)}`,
  );
  const guideRow = rows.find((row) => row.textContent?.includes(guide.name))!;
  expect(guideRow).toHaveTextContent(
    `${guide.name} · 전체본 · ${dateLabel(secondAt)}`,
  );
  expect(
    within(guideRow).getByRole("link", { name: "바꾸는 방법 보기" }),
  ).toHaveAttribute("href", `/ai-guide/${guide.id}`);
  const unknown = rows.find((row) =>
    row.textContent?.includes("unknown-tool"),
  )!;
  expect(unknown).toHaveTextContent(
    `unknown-tool · 핵심본 · ${dateLabel(secondAt)}`,
  );
  expect(within(unknown).queryByRole("link")).not.toBeInTheDocument();
  expect(within(rows[0]!).queryByRole("link")).not.toBeInTheDocument();
  expect(
    screen.queryByText(new RegExp(currentGuide.name)),
  ).not.toBeInTheDocument();
});

it("shows all export records and marks current exports in version-history mode", async () => {
  const { factory } = await fixture();
  mount(factory, "all");
  expect(
    await screen.findByRole("heading", { name: "내보내기 기록" }),
  ).toBeVisible();
  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(4);
  expect(rows[0]).toHaveTextContent(
    `${currentGuide.name} · skill 패키지 · ${dateLabel(latestAt)}`,
  );
  expect(within(rows[0]!).getByText("최신 버전")).toBeVisible();
  expect(screen.getAllByText("최신 버전")).toHaveLength(1);
  expect(
    screen.getByRole("heading", { name: "이전 버전을 내보낸 곳이 있습니다" }),
  ).toBeVisible();
});

it("renders nothing when replacement is unnecessary but keeps current exports visible in all mode", async () => {
  const { factory } = await fixture({ outdated: false });
  const read = vi.spyOn(repository, "getLocalProfile");
  const view = mount(factory);
  await waitFor(() => expect(read).toHaveBeenCalled());
  await act(async () => {
    await read.mock.results[0]!.value;
  });
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(<ExportRefreshNotice recordId={id} mode="all" />);
  expect(
    await screen.findByRole("heading", { name: "내보내기 기록" }),
  ).toBeVisible();
  expect(screen.getByText("최신 버전")).toBeVisible();
  expect(
    screen.queryByText("이전 버전을 내보낸 곳이 있습니다"),
  ).not.toBeInTheDocument();
});

it("does not create or read a database when local saving is disabled", async () => {
  const factory = new IDBFactory();
  const read = vi.spyOn(repository, "getLocalProfile");
  const availability = vi.spyOn(repository, "getLocalProfileAvailability");
  const view = mount(factory);
  await waitFor(() => expect(availability).toHaveBeenCalled());
  await act(async () => {
    await availability.mock.results[0]!.value;
  });
  expect(read).not.toHaveBeenCalled();
  expect(view.container).toBeEmptyDOMElement();
  expect(await factory.databases()).toEqual([]);
});

it.each(["missing", "rejected"] as const)(
  "hides unreadable records (%s) without a visible error",
  async (failure) => {
    const { factory } = await fixture();
    const read = vi.spyOn(repository, "getLocalProfile");
    if (failure === "rejected")
      read.mockRejectedValue(new Error("unavailable"));
    const view = mount(factory, "all", failure === "missing" ? missingId : id);
    await waitFor(() => expect(read).toHaveBeenCalled());
    await act(async () => {
      await read.mock.results[0]!.value.catch(() => {});
    });
    expect(view.container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  },
);

it("ignores a delayed read for an old record after the displayed record changes", async () => {
  const { factory, options } = await fixture();
  const stored = await repository.getLocalProfile(id, options);
  let release!: (value: typeof stored) => void;
  const read = vi.spyOn(repository, "getLocalProfile").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const view = mount(factory);
  await waitFor(() => expect(read).toHaveBeenCalledWith(id, { factory }));
  view.rerender(<ExportRefreshNotice recordId={missingId} />);
  await waitFor(() =>
    expect(read).toHaveBeenCalledWith(missingId, { factory }),
  );
  await act(async () => {
    release(stored);
    await read.mock.results[1]!.value;
  });
  expect(view.container).toBeEmptyDOMElement();
});

it("rereads after another tab's storage notification and removes a now-unnecessary notice", async () => {
  const channels: { onmessage: ((event: { data: unknown }) => void) | null }[] =
    [];
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      constructor() {
        channels.push(this);
      }
      postMessage() {}
      close() {}
    },
  );
  const { factory, options } = await fixture();
  mount(factory);
  await screen.findByRole("heading", {
    name: "이전 버전을 내보낸 곳이 있습니다",
  });
  for (const target of [guide.id, "unknown-tool", "result"])
    await repository.recordExport(
      id,
      { target, format: "core", confirmedAt: currentAt },
      { ...options, now: () => latestAt },
    );
  await act(async () => {
    channels.forEach((channel) =>
      channel.onmessage?.({ data: { type: "changed" } }),
    );
  });
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", {
        name: "이전 버전을 내보낸 곳이 있습니다",
      }),
    ).not.toBeInTheDocument(),
  );
});
