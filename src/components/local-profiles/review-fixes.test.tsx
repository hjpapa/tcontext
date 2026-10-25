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
import { afterEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import {
  LocalProfilesProvider,
  useLocalProfiles,
} from "./local-profiles-provider";
import { EditAgainButton } from "./edit-again-button";
import { LocalSavePanel } from "./local-save-panel";
import { SavedProfilesEntry } from "./saved-profiles-entry";
import { ProfileLibrary } from "./profile-library";
import { ProfileReview } from "@/components/profile/profile-review";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { PROFILE_MODULE_TITLES } from "@/types/profile";
import {
  createLocalProfile,
  enableLocalProfiles,
  getLocalProfile,
  saveDraft,
} from "@/lib/storage/profiles/repository";
import {
  toConfirmedSnapshot,
  toDraftSnapshot,
} from "@/lib/storage/profiles/serialize";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
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
const now = "2026-10-25T12:00:00.000Z";
async function setup(
  children: ReactNode,
  draft = false,
  baseline = true,
  linked = true,
) {
  const factory = new IDBFactory();
  const options = { factory, notify: () => {} };
  await enableLocalProfiles(options);
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  const confirmed = toConfirmedSnapshot(profile, now);
  if (!confirmed.ok) throw new Error("fixture");
  const created = await createLocalProfile(
    { origin: "interview", confirmed: confirmed.snapshot, suggestedTags: [] },
    options,
  );
  if (!created.ok) throw new Error("fixture");
  if (draft) {
    const copy = structuredClone(profile);
    copy.profileTitle = "아직 확정하지 않은 초안";
    const snapshot = toDraftSnapshot({
      profile: copy,
      suggestedTags: [],
      selectedTagKeys: new Set(),
      baseConfirmedAt: now,
      now,
    });
    if (!snapshot.ok) throw new Error("fixture");
    await saveDraft(
      created.value.id,
      { draft: snapshot.snapshot, expectedRevision: 1 },
      options,
    );
  }
  render(
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory}>
        <Probe>{children}</Probe>
      </LocalProfilesProvider>
    </InterviewSessionProvider>,
  );
  await waitFor(() => expect(storage.availability).toBe("enabled"));
  act(() =>
    session.openProfile({
      profile,
      suggestedTags: [],
      mode: "view",
      link: linked
        ? {
            recordId: created.value.id,
            revision: draft ? 2 : 1,
            baseline: baseline ? profile : null,
          }
        : null,
    }),
  );
  return { options, id: created.value.id, profile };
}
afterEach(() => {
  cleanup();
  push.mockClear();
  vi.restoreAllMocks();
});
it.each(["초안 이어서 수정", "확정본에서 새로 시작", "취소"])(
  "protects the draft when choosing %s",
  async (choice) => {
    const { options, id, profile } = await setup(<EditAgainButton />, true);
    const before = await getLocalProfile(id, options);
    fireEvent.click(screen.getByRole("link", { name: "다시 수정하기" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("편집 중인 초안이 있습니다");
    expect(dialog).toHaveTextContent(
      "첫 수정이 저장되면 기존 초안은 대체됩니다",
    );
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "초안 이어서 수정" }),
      ).toHaveFocus(),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: choice }));
    expect(session.profile?.profileTitle).toBe(
      choice === "초안 이어서 수정"
        ? "아직 확정하지 않은 초안"
        : profile.profileTitle,
    );
    if (choice === "취소") expect(push).not.toHaveBeenCalled();
    else expect(push).toHaveBeenCalledWith("/review");
    expect(await getLocalProfile(id, options)).toEqual(before);
  },
);
it.each([true, false])(
  "opens without a dialog when no saved draft (linked=%s)",
  async (linked) => {
    await setup(<EditAgainButton />, false, true, linked);
    fireEvent.click(screen.getByRole("link", { name: "다시 수정하기" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/review"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  },
);
it("reports a failed lookup without leaving the result", async () => {
  await setup(<EditAgainButton />);
  act(() =>
    session.setLocalProfileLink(
      (link) =>
        link && { ...link, recordId: "c1d9ab22-56cd-491b-9654-5bab1976ab91" },
    ),
  );
  fireEvent.click(screen.getByRole("link", { name: "다시 수정하기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("찾지 못했습니다");
  expect(push).not.toHaveBeenCalled();
});
it.each(["saving", "error", "saved"] as const)(
  "displays only the current confirmed write status: %s",
  async (phase) => {
    await setup(<LocalSavePanel />);
    act(() =>
      storage.setWriteStatus({
        recordId: session.localProfileLink!.recordId,
        openedAt: session.localProfileLink!.openedAt,
        kind: "confirmed",
        phase,
        ...(phase === "error" ? { error: "quota_exceeded" as const } : {}),
        savedAt: now,
      }),
    );
    if (phase === "saving")
      expect(screen.getByRole("status")).toHaveTextContent("확정본 저장 중…");
    if (phase === "error") {
      expect(
        screen.getByRole("heading", {
          name: "최신 확정본을 이 브라우저에 저장하지 못했습니다",
        }),
      ).toBeVisible();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "다운로드는 계속 사용할 수 있습니다",
      );
    }
    if (phase === "saved")
      expect(screen.getByRole("status")).toHaveTextContent("저장됨");
    else expect(screen.queryByText(/^저장됨/)).toBeNull();
  },
);
it("overwrites a confirmed conflict only after confirmation using the latest revision", async () => {
  const { options, id, profile } = await setup(<LocalSavePanel />, true);
  act(() => {
    session.setProfile({ ...profile, profileTitle: "현재 탭의 확정본" });
    storage.setWriteStatus({
      recordId: id,
      openedAt: session.localProfileLink!.openedAt,
      kind: "confirmed",
      phase: "error",
      error: "conflict",
    });
  });
  fireEvent.click(
    screen.getByRole("button", { name: "이 확정본으로 덮어쓰기" }),
  );
  expect(screen.getByRole("alertdialog")).toHaveTextContent(
    "다른 탭에서 저장한 내용이 이 확정본으로 바뀝니다",
  );
  expect(await getLocalProfile(id, options)).toMatchObject({
    ok: true,
    value: { revision: 2 },
  });
  const overwriteButton = within(screen.getByRole("alertdialog")).getByRole(
    "button",
    { name: "덮어쓰기" },
  );
  expect(overwriteButton).toHaveAttribute("data-variant", "destructive");
  fireEvent.click(overwriteButton);
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("저장됨"),
  );
  expect(await getLocalProfile(id, options)).toMatchObject({
    ok: true,
    value: {
      revision: 3,
      draft: null,
      confirmed: { profile: { profileTitle: "현재 탭의 확정본" } },
    },
  });
  expect(session.localProfileLink?.baseline?.profileTitle).toBe(
    "현재 탭의 확정본",
  );
  expect(session.localProfileLink?.revision).toBe(3);
});
it("shows one imported-draft notice and descriptive add buttons without baseline badges", async () => {
  await setup(<ProfileReview />, false, false);
  expect(
    screen.getAllByText(
      "확정본이 없는 가져온 초안입니다. 모든 문장을 다시 확인한 뒤 검토를 마쳐 주세요.",
    ),
  ).toHaveLength(1);
  expect(screen.queryAllByText(/^(새 문장|수정됨|변경)$/)).toHaveLength(0);
  expect(screen.queryByText(/확정본 대비 변경/)).toBeNull();
  for (const title of Object.values(PROFILE_MODULE_TITLES))
    expect(
      screen.getByRole("button", { name: `${title} 문장 추가` }),
    ).toBeVisible();
});
it("does not announce every edit and styles change indicators", async () => {
  await setup(<ProfileReview />);
  fireEvent.change(screen.getAllByLabelText("문장 직접 수정")[0]!, {
    target: { value: "교사가 수정한 문장" },
  });
  expect(screen.getByText(/확정본 대비 변경/)).not.toHaveAttribute("aria-live");
  expect(screen.getByText("수정됨")).toHaveClass("rounded-full");
});
it("hides the saved entry until records are listed and exposes the revised import heading", async () => {
  await setup(
    <>
      <SavedProfilesEntry />
      <ProfileLibrary />
    </>,
  );
  await screen.findByRole("heading", { name: "JSON 백업 불러오기" });
  await screen.findByRole("link", { name: "저장한 프로파일 1개 · 열기" });
  expect(screen.queryByText("저장한 프로파일 0개 · 열기")).toBeNull();
  expect(screen.getByText("저장한 프로파일 1개 / 10개")).toBeVisible();
});

it("renders no saved entry for an enabled empty database", async () => {
  const factory = new IDBFactory();
  await enableLocalProfiles({ factory, notify: () => {} });
  render(
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory}>
        <Probe>
          <SavedProfilesEntry />
        </Probe>
      </LocalProfilesProvider>
    </InterviewSessionProvider>,
  );
  await waitFor(() => expect(storage.availability).toBe("enabled"));
  await act(() => storage.refresh());
  expect(screen.queryByRole("link")).toBeNull();
});
