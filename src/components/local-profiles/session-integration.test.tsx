// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import {
  suggestedTagsFromConfirmedTags,
  selectedTagKeysFromConfirmedTags,
} from "@/lib/profile/tags";
import {
  LocalProfilesProvider,
  useLocalProfiles,
} from "./local-profiles-provider";
import { enableLocalProfiles } from "@/lib/storage/profiles/repository";
import { ProfileReview } from "@/components/profile/profile-review";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
let session: ReturnType<typeof useInterviewSession>;
function Probe() {
  const value = useInterviewSession();
  useEffect(() => {
    session = value;
  });
  return value.profile ? <ProfileReview /> : null;
}
function Availability() {
  return <p>{useLocalProfiles().availability}</p>;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("opens profiles atomically, clears secrets and preserves tags through final review", async () => {
  render(
    <InterviewSessionProvider>
      <Probe />
    </InterviewSessionProvider>,
  );
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  const input = {
    profile,
    suggestedTags: suggestedTagsFromConfirmedTags(profile.confirmedTags),
    mode: "edit" as const,
    link: { recordId: "test", revision: 1, baseline: profile },
  };
  act(() => {
    session.setPrivacyReviewToken("token");
    session.setContributionReceipt({
      submissionId: "id",
      deletionToken: "secret",
      createdAt: "now",
      retentionUntil: "later",
    });
  });
  act(() => session.openProfile(input));
  expect(session.privacyReviewToken).toBeNull();
  expect(session.contributionReceipt).toBeNull();
  expect(session.markdown).toBe("");
  const openedAt = session.localProfileLink!.openedAt;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    expect(
      selectedTagKeysFromConfirmedTags(body.profile.confirmedTags),
    ).toEqual(selectedTagKeysFromConfirmedTags(profile.confirmedTags));
    return new Response(
      JSON.stringify({
        review: { status: "clear", items: [] },
        reviewToken: "new-token",
      }),
      { status: 200 },
    );
  });
  fireEvent.click(
    screen.getByRole("checkbox", { name: /문서 제목, 전체·모듈 요약/ }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /검토 마치고 개인정보 검사/ }),
  );
  await waitFor(() => expect(push).toHaveBeenCalledWith("/result"));
  act(() => session.openProfile({ ...input, mode: "view" }));
  expect(session.markdown).toBe(profileToMarkdown(profile));
  expect(session.localProfileLink!.openedAt).toBeGreaterThan(openedAt);
  const next = session.localProfileLink!.openedAt;
  act(() =>
    session.setLocalProfileLink((link) => link && { ...link, revision: 2 }),
  );
  expect(session.localProfileLink!.openedAt).toBe(next);
});
it("clears the memory link without deleting a database and opens imports without a link", async () => {
  const factory = new IDBFactory();
  await enableLocalProfiles({ factory, notify: () => {} });
  vi.stubGlobal("indexedDB", factory);
  render(
    <InterviewSessionProvider>
      <Probe />
    </InterviewSessionProvider>,
  );
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  act(() =>
    session.openProfile({
      profile,
      suggestedTags: [],
      mode: "edit",
      link: { recordId: "test", revision: 1, baseline: profile },
    }),
  );
  act(() => session.clearBrowserRecords());
  expect(session.localProfileLink).toBeNull();
  expect(await factory.databases()).toHaveLength(1);
  act(() =>
    session.openProfile({
      profile,
      suggestedTags: [],
      mode: "edit",
      link: null,
    }),
  );
  expect(session.localProfileLink).toBeNull();
  expect(session.markdown).toBe("");
});
it("checks availability on mount without creating a database", async () => {
  const factory = new IDBFactory();
  render(
    <LocalProfilesProvider factory={factory}>
      <Availability />
    </LocalProfilesProvider>,
  );
  await screen.findByText("disabled");
  expect(await factory.databases()).toEqual([]);
});
