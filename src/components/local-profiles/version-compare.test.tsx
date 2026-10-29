// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FICTIONAL_PROFILES } from "@/content/examples";
import { VARIANT_SECTION_TITLES } from "@/content/export-variants";
import {
  PROFILE_MODULE_IDS,
  PROFILE_MODULE_TITLES,
  UNVERIFIED_PRIVACY_REVIEW,
  type ProfileClaim,
} from "@/types/profile";
import { changedAreaLabel, VersionCompare } from "./version-compare";

afterEach(cleanup);

function profiles() {
  const before = structuredClone(FICTIONAL_PROFILES[0]!);
  return { before, after: structuredClone(before) };
}

function columns(title: string) {
  const area = screen.getByRole("region", { name: title });
  return {
    area,
    before: within(area).getByRole("region", { name: "이전 버전" }),
    after: within(area).getByRole("region", { name: "현재 확정본" }),
  };
}

function claim(
  id: string,
  text: string,
  basis: ProfileClaim["basis"],
): ProfileClaim {
  return {
    id,
    text,
    basis,
    evidenceQuestionIds: ["teacher-authored"],
    confirmedByUser: basis !== "needs_confirmation",
  };
}

it("uses the approved labels for profile, module and synthesis areas", () => {
  expect(changedAreaLabel({ kind: "profile", field: "profileTitle" })).toBe(
    "문서 제목",
  );
  expect(changedAreaLabel({ kind: "profile", field: "shortSummary" })).toBe(
    "전체 요약",
  );
  for (const id of PROFILE_MODULE_IDS)
    expect(changedAreaLabel({ kind: "module", id })).toBe(
      PROFILE_MODULE_TITLES[id],
    );
  for (const id of [
    "teachingDesignPrinciples",
    "classSupportConsiderations",
    "realisticConstraints",
    "aiCollaborationInstructions",
  ] as const)
    expect(changedAreaLabel({ kind: "synthesis", id })).toBe(
      VARIANT_SECTION_TITLES[id],
    );
});

it("shows only changed profile fields with visible previous and current labels", () => {
  const { before, after } = profiles();
  before.shortSummary = "이전 요약 첫 줄\n이전 요약 둘째 줄";
  after.shortSummary = "현재 요약 첫 줄\n현재 요약 둘째 줄";
  render(<VersionCompare before={before} after={after} />);
  const comparison = columns("전체 요약");
  expect(
    within(comparison.before).getByRole("heading", { name: "이전 버전" }),
  ).toBeVisible();
  expect(
    within(comparison.after).getByRole("heading", { name: "현재 확정본" }),
  ).toBeVisible();
  expect(
    within(comparison.before).getByText(/이전 요약 첫 줄/).textContent,
  ).toBe(before.shortSummary);
  expect(
    within(comparison.after).getByText(/현재 요약 첫 줄/).textContent,
  ).toBe(after.shortSummary);
  expect(
    screen.queryByRole("region", { name: "문서 제목" }),
  ).not.toBeInTheDocument();
  for (const title of Object.values(PROFILE_MODULE_TITLES))
    expect(
      screen.queryByRole("region", { name: title }),
    ).not.toBeInTheDocument();
  for (const title of Object.values(VARIANT_SECTION_TITLES))
    expect(
      screen.queryByRole("region", { name: title }),
    ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "개인정보 상태" }),
  ).not.toBeInTheDocument();
});

it("shows complete changed modules with claim changes and evidence distinctions on the correct sides", () => {
  const { before, after } = profiles();
  before.modules[0]!.claims = [
    claim("removed-claim", "삭제되는 직접 진술", "direct"),
    claim("edited-claim", "이전 해석 문장", "inferred"),
    claim("unchanged-claim", "계속 확인이 필요한 문장", "needs_confirmation"),
  ];
  after.modules[0]!.claims = [
    claim("edited-claim", "수정된 해석 문장\n두 번째 줄", "inferred"),
    claim("added-claim", "추가된 직접 진술", "direct"),
    structuredClone(before.modules[0]!.claims[2]!),
  ];
  after.modules[0]!.title = "수정한 모듈 제목";
  after.modules[0]!.summary = "수정한 모듈 요약";
  render(<VersionCompare before={before} after={after} />);
  const comparison = columns(PROFILE_MODULE_TITLES.identity_and_role);
  expect(
    within(comparison.before).getByText(before.modules[0]!.title),
  ).toBeVisible();
  expect(
    within(comparison.before).getByText(before.modules[0]!.summary),
  ).toBeVisible();
  expect(within(comparison.after).getByText("수정한 모듈 제목")).toBeVisible();
  expect(within(comparison.after).getByText("수정한 모듈 요약")).toBeVisible();
  const removed = within(comparison.before)
    .getByText("삭제되는 직접 진술")
    .closest("li")!;
  expect(within(removed).getByText("삭제")).toBeVisible();
  expect(within(removed).getByText("직접 진술")).toBeVisible();
  expect(
    within(comparison.after).queryByText("삭제되는 직접 진술"),
  ).not.toBeInTheDocument();
  const added = within(comparison.after)
    .getByText("추가된 직접 진술")
    .closest("li")!;
  expect(within(added).getByText("추가")).toBeVisible();
  expect(
    within(comparison.before).queryByText("추가된 직접 진술"),
  ).not.toBeInTheDocument();
  for (const side of [comparison.before, comparison.after]) {
    const edited = within(side)
      .getByText(/해석 문장/)
      .closest("li")!;
    expect(within(edited).getByText("수정")).toBeVisible();
    expect(within(edited).getByText("AI 추론")).toBeVisible();
    const unchanged = within(side)
      .getByText("계속 확인이 필요한 문장")
      .closest("li")!;
    expect(within(unchanged).getByText("확인 필요")).toBeVisible();
    expect(within(unchanged).getByText("검토 전")).toBeVisible();
    expect(
      within(unchanged).queryByText(/^(추가|수정|삭제)$/),
    ).not.toBeInTheDocument();
  }
  expect(
    within(comparison.after).getByText(/수정된 해석 문장/).textContent,
  ).toBe("수정된 해석 문장\n두 번째 줄");
  expect(
    screen.queryByRole("region", {
      name: PROFILE_MODULE_TITLES.educational_philosophy,
    }),
  ).not.toBeInTheDocument();
});

it("shows reordered claims in each original order without labelling them as additions or deletions", () => {
  const { before, after } = profiles();
  before.modules[0]!.claims = [
    claim("first-claim", "첫 문장", "direct"),
    claim("second-claim", "둘째 문장", "inferred"),
  ];
  after.modules[0]!.claims = structuredClone(
    before.modules[0]!.claims,
  ).reverse();
  render(<VersionCompare before={before} after={after} />);
  const comparison = columns(PROFILE_MODULE_TITLES.identity_and_role);
  expect(
    within(comparison.before)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("p")?.textContent),
  ).toEqual(["첫 문장", "둘째 문장"]);
  expect(
    within(comparison.after)
      .getAllByRole("listitem")
      .map((item) => item.querySelector("p")?.textContent),
  ).toEqual(["둘째 문장", "첫 문장"]);
  expect(screen.queryByText(/^(추가|수정|삭제)$/)).not.toBeInTheDocument();
});

it("keeps the complete synthesis lists, order, duplicate entries and multiline text", () => {
  const { before, after } = profiles();
  before.teachingDesignPrinciples = ["유지할 원칙", "이전 원칙"];
  after.teachingDesignPrinciples = [
    "유지할 원칙",
    "새 원칙\n상세 설명",
    "유지할 원칙",
  ];
  render(<VersionCompare before={before} after={after} />);
  const comparison = columns(VARIANT_SECTION_TITLES.teachingDesignPrinciples);
  expect(
    within(comparison.before)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(before.teachingDesignPrinciples);
  expect(
    within(comparison.after)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(after.teachingDesignPrinciples);
  expect(
    screen.queryByRole("region", {
      name: VARIANT_SECTION_TITLES.realisticConstraints,
    }),
  ).not.toBeInTheDocument();
});

it("shows the same-content message for identical profiles and analysis-tag-only changes", () => {
  const { before, after } = profiles();
  const rendered = render(<VersionCompare before={before} after={after} />);
  expect(screen.getByText("현재 확정본과 내용이 같습니다")).toBeVisible();
  after.confirmedTags.aiBoundaries = [];
  rendered.rerender(<VersionCompare before={before} after={after} />);
  expect(screen.getByText("현재 확정본과 내용이 같습니다")).toBeVisible();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

it("shows both privacy states instead of the same-content message when only privacy differs", () => {
  const { before, after } = profiles();
  before.privacyReview = { status: "clear", items: [] };
  after.privacyReview = {
    status: "needs_review",
    items: [
      {
        text: "재검토 표현",
        reason: "확인이 필요함",
        suggestedRewrite: "일반적인 표현",
      },
    ],
  };
  render(<VersionCompare before={before} after={after} />);
  const comparison = columns("개인정보 상태");
  expect(within(comparison.before).getByText("검사 통과")).toBeVisible();
  expect(within(comparison.after).getByText("확인 필요")).toBeVisible();
  expect(
    screen.queryByText("현재 확정본과 내용이 같습니다"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "문서 제목" }),
  ).not.toBeInTheDocument();
});

it("distinguishes an unfinished privacy check from a warning with the same stored status", () => {
  const { before, after } = profiles();
  before.privacyReview = {
    status: "needs_review",
    items: [
      {
        text: "재검토 표현",
        reason: "확인이 필요함",
        suggestedRewrite: "일반적인 표현",
      },
    ],
  };
  after.privacyReview = structuredClone(UNVERIFIED_PRIVACY_REVIEW);
  render(<VersionCompare before={before} after={after} />);
  const comparison = columns("개인정보 상태");
  expect(within(comparison.before).getByText("확인 필요")).toBeVisible();
  expect(within(comparison.after).getByText("확인 안 됨")).toBeVisible();
  expect(
    screen.queryByText("현재 확정본과 내용이 같습니다"),
  ).not.toBeInTheDocument();
});
