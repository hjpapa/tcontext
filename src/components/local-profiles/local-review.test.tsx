// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "@/components/layout/interview-session-provider";
import { ProfileReview } from "@/components/profile/profile-review";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { suggestedTagsFromConfirmedTags } from "@/lib/profile/tags";
import * as repository from "@/lib/storage/profiles/repository";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
function Harness() {
  const session = useInterviewSession();
  return session.profile ? (
    <ProfileReview />
  ) : (
    <button
      onClick={() => {
        const profile = structuredClone(FICTIONAL_PROFILES[0]!);
        session.openProfile({
          profile,
          suggestedTags: suggestedTagsFromConfirmedTags(profile.confirmedTags),
          mode: "edit",
          link: {
            recordId: "c1d9ab22-56cd-491b-9654-5bab1976ab91",
            revision: 1,
            baseline: profile,
          },
        });
      }}
    >
      문서 열기
    </button>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  push.mockClear();
});
it.each(["clear", "warning"])(
  "moves to results even when the %s final write fails",
  async (mode) => {
    const save = vi
      .spyOn(repository, "saveConfirmed")
      .mockResolvedValue({ ok: false, error: "quota_exceeded" });
    const draft = vi.spyOn(repository, "saveDraft");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          review:
            mode === "clear"
              ? { status: "clear", items: [] }
              : {
                  status: "needs_review",
                  items: [
                    {
                      text: "가상 경고",
                      reason: "검토",
                      suggestedRewrite: "수정",
                    },
                  ],
                },
        }),
        { status: 200 },
      ),
    );
    render(
      <InterviewSessionProvider>
        <Harness />
      </InterviewSessionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "문서 열기" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /문서 제목, 전체·모듈 요약/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /검토 마치고 개인정보 검사/ }),
    );
    if (mode === "warning") {
      fireEvent.click(
        await screen.findByRole("checkbox", {
          name: /식별 가능한 정보가 남아 있을 수/,
        }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "경고 확인하고 결과 보기" }),
      );
    }
    await waitFor(() => expect(push).toHaveBeenCalledWith("/result"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(draft).not.toHaveBeenCalled();
  },
);
it("adds an unconfirmed teacher-authored empty claim and blocks finalization", async () => {
  render(
    <InterviewSessionProvider>
      <Harness />
    </InterviewSessionProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "문서 열기" }));
  fireEvent.click(screen.getAllByRole("button", { name: "문장 추가" })[0]!);
  expect(screen.getByText("새 문장")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("checkbox", { name: /문서 제목, 전체·모듈 요약/ }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: /검토 마치고 개인정보 검사/ }),
  );
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "모든 문장을 확인해 주세요.",
  );
});
