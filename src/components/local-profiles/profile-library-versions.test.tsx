// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { PLATFORM_GUIDES } from "@/content/platform-guides";
import {
  createLocalProfile,
  enableLocalProfiles,
  getLocalProfile,
  recordExport,
  saveConfirmed,
} from "@/lib/storage/profiles/repository";
import { toDraftSnapshot } from "@/lib/storage/profiles/serialize";
import { LocalProfilesProvider } from "./local-profiles-provider";
import {
  EXPORT_FORMAT_LABELS,
  exportTargetLabel,
  ProfileLibrary,
  toViewSession,
} from "./profile-library";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const id = "c1d9ab22-56cd-491b-9654-5bab1976ab91";
const at = (day: number) => `2026-10-${String(25 + day)}T00:00:00.000Z`;
function Probe() {
  const { profile, localProfileLink, markdown } = useInterviewSession();
  return (
    <output data-testid="session">
      {JSON.stringify({
        title: profile?.profileTitle,
        revision: localProfileLink?.revision,
        hasMarkdown: markdown.length > 0,
      })}
    </output>
  );
}
function mount(factory: IDBFactory) {
  render(
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory}>
        <ProfileLibrary />
        <Probe />
      </LocalProfilesProvider>
    </InterviewSessionProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("shows creation time, version counts, last export and outdated targets while preserving view behavior", async () => {
  const factory = new IDBFactory();
  const options = {
    factory,
    now: () => at(0),
    randomId: () => id,
    notify: () => {},
  };
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  await enableLocalProfiles(options);
  expect(
    (
      await createLocalProfile(
        {
          origin: "interview",
          confirmed: { profile, confirmedAt: at(0) },
          suggestedTags: [],
        },
        options,
      )
    ).ok,
  ).toBe(true);
  await recordExport(
    id,
    { target: "result", format: "core", confirmedAt: at(0) },
    { ...options, now: () => at(1) },
  );
  const next = { ...profile, profileTitle: "수정한 문서" };
  expect(
    (
      await saveConfirmed(
        id,
        {
          confirmed: { profile: next, confirmedAt: at(2) },
          expectedRevision: 1,
        },
        { ...options, now: () => at(2) },
      )
    ).ok,
  ).toBe(true);
  await recordExport(
    id,
    { target: PLATFORM_GUIDES[0]!.id, format: "modules", confirmedAt: at(2) },
    { ...options, now: () => at(3) },
  );
  const current = {
    ...next,
    shortSummary: `${next.shortSummary} 새 요약입니다.`,
  };
  expect(
    (
      await saveConfirmed(
        id,
        {
          confirmed: { profile: current, confirmedAt: at(4) },
          expectedRevision: 2,
        },
        { ...options, now: () => at(4) },
      )
    ).ok,
  ).toBe(true);
  mount(factory);
  const heading = await screen.findByRole("heading", {
    name: current.profileTitle,
  });
  const item = within(heading.closest("li")!);
  expect(
    item.getByText(`처음 저장 ${new Date(at(0)).toLocaleString("ko-KR")}`),
  ).toBeInTheDocument();
  expect(item.getByText("버전 3개")).toBeInTheDocument();
  expect(item.getByRole("link", { name: "버전 기록" })).toHaveAttribute(
    "href",
    `/profiles/versions?record=${id}`,
  );
  expect(
    item.getByText(
      `최근 내보낸 기록: ${PLATFORM_GUIDES[0]!.name} · 모듈 선택본 · ${new Date(at(3)).toLocaleString("ko-KR")}`,
    ),
  ).toBeInTheDocument();
  expect(item.getByText("이전 버전을 내보낸 곳 2곳")).toBeInTheDocument();
  fireEvent.click(item.getByRole("button", { name: "보기" }));
  await screen.findByText(
    (_, element) =>
      element?.getAttribute("data-testid") === "session" &&
      element.textContent ===
        JSON.stringify({
          title: current.profileTitle,
          revision: 3,
          hasMarkdown: true,
        }),
  );
  expect(push).toHaveBeenCalledWith("/result");
});

it("shows zero versions without a history link for an imported draft", async () => {
  const factory = new IDBFactory();
  const options = {
    factory,
    now: () => at(0),
    randomId: () => id,
    notify: () => {},
  };
  await enableLocalProfiles(options);
  const snapshot = toDraftSnapshot({
    profile: FICTIONAL_PROFILES[0]!,
    suggestedTags: [],
    selectedTagKeys: [],
    baseConfirmedAt: null,
    now: at(0),
  });
  if (!snapshot.ok) throw new Error("invalid draft fixture");
  expect(
    (
      await createLocalProfile(
        { origin: "import", draft: snapshot.snapshot, suggestedTags: [] },
        options,
      )
    ).ok,
  ).toBe(true);
  const stored = await getLocalProfile(id, options);
  if (!stored.ok) throw new Error("missing fixture");
  expect(toViewSession(stored.value, id)).toBeNull();
  mount(factory);
  expect(await screen.findByText("버전 0개")).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "버전 기록" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/최근 내보낸 기록:/)).not.toBeInTheDocument();
});

it("labels export formats and keeps unknown target ids readable", () => {
  expect(exportTargetLabel("result")).toBe("결과 화면");
  expect(exportTargetLabel("unknown-tool")).toBe("unknown-tool");
  expect(EXPORT_FORMAT_LABELS).toEqual({
    full: "전체본",
    core: "핵심본",
    modules: "모듈 선택본",
    "skill-package": "skill 패키지",
  });
});
