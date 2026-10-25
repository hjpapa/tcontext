// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { InterviewSessionProvider } from "@/components/layout/interview-session-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { createProfileBackupFile } from "@/lib/storage/profiles/backup";
import {
  getLocalProfile,
  enableLocalProfiles,
  createLocalProfile,
} from "@/lib/storage/profiles/repository";
import { toConfirmedSnapshot } from "@/lib/storage/profiles/serialize";
import { LocalProfilesProvider } from "./local-profiles-provider";
import { ProfileLibrary } from "./profile-library";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const now = "2026-10-25T00:00:00.000Z";
function renderLibrary(factory: IDBFactory) {
  render(
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory}>
        <ProfileLibrary />
      </LocalProfilesProvider>
    </InterviewSessionProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  push.mockClear();
});
it("does not create a database on a disabled library visit or memory-only import", async () => {
  const factory = new IDBFactory();
  renderLibrary(factory);
  await screen.findByRole("button", { name: "로컬 저장 켜기" });
  expect(await factory.databases()).toEqual([]);
  const file = createProfileBackupFile({
    kind: "confirmed",
    profile: FICTIONAL_PROFILES[0]!,
    suggestedTags: [],
    now,
  });
  if (!file.ok) throw new Error("fixture");
  fireEvent.change(screen.getByLabelText("JSON 백업 파일 선택"), {
    target: {
      files: [
        {
          name: "backup.json",
          size: file.value.content.length,
          text: async () => file.value.content,
        },
      ],
    },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "저장하지 않고 열기" }),
  );
  expect(push).toHaveBeenCalledWith("/review");
  expect(await factory.databases()).toEqual([]);
});
it("imports into an existing draft without replacing the confirmed snapshot", async () => {
  const factory = new IDBFactory();
  const options = {
    factory,
    notify: () => {},
    now: () => now,
    randomId: () => "c1d9ab22-56cd-491b-9654-5bab1976ab91",
  };
  await enableLocalProfiles(options);
  const snapshot = toConfirmedSnapshot(FICTIONAL_PROFILES[0]!, now);
  if (!snapshot.ok) throw new Error("fixture");
  const created = await createLocalProfile(
    { origin: "interview", confirmed: snapshot.snapshot, suggestedTags: [] },
    options,
  );
  if (!created.ok) throw new Error("fixture");
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  profile.profileTitle = "가져온 초안";
  const file = createProfileBackupFile({
    kind: "confirmed",
    profile,
    suggestedTags: [],
    recordId: created.value.id,
    now,
  });
  if (!file.ok) throw new Error("fixture");
  renderLibrary(factory);
  await screen.findByRole("button", { name: "수정하기" });
  fireEvent.change(screen.getByLabelText("JSON 백업 파일 선택"), {
    target: {
      files: [
        {
          name: "backup.json",
          size: file.value.content.length,
          text: async () => file.value.content,
        },
      ],
    },
  });
  fireEvent.click(
    await screen.findByRole("button", {
      name: "기존 프로파일의 편집 초안으로 불러오기",
    }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "계속" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/review"));
  const result = await getLocalProfile(created.value.id, options);
  expect(result).toMatchObject({
    ok: true,
    value: {
      revision: 2,
      confirmed: snapshot.snapshot,
      draft: {
        profile: {
          profileTitle: "가져온 초안",
          privacyReview: { status: "needs_review" },
        },
      },
    },
  });
});
