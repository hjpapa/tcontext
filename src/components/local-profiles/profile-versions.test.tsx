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
import { FICTIONAL_PROFILES } from "@/content/examples";
import * as repository from "@/lib/storage/profiles/repository";
import {
  toConfirmedSnapshot,
  toDraftSnapshot,
} from "@/lib/storage/profiles/serialize";
import type { LocalProfileRecord } from "@/lib/storage/profiles/schema";
import {
  LocalProfilesProvider,
  useLocalProfiles,
} from "./local-profiles-provider";
import { LOCAL_PROFILE_ERROR_MESSAGES } from "./local-save-panel";
import { toViewSession } from "./profile-library";
import { ProfileVersions } from "./profile-versions";

const id = "c1d9ab22-56cd-491b-9654-5bab1976ab91";
const otherId = "6f6d21ed-822c-4a70-8a69-d6041859f602";
const firstAt = "2026-10-25T12:00:00.000Z";
const secondAt = "2026-10-26T12:00:00.000Z";
const currentAt = "2026-10-27T12:00:00.000Z";
const dateLabel = (date: string) => new Date(date).toLocaleString("ko-KR");
const navigation = vi.hoisted(() => ({ record: "", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams({ record: navigation.record }),
}));
let session: ReturnType<typeof useInterviewSession>;
let storage: ReturnType<typeof useLocalProfiles>;
function Probe({ children }: { children: ReactNode }) {
  const value = useInterviewSession();
  const local = useLocalProfiles();
  useEffect(() => {
    session = value;
    storage = local;
  });
  return children;
}
function View({ factory }: { factory: IDBFactory }) {
  return (
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory}>
        <Probe>
          <ProfileVersions />
        </Probe>
      </LocalProfilesProvider>
    </InterviewSessionProvider>
  );
}
function mount(factory: IDBFactory, recordId = id) {
  navigation.record = recordId;
  return render(<View factory={factory} />);
}

async function fixture(withDraft = false) {
  const factory = new IDBFactory();
  let clock = firstAt;
  const options = {
    factory,
    notify: () => {},
    randomId: () => id,
    now: () => clock,
  };
  await repository.enableLocalProfiles(options);
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  profile.profileTitle = "처음 만든 문서";
  const first = toConfirmedSnapshot(profile, firstAt);
  if (!first.ok) throw new Error("Invalid fixture");
  await repository.createLocalProfile(
    { origin: "interview", confirmed: first.snapshot, suggestedTags: [] },
    options,
  );
  profile.profileTitle = "현재 문서 제목";
  clock = secondAt;
  const second = toConfirmedSnapshot(profile, secondAt);
  if (!second.ok) throw new Error("Invalid fixture");
  await repository.saveConfirmed(
    id,
    { confirmed: second.snapshot, expectedRevision: 1 },
    options,
  );
  profile.shortSummary = "수정한 현재 전체 요약";
  clock = currentAt;
  const current = toConfirmedSnapshot(profile, currentAt);
  if (!current.ok) throw new Error("Invalid fixture");
  await repository.saveConfirmed(
    id,
    { confirmed: current.snapshot, expectedRevision: 2 },
    options,
  );
  if (withDraft) {
    const draft = toDraftSnapshot({
      profile,
      suggestedTags: [],
      selectedTagKeys: [],
      baseConfirmedAt: currentAt,
      now: currentAt,
    });
    if (!draft.ok) throw new Error("Invalid fixture");
    await repository.saveDraft(
      id,
      { draft: draft.snapshot, expectedRevision: 3 },
      options,
    );
  }
  const saved = await repository.getLocalProfile(id, options);
  if (!saved.ok) throw new Error("Invalid fixture");
  return { factory, options, record: saved.value };
}

async function shownVersions() {
  return within(
    await screen.findByRole("list", { name: "확정 버전 기록" }),
  ).getAllByRole("listitem");
}
async function confirmAction(
  row: HTMLElement,
  label: string,
  confirmation: string,
) {
  fireEvent.click(within(row).getByRole("button", { name: label }));
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: confirmation }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigation.push.mockClear();
});

it("shows a missing-record notice without creating a database when storage is disabled", async () => {
  const factory = new IDBFactory();
  const read = vi.spyOn(repository, "getLocalProfile");
  mount(factory);
  expect(await screen.findByText("기록을 찾을 수 없습니다")).toBeVisible();
  expect(screen.getByRole("link", { name: "내 프로파일" })).toHaveAttribute(
    "href",
    "/profiles",
  );
  expect(read).not.toHaveBeenCalled();
  expect(await factory.databases()).toEqual([]);
});

it.each(["", "not-a-uuid"])(
  "rejects invalid record id %j before reading the record",
  async (recordId) => {
    const f = await fixture();
    const databases = await f.factory.databases();
    const read = vi.spyOn(repository, "getLocalProfile");
    mount(f.factory, recordId);
    expect(await screen.findByText("기록을 찾을 수 없습니다")).toBeVisible();
    expect(read).not.toHaveBeenCalled();
    expect(await f.factory.databases()).toEqual(databases);
  },
);

it("shows the same notice for an absent record without creating another database", async () => {
  const f = await fixture();
  const databases = await f.factory.databases();
  mount(f.factory, otherId);
  expect(await screen.findByText("기록을 찾을 수 없습니다")).toBeVisible();
  expect(await f.factory.databases()).toEqual(databases);
});

it("renders current and two historical versions in stored order with dates and changed areas", async () => {
  const f = await fixture();
  mount(f.factory);
  const rows = await shownVersions();
  expect(rows).toHaveLength(3);
  expect(screen.getByRole("heading", { name: "현재 문서 제목" })).toBeVisible();
  expect(screen.getByText(`처음 저장 ${dateLabel(firstAt)}`)).toBeVisible();
  expect(rows[0]).toHaveTextContent(
    `현재 확정본${dateLabel(currentAt)}에 확정`,
  );
  expect(rows[1]).toHaveTextContent(
    `${dateLabel(secondAt)}에 확정 · ${dateLabel(currentAt)}까지 사용`,
  );
  expect(rows[2]).toHaveTextContent(
    `${dateLabel(firstAt)}에 확정 · ${dateLabel(secondAt)}까지 사용`,
  );
  expect(within(rows[0]!).getByText("바뀐 영역: 전체 요약")).toBeVisible();
  expect(within(rows[1]!).getByText("바뀐 영역: 전체 요약")).toBeVisible();
  expect(within(rows[2]!).getByText("바뀐 영역: 문서 제목")).toBeVisible();
  expect(
    await screen.findByRole("heading", { name: "내보내기 기록" }),
  ).toBeVisible();
  expect(screen.getByText("아직 내보낸 기록이 없습니다.")).toBeVisible();
});

it("opens and closes the selected comparison accessibly", async () => {
  const f = await fixture();
  mount(f.factory);
  const rows = await shownVersions();
  const compare = within(rows[1]!).getByRole("button", { name: "현재와 비교" });
  expect(compare).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(compare);
  expect(compare).toHaveAttribute("aria-expanded", "true");
  const region = document.getElementById(
    compare.getAttribute("aria-controls")!,
  );
  expect(region).toBeVisible();
  expect(region).toHaveTextContent("수정한 현재 전체 요약");
  expect(region).not.toHaveTextContent("처음 만든 문서");
  fireEvent.click(compare);
  expect(compare).toHaveAttribute("aria-expanded", "false");
  expect(
    document.getElementById(compare.getAttribute("aria-controls")!),
  ).toBeNull();
});

it("opens the current confirmed version in the result session", async () => {
  const f = await fixture();
  mount(f.factory);
  fireEvent.click(
    within((await shownVersions())[0]!).getByRole("button", { name: "보기" }),
  );
  expect(navigation.push).toHaveBeenCalledWith("/result");
  expect(session.profile).toEqual(f.record.confirmed!.profile);
  expect(session.localProfileLink).toMatchObject({
    recordId: id,
    revision: 3,
    baseline: f.record.confirmed!.profile,
  });
  expect(session.markdown).toContain("수정한 현재 전체 요약");
});

it("restores after confirmation, refreshes storage and reopens a linked session without navigation", async () => {
  const f = await fixture();
  mount(f.factory);
  const rows = await shownVersions();
  act(() => session.openProfile(toViewSession(f.record, id)!));
  const restore = vi.spyOn(repository, "restoreVersion");
  fireEvent.click(
    within(rows[1]!).getByRole("button", { name: "이 버전으로 복원" }),
  );
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent(
    "이 버전을 현재 확정본으로 되돌립니다. 지금 확정본은 버전 기록에 남습니다.",
  );
  expect(restore).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "복원" }));
  await waitFor(() => expect(session.localProfileLink?.revision).toBe(4));
  expect(restore).toHaveBeenCalledWith(
    id,
    { confirmedAt: secondAt, expectedRevision: 3 },
    expect.objectContaining({ factory: f.factory }),
  );
  expect(session.profile).toEqual(f.record.history[0]!.profile);
  const updated = await shownVersions();
  expect(updated).toHaveLength(3);
  expect(updated[0]).toHaveTextContent(`${dateLabel(secondAt)}에 확정`);
  expect(updated[1]).toHaveTextContent(`${dateLabel(currentAt)}에 확정`);
  expect(navigation.push).not.toHaveBeenCalled();
});

it.each([false, true])(
  "preserves an unrelated session when restoring (linked elsewhere=%s)",
  async (linked) => {
    const f = await fixture();
    mount(f.factory);
    const rows = await shownVersions();
    const unrelated = structuredClone(FICTIONAL_PROFILES[1]!);
    act(() =>
      session.openProfile({
        profile: unrelated,
        suggestedTags: [],
        mode: "view",
        link: linked
          ? { recordId: otherId, revision: 1, baseline: unrelated }
          : null,
      }),
    );
    await confirmAction(rows[1]!, "이 버전으로 복원", "복원");
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("list", { name: "확정 버전 기록" }),
        ).getAllByRole("listitem")[0],
      ).toHaveTextContent(`${dateLabel(secondAt)}에 확정`),
    );
    expect(session.profile).toEqual(unrelated);
    expect(navigation.push).not.toHaveBeenCalled();
  },
);

it("disables restoration while a draft exists and explains why", async () => {
  const f = await fixture(true);
  mount(f.factory);
  await shownVersions();
  for (const button of screen.getAllByRole("button", {
    name: "이 버전으로 복원",
  })) {
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      "편집 중인 초안을 확정하거나 버린 뒤 복원할 수 있습니다",
    );
  }
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

it("displays the repository error if restoration fails", async () => {
  const f = await fixture();
  mount(f.factory);
  const rows = await shownVersions();
  vi.spyOn(repository, "restoreVersion").mockResolvedValue({
    ok: false,
    error: "conflict",
  });
  await confirmAction(rows[1]!, "이 버전으로 복원", "복원");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    LOCAL_PROFILE_ERROR_MESSAGES.conflict,
  );
  expect(await shownVersions()).toHaveLength(3);
});

it("deletes only the confirmed historical entry after confirmation", async () => {
  const f = await fixture();
  mount(f.factory);
  const rows = await shownVersions();
  const remove = vi.spyOn(repository, "deleteVersion");
  fireEvent.click(within(rows[1]!).getByRole("button", { name: "삭제" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent(
    "이 이전 버전을 지웁니다. 되돌릴 수 없습니다.",
  );
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
  await waitFor(() =>
    expect(
      within(screen.getByRole("list", { name: "확정 버전 기록" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2),
  );
  expect(remove).toHaveBeenCalledWith(
    id,
    { confirmedAt: secondAt },
    expect.objectContaining({ factory: f.factory }),
  );
  const result = await repository.getLocalProfile(id, f.options);
  expect(result).toMatchObject({
    ok: true,
    value: {
      revision: 3,
      confirmed: f.record.confirmed,
      history: [f.record.history[1]],
    },
  });
});

it("refreshes the record when provider items change", async () => {
  const f = await fixture();
  mount(f.factory);
  await shownVersions();
  await repository.deleteVersion(id, { confirmedAt: secondAt }, f.options);
  await act(() => storage.refresh());
  await waitFor(() =>
    expect(
      within(screen.getByRole("list", { name: "확정 버전 기록" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2),
  );
});

it("ignores an old pending read after the record id changes", async () => {
  const f = await fixture();
  const get = repository.getLocalProfile;
  let finish!: (value: Awaited<ReturnType<typeof get>>) => void;
  const read = vi
    .spyOn(repository, "getLocalProfile")
    .mockImplementation((recordId, options) =>
      recordId === id
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : get(recordId, options),
    );
  const view = mount(f.factory);
  await waitFor(() => expect(read).toHaveBeenCalled());
  navigation.record = otherId;
  view.rerender(<View factory={f.factory} />);
  expect(await screen.findByText("기록을 찾을 수 없습니다")).toBeVisible();
  await act(async () => {
    finish({ ok: true, value: f.record });
  });
  expect(screen.getByText("기록을 찾을 수 없습니다")).toBeVisible();
  expect(
    screen.queryByRole("list", { name: "확정 버전 기록" }),
  ).not.toBeInTheDocument();
});

it("shows the unchanged-content fallback for retained identical snapshots", async () => {
  const f = await fixture();
  const record: LocalProfileRecord = structuredClone(f.record);
  record.history[0]!.profile = structuredClone(record.confirmed!.profile);
  vi.spyOn(repository, "getLocalProfile").mockResolvedValue({
    ok: true,
    value: record,
  });
  mount(f.factory);
  const rows = await shownVersions();
  expect(
    within(rows[0]!).getByText("내용 변화 없음(분석 태그만 바뀜)"),
  ).toBeVisible();
  fireEvent.click(
    within(rows[1]!).getByRole("button", { name: "현재와 비교" }),
  );
  expect(
    await screen.findByText("현재 확정본과 내용이 같습니다"),
  ).toBeVisible();
});

it("protects an unsaved session before opening the current confirmed version", async () => {
  const f = await fixture();
  mount(f.factory);
  const rows = await shownVersions();
  const unsaved = structuredClone(FICTIONAL_PROFILES[1]!);
  act(() =>
    session.openProfile({
      profile: unsaved,
      suggestedTags: [],
      mode: "view",
      link: null,
    }),
  );
  const view = within(rows[0]!).getByRole("button", { name: "보기" });
  fireEvent.click(view);
  let dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent("저장하지 않은 문서를 닫을까요?");
  expect(session.profile).toEqual(unsaved);
  expect(navigation.push).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
  expect(session.profile).toEqual(unsaved);
  fireEvent.click(view);
  dialog = await screen.findByRole("alertdialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "다른 문서 열기" }),
  );
  expect(session.profile).toEqual(f.record.confirmed!.profile);
  expect(navigation.push).toHaveBeenCalledWith("/result");
});

it("reopens the restored linked session even when a provider refresh overtakes its read", async () => {
  const f = await fixture();
  mount(f.factory);
  const rows = await shownVersions();
  act(() => session.openProfile(toViewSession(f.record, id)!));
  const restore = repository.restoreVersion;
  vi.spyOn(repository, "restoreVersion").mockImplementation(
    (recordId, input, options) =>
      restore(recordId, input, { ...options, notify: () => {} }),
  );
  const get = repository.getLocalProfile;
  let finish!: (value: Awaited<ReturnType<typeof get>>) => void;
  vi.spyOn(repository, "getLocalProfile").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await confirmAction(rows[1]!, "이 버전으로 복원", "복원");
  await waitFor(() => expect(finish).toBeDefined());
  await act(() => storage.refresh());
  await waitFor(() =>
    expect(
      within(screen.getByRole("list", { name: "확정 버전 기록" })).getAllByRole(
        "listitem",
      )[0],
    ).toHaveTextContent(`${dateLabel(secondAt)}에 확정`),
  );
  const restored = await get(id, f.options);
  await act(async () => {
    finish(restored);
  });
  await waitFor(() => expect(session.localProfileLink?.revision).toBe(4));
  expect(session.profile).toEqual(f.record.history[0]!.profile);
  expect(navigation.push).not.toHaveBeenCalled();
});

it("ignores a pending record read after the storage factory changes", async () => {
  const old = await fixture();
  const next = await fixture();
  const get = repository.getLocalProfile;
  let finish!: (value: Awaited<ReturnType<typeof get>>) => void;
  const read = vi
    .spyOn(repository, "getLocalProfile")
    .mockImplementation((recordId, options) =>
      options?.factory === old.factory
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : get(recordId, options),
    );
  const view = mount(old.factory);
  await waitFor(() => expect(read).toHaveBeenCalled());
  view.rerender(<View factory={next.factory} />);
  await shownVersions();
  old.record.confirmed!.profile.profileTitle = "이전 저장소의 오래된 응답";
  await act(async () => {
    finish({ ok: true, value: old.record });
  });
  expect(screen.getByRole("heading", { name: "현재 문서 제목" })).toBeVisible();
  expect(
    screen.queryByText("이전 저장소의 오래된 응답"),
  ).not.toBeInTheDocument();
});
