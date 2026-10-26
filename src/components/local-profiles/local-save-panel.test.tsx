// @vitest-environment jsdom
import { useEffect } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import { ResultActions } from "@/components/export/result-actions";
import { contextAsOf } from "@/lib/export/profile-variants";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { LocalProfilesProvider } from "./local-profiles-provider";
import { LocalSavePanel } from "./local-save-panel";
import { getLocalProfile } from "@/lib/storage/profiles/repository";
let session: ReturnType<typeof useInterviewSession>;
function Content() {
  const value = useInterviewSession();
  useEffect(() => {
    session = value;
  });
  const { setProfile } = value;
  useEffect(() => {
    setProfile(structuredClone(FICTIONAL_PROFILES[0]!));
  }, [setProfile]);
  return (
    <>
      <LocalSavePanel />
      {value.profile ? (
        <ResultActions
          profile={value.profile}
          contextAsOf={contextAsOf(value.profile)}
          markdown="# document"
        />
      ) : null}
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("requires opt-in and saves with an independent baseline", async () => {
  const factory = new IDBFactory();
  render(
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory}>
        <Content />
      </LocalProfilesProvider>
    </InterviewSessionProvider>,
  );
  const checkbox = await screen.findByRole("checkbox", {
    name: /프로파일을 저장하는 데 동의/,
  });
  expect(checkbox).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: "이 브라우저에 저장" }),
  ).toBeDisabled();
  expect(await factory.databases()).toEqual([]);
  fireEvent.click(checkbox);
  expect(await factory.databases()).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));
  await screen.findByRole("link", { name: "내 프로파일 열기" });
  expect(session.localProfileLink?.revision).toBe(1);
  const read = await getLocalProfile(session.localProfileLink!.recordId, {
    factory,
  });
  expect(read).toMatchObject({
    ok: true,
    value: { origin: "interview", draft: null },
  });
  expect(session.localProfileLink!.baseline).not.toBe(session.profile);
});
it("keeps downloads available after a quota error", async () => {
  const factory = new IDBFactory();
  render(
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory}>
        <Content />
      </LocalProfilesProvider>
    </InterviewSessionProvider>,
  );
  fireEvent.click(
    await screen.findByRole("checkbox", {
      name: /프로파일을 저장하는 데 동의/,
    }),
  );
  vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(() => {
    throw new DOMException("full", "QuotaExceededError");
  });
  fireEvent.click(screen.getByRole("button", { name: "이 브라우저에 저장" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("저장 공간이 부족"),
  );
  expect(
    screen.getByRole("button", { name: "JSON 백업 다운로드" }),
  ).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "수업 설계용 Markdown 다운로드" }),
  ).toBeEnabled();
  expect(session.localProfileLink).toBeNull();
});
