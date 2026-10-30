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
import { useContextAsOf } from "@/components/export/use-context-as-of";
import * as exportRecording from "@/components/export/use-record-export";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { CHATGPT_GUIDE } from "@/content/platform-guides/chatgpt";
import { CLAUDE_GUIDE } from "@/content/platform-guides/claude";
import type { PlatformGuide } from "@/content/platform-guides/schema";
import * as downloads from "@/lib/export/download";
import * as skills from "@/lib/export/skill";
import { contextAsOf, type ContextAsOf } from "@/lib/export/profile-variants";
import {
  createLocalProfile,
  enableLocalProfiles,
} from "@/lib/storage/profiles/repository";
import { toConfirmedSnapshot } from "@/lib/storage/profiles/serialize";
import type { TeacherContextProfile } from "@/types/profile";
import { GuideArtifacts } from "./guide-artifacts";
import { PlatformGuideView } from "./platform-guide-view";

const success = "공개 Agent Skills 형식 검사 통과";
const fallback =
  "문서가 길어 핵심 맥락을 skill 본문에 넣지 못했습니다. 대화 첨부 방식을 권장합니다.";
const incompatible =
  "skill 형식 검사를 통과하지 못했습니다. 대화 첨부 방식을 쓰세요.";
const file = {
  path: "teacher-context.zip",
  mediaType: "application/zip" as const,
  content: new Uint8Array([1, 2]),
};
let session: ReturnType<typeof useInterviewSession>;
let availability: ReturnType<typeof useLocalProfiles>["availability"];
let asOf: ContextAsOf | null;
function Probe({ children }: { children: ReactNode }) {
  const value = useInterviewSession();
  const local = useLocalProfiles();
  const currentAsOf = useContextAsOf(value.profile);
  useEffect(() => {
    session = value;
    availability = local.availability;
    asOf = currentAsOf;
  });
  return children;
}
function mount(guide?: PlatformGuide, factory?: IDBFactory) {
  return render(
    <InterviewSessionProvider>
      <LocalProfilesProvider factory={factory ?? null}>
        <Probe>
          {guide ? (
            <PlatformGuideView guide={guide} />
          ) : (
            <GuideArtifacts
              artifacts={["skill-package"]}
              exportTarget="guide-target"
            />
          )}
        </Probe>
      </LocalProfilesProvider>
    </InterviewSessionProvider>,
  );
}
function open(profile: TeacherContextProfile = FICTIONAL_PROFILES[0]!) {
  act(() =>
    session.openProfile({
      profile: structuredClone(profile),
      suggestedTags: [],
      mode: "view",
      link: null,
    }),
  );
}
function clickZip() {
  fireEvent.click(screen.getByRole("button", { name: "ZIP 패키지 다운로드" }));
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each(FICTIONAL_PROFILES.map((profile, index) => ({ profile, index })))(
  "shows a passed check for normal example $index and passes the generated context date",
  ({ profile }) => {
    const create = vi.spyOn(skills, "createSkillPackageFile");
    const download = vi
      .spyOn(downloads, "downloadTextFile")
      .mockReturnValue({ ok: true });
    const recorded = vi.fn();
    vi.spyOn(exportRecording, "useRecordExport").mockReturnValue(recorded);
    mount();
    open(profile);
    clickZip();
    expect(create).toHaveBeenCalledWith({
      profile,
      now: expect.any(String),
      asOf: contextAsOf(profile),
    });
    expect(download).toHaveBeenCalledOnce();
    expect(screen.getByText(success)).toBeVisible();
    expect(screen.queryByText(fallback)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "ZIP 패키지 다운로드를 시작했습니다.",
    );
    expect(recorded).toHaveBeenCalledWith("guide-target", "skill-package");
  },
);

it("shows fallback guidance alongside a passed check when the generated package omits core content", () => {
  vi.spyOn(skills, "createSkillPackageFile").mockReturnValue({
    ok: true,
    value: file,
    embeddedCore: false,
  });
  const download = vi
    .spyOn(downloads, "downloadTextFile")
    .mockReturnValue({ ok: true });
  mount();
  open();
  clickZip();
  expect(screen.getByText(success)).toBeVisible();
  expect(screen.getByText(fallback)).toBeVisible();
  expect(download).toHaveBeenCalledWith(file, { bom: false });
});

it("blocks incompatible package downloads and recording and shows the issue count", () => {
  vi.spyOn(skills, "createSkillPackageFile").mockReturnValue({
    ok: false,
    error: "incompatible",
    issues: [
      { rule: "structure", detail: "Fixture structure issue" },
      { rule: "reference", detail: "Fixture reference issue" },
    ],
  });
  const download = vi
    .spyOn(downloads, "downloadTextFile")
    .mockReturnValue({ ok: true });
  const recorded = vi.fn();
  vi.spyOn(exportRecording, "useRecordExport").mockReturnValue(recorded);
  mount();
  open();
  clickZip();
  expect(screen.getByText(incompatible)).toBeVisible();
  expect(screen.getByText("문제 2개")).toBeVisible();
  expect(screen.queryByText(success)).not.toBeInTheDocument();
  expect(download).not.toHaveBeenCalled();
  expect(recorded).not.toHaveBeenCalled();
});

it("does not keep a previous passed check after a failed download or a changed profile", () => {
  vi.spyOn(skills, "createSkillPackageFile").mockReturnValue({
    ok: true,
    value: file,
    embeddedCore: true,
  });
  const download = vi
    .spyOn(downloads, "downloadTextFile")
    .mockReturnValue({ ok: true });
  mount();
  open();
  clickZip();
  expect(screen.getByText(success)).toBeVisible();
  download.mockReturnValueOnce({ ok: false, error: "download_failed" });
  clickZip();
  expect(screen.queryByText(success)).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "다운로드하지 못했습니다.",
  );
  clickZip();
  expect(screen.getByText(success)).toBeVisible();
  open(FICTIONAL_PROFILES[1]!);
  expect(screen.queryByText(success)).not.toBeInTheDocument();
});

it("passes the saved confirmation date from useContextAsOf into the skill generator", async () => {
  const factory = new IDBFactory();
  const confirmedAt = "2026-10-29T14:00:00.000Z";
  const id = "c1d9ab22-56cd-491b-9654-5bab1976ab91";
  const profile = structuredClone(FICTIONAL_PROFILES[0]!);
  const options = {
    factory,
    now: () => confirmedAt,
    randomId: () => id,
    notify: () => {},
  };
  await enableLocalProfiles(options);
  const confirmed = toConfirmedSnapshot(profile, confirmedAt);
  if (!confirmed.ok) throw new Error("Invalid fixture");
  await createLocalProfile(
    { origin: "interview", confirmed: confirmed.snapshot, suggestedTags: [] },
    options,
  );
  const create = vi
    .spyOn(skills, "createSkillPackageFile")
    .mockReturnValue({ ok: true, value: file, embeddedCore: true });
  vi.spyOn(downloads, "downloadTextFile").mockReturnValue({ ok: true });
  mount(undefined, factory);
  await waitFor(() => expect(availability).toBe("enabled"));
  act(() =>
    session.openProfile({
      profile,
      suggestedTags: [],
      mode: "view",
      link: { recordId: id, revision: 1, baseline: profile },
    }),
  );
  await waitFor(() => expect(asOf).toEqual(contextAsOf(profile, confirmedAt)));
  clickZip();
  expect(create).toHaveBeenCalledWith({
    profile,
    now: expect.any(String),
    asOf: contextAsOf(profile, confirmedAt),
  });
});

it.each([CHATGPT_GUIDE, CLAUDE_GUIDE])(
  "renders the advanced skill method after existing methods for $id",
  (guide) => {
    mount(guide);
    const method = guide.methods.at(-1)!;
    expect(method.id).toBe(`${guide.id}-skill`);
    const card = screen.getByRole("region", { name: "skill로 등록(고급)" });
    expect(card).toHaveAttribute("id", method.id);
    expect(within(card).getByText("사용 가능")).toBeVisible();
    expect(within(card).getByText("2026년 10월 기준 안내")).toBeVisible();
    expect(within(card).getByText(method.availabilityNote!)).toBeVisible();
    for (const step of method.steps) {
      expect(
        within(card).getByRole("heading", { name: step.title }),
      ).toBeVisible();
      expect(within(card).getByText(step.body)).toBeVisible();
    }
    expect(
      within(card).getByRole("link", { name: "공식 도움말 열기 (새 탭)" }),
    ).toHaveAttribute("href", method.officialUrl);
    expect(
      within(card).getByText(`문서를 바꿀 때: ${method.updateNote}`),
    ).toBeVisible();
    expect(
      within(card).getByRole("button", { name: "ZIP 패키지 다운로드" }),
    ).toBeDisabled();
    open();
    expect(
      within(card).getByRole("button", { name: "ZIP 패키지 다운로드" }),
    ).toBeEnabled();
  },
);
