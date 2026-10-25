// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import PrivacyPage from "@/app/privacy/page";
import { InterviewSessionProvider } from "@/components/layout/interview-session-provider";
import { LocalProfilesProvider } from "./local-profiles-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import {
  createLocalProfile,
  enableLocalProfiles,
  listLocalProfiles,
} from "@/lib/storage/profiles/repository";
import { toConfirmedSnapshot } from "@/lib/storage/profiles/serialize";

afterEach(cleanup);
it("explains opt-in retention and keeps tab deletion separate from confirmed database deletion", async () => {
  const factory = new IDBFactory();
  const options = { factory, notify: () => {} };
  await enableLocalProfiles(options);
  const snapshot = toConfirmedSnapshot(
    FICTIONAL_PROFILES[0]!,
    new Date().toISOString(),
  );
  if (!snapshot.ok) throw new Error("Invalid fixture");
  const created = await createLocalProfile(
    { origin: "interview", confirmed: snapshot.snapshot, suggestedTags: [] },
    options,
  );
  expect(created.ok).toBe(true);
  render(
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory}>
        <PrivacyPage />
      </LocalProfilesProvider>
    </InterviewSessionProvider>,
  );
  const section = screen.getByRole("region", {
    name: "이 브라우저에 보관하는 내 프로파일",
  });
  expect(section.textContent).toContain("교사가 켠 경우에만");
  expect(section.textContent).toContain(
    "원문 답변은 IndexedDB에 저장하지 않습니다",
  );
  expect(section.textContent).toContain("자동 만료는 없습니다");
  expect(section.textContent).toContain("공용 기기");
  fireEvent.click(
    screen.getByRole("button", { name: "이 탭의 모든 기록 삭제" }),
  );
  expect(await listLocalProfiles(options)).toMatchObject({
    ok: true,
    value: [{ id: created.ok ? created.value.id : "" }],
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "로컬 저장 끄고 모두 삭제" }),
  );
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "취소",
    }),
  );
  expect(await factory.databases()).toHaveLength(1);
  fireEvent.click(
    screen.getByRole("button", { name: "로컬 저장 끄고 모두 삭제" }),
  );
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "계속",
    }),
  );
  await waitFor(async () => expect(await factory.databases()).toEqual([]));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "로컬 저장 끄고 모두 삭제" }),
    ).toBeNull(),
  );
});
