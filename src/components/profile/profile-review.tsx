"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Download,
  LoaderCircle,
  PencilLine,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  EvidenceBadge,
  EvidenceLegend,
} from "@/components/profile/evidence-badge";
import { PrivacyReviewPanel } from "@/components/privacy/privacy-review-panel";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { downloadMarkdown } from "@/lib/export/download";
import { profileToMarkdown } from "@/lib/export/profile-to-markdown";
import {
  confirmedTagsFromCandidates,
  hasUnresolvedClaims,
  PROFILE_MODULE_TITLES,
  type ControlledTagCategory,
  type PrivacyReview,
  type ProfileClaim,
  type ProfileModule,
  type TeacherContextProfile,
} from "@/types/profile";

type EditableSynthesisListKey =
  | "teachingDesignPrinciples"
  | "classSupportConsiderations"
  | "realisticConstraints"
  | "aiCollaborationInstructions";

const SYNTHESIS_LIST_SECTIONS: ReadonlyArray<{
  key: EditableSynthesisListKey;
  title: string;
  emptyText: string;
}> = [
  {
    key: "teachingDesignPrinciples",
    title: "수업 설계 원칙",
    emptyText: "남긴 수업 설계 원칙이 없습니다.",
  },
  {
    key: "classSupportConsiderations",
    title: "학급 지원 고려사항",
    emptyText: "남긴 학급 지원 고려사항이 없습니다.",
  },
  {
    key: "realisticConstraints",
    title: "현실적인 제약",
    emptyText: "남긴 현실적인 제약이 없습니다.",
  },
  {
    key: "aiCollaborationInstructions",
    title: "AI 협업 지침",
    emptyText: "남긴 AI 협업 지침이 없습니다.",
  },
];

const TAG_CATEGORY_LABELS: Record<ControlledTagCategory, string> = {
  preferredTeachingMethods: "선호하는 수업 방식",
  participationPriorities: "참여에서 중요하게 보는 것",
  emotionalSupportPriorities: "정서 지원의 우선순위",
  assessmentPriorities: "평가와 피드백의 우선순위",
  environmentConstraints: "현실적인 환경 제약",
  aiBoundaries: "AI 활용 경계",
};

const TAG_LABELS: Record<string, string> = {
  direct_instruction: "명료한 직접 설명",
  inquiry: "탐구",
  discussion: "토의·토론",
  collaboration: "협력 학습",
  project_based: "프로젝트",
  making: "만들기",
  experiential: "체험",
  blended: "온·오프라인 혼합",
  questioning: "질문하기",
  choice: "선택권",
  judgment: "판단권",
  revision: "수정권",
  sharing: "공유",
  peer_feedback: "동료 피드백",
  reflection: "성찰",
  psychological_safety: "심리적 안전",
  low_risk_participation: "부담 낮은 참여",
  small_success_steps: "작은 성공 단계",
  growth_feedback: "성장 중심 피드백",
  multiple_expression_modes: "다양한 표현 방식",
  predictable_structure: "예측 가능한 구조",
  final_product: "최종 결과물",
  learning_process: "학습 과정",
  reasoning: "사고 과정",
  self_reflection: "자기 성찰",
  observation: "관찰",
  limited_time: "제한된 시간",
  device_gap: "기기 격차",
  unstable_network: "불안정한 인터넷",
  large_class: "큰 학급 규모",
  preparation_load: "준비 부담",
  mixed_achievement: "학습 수준 차이",
  attention_transition: "집중·전환 지원",
  no_personal_data: "개인정보 입력 금지",
  teacher_final_judgment: "교사의 최종 판단",
  student_thinking_first: "학생의 사고 우선",
  fact_check_required: "사실 확인 필수",
  copyright_review: "저작권 확인",
  disclose_ai_use: "AI 사용 알림",
};

const PENDING_PRIVACY_REVIEW: PrivacyReview = {
  status: "needs_review",
  items: [
    {
      text: "최종 개인정보 검사를 완료하지 않은 초안",
      reason: "현재 내용은 최종 개인정보 검사를 다시 받아야 합니다.",
      suggestedRewrite: "검토를 마친 뒤 최종 개인정보 검사를 실행해 주세요.",
    },
  ],
};

function markPrivacyReviewPending(
  profile: TeacherContextProfile,
): TeacherContextProfile {
  return {
    ...profile,
    privacyReview: PENDING_PRIVACY_REVIEW,
  };
}

async function responseMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string;
      error?: { message?: string };
    };
    return body.error?.message ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}

function updateModule(
  profile: TeacherContextProfile,
  moduleId: ProfileModule["id"],
  updater: (module: ProfileModule) => ProfileModule,
): TeacherContextProfile {
  return {
    ...profile,
    modules: profile.modules.map((module) =>
      module.id === moduleId ? updater(module) : module,
    ),
  };
}

export function ProfileReview() {
  const router = useRouter();
  const {
    profile,
    setProfile,
    suggestedTags,
    setMarkdown,
    clearBrowserRecords,
  } = useInterviewSession();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [privacyReview, setPrivacyReview] = useState<PrivacyReview | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refineInstructions, setRefineInstructions] = useState<
    Record<string, string>
  >({});
  const [refiningModule, setRefiningModule] = useState<string | null>(null);
  const [synthesisConfirmed, setSynthesisConfirmed] = useState(false);
  const [privacyWarningAccepted, setPrivacyWarningAccepted] = useState(false);
  const draftRevisionRef = useRef(0);

  const unresolvedCount = useMemo(
    () =>
      profile?.modules.reduce(
        (total, module) =>
          total +
          module.claims.filter(
            (claim) =>
              claim.basis === "needs_confirmation" || !claim.confirmedByUser,
          ).length,
        0,
      ) ?? 0,
    [profile],
  );

  if (!profile) {
    return (
      <section className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-3xl font-bold">검토할 초안이 없습니다.</h1>
        <p className="mt-4 text-lg leading-8 text-[#536159]">
          답변과 초안은 서버나 브라우저 저장소에 보관하지 않습니다. 새로고침한
          경우 인터뷰를 다시 시작해 주세요.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 min-h-12 bg-[#153f2e] text-white"
        >
          <Link href="/interview">인터뷰 시작하기</Link>
        </Button>
      </section>
    );
  }

  const resetPrivacyReview = () => {
    setPrivacyReview(null);
    setPrivacyWarningAccepted(false);
    setMarkdown("");
  };

  const updateDraftProfile = (nextProfile: TeacherContextProfile) => {
    draftRevisionRef.current += 1;
    setProfile(markPrivacyReviewPending(nextProfile));
    resetPrivacyReview();
  };

  const updateSynthesis = (nextProfile: TeacherContextProfile) => {
    updateDraftProfile(nextProfile);
    setSynthesisConfirmed(false);
  };

  const updateModuleSynthesis = (
    moduleId: ProfileModule["id"],
    patch: Partial<Pick<ProfileModule, "title" | "summary">>,
  ) => {
    updateSynthesis(
      updateModule(profile, moduleId, (module) => ({ ...module, ...patch })),
    );
  };

  const updateSynthesisListItem = (
    key: EditableSynthesisListKey,
    index: number,
    value: string,
  ) => {
    updateSynthesis({
      ...profile,
      [key]: profile[key].map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    });
  };

  const removeSynthesisListItem = (
    key: EditableSynthesisListKey,
    index: number,
  ) => {
    updateSynthesis({
      ...profile,
      [key]: profile[key].filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const updateClaim = (
    moduleId: ProfileModule["id"],
    claimId: string,
    updater: (claim: ProfileClaim) => ProfileClaim,
  ) => {
    updateDraftProfile(
      updateModule(profile, moduleId, (module) => ({
        ...module,
        claims: module.claims.map((claim) =>
          claim.id === claimId ? updater(claim) : claim,
        ),
      })),
    );
  };

  const removeClaim = (moduleId: ProfileModule["id"], claimId: string) => {
    updateDraftProfile(
      updateModule(profile, moduleId, (module) => ({
        ...module,
        claims: module.claims.filter((claim) => claim.id !== claimId),
      })),
    );
  };

  const moveClaim = (
    moduleId: ProfileModule["id"],
    claimId: string,
    direction: -1 | 1,
  ) => {
    updateDraftProfile(
      updateModule(profile, moduleId, (module) => {
        const index = module.claims.findIndex((claim) => claim.id === claimId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= module.claims.length) {
          return module;
        }
        const claims = [...module.claims];
        const currentClaim = claims[index];
        const targetClaim = claims[nextIndex];
        if (!currentClaim || !targetClaim) return module;
        claims[index] = targetClaim;
        claims[nextIndex] = currentClaim;
        return { ...module, claims };
      }),
    );
  };

  const completeReview = async () => {
    if (busy || refiningModule) return;
    const revisionAtStart = draftRevisionRef.current;

    if (
      !profile.profileTitle.trim() ||
      profile.modules.some((module) => !module.title.trim())
    ) {
      setError(
        "문서 제목과 각 모듈 제목은 비워 둘 수 없습니다. 제목을 작성해 주세요.",
      );
      document
        .querySelector<HTMLElement>("[data-required-title='true']")
        ?.focus();
      return;
    }

    if (
      SYNTHESIS_LIST_SECTIONS.some(({ key }) =>
        profile[key].some((item) => !item.trim()),
      )
    ) {
      setError("빈 문장은 내용을 작성하거나 삭제해 주세요.");
      document
        .querySelector<HTMLElement>("[data-empty-synthesis='true']")
        ?.focus();
      return;
    }

    if (!synthesisConfirmed) {
      setError(
        "AI가 작성한 제목·요약·원칙·지침을 검토한 뒤 확인란을 선택해 주세요.",
      );
      document
        .querySelector<HTMLElement>("[data-synthesis-confirmation='true']")
        ?.focus();
      return;
    }

    if (hasUnresolvedClaims(profile)) {
      setError(
        "모든 문장을 확인해 주세요. 동의하지 않는 문장은 수정하거나 삭제할 수 있습니다.",
      );
      document.querySelector<HTMLElement>("[data-unresolved='true']")?.focus();
      return;
    }

    setBusy(true);
    setError("");
    setPrivacyWarningAccepted(false);
    setMarkdown("");
    try {
      const confirmedTags = confirmedTagsFromCandidates(
        suggestedTags.map((tag) => ({
          ...tag,
          confirmedByUser: selectedTags.has(`${tag.category}:${tag.tag}`),
        })),
      );
      const withTags: TeacherContextProfile = {
        ...markPrivacyReviewPending(profile),
        confirmedTags,
      };
      const response = await fetch("/api/privacy/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: withTags }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(
            response,
            "개인정보 검사를 완료하지 못했습니다. 다시 시도해 주세요.",
          ),
        );
      }
      const result = (await response.json()) as {
        source: "local" | "openai";
        review: PrivacyReview;
      };
      if (draftRevisionRef.current !== revisionAtStart) {
        setError(
          "개인정보 검사 중 문서가 수정되어 이전 검사 결과를 적용하지 않았습니다. 현재 내용을 확인한 뒤 다시 검사해 주세요.",
        );
        return;
      }
      const reviewedProfile: TeacherContextProfile = {
        ...withTags,
        privacyReview: result.review,
      };
      setProfile(reviewedProfile);
      setPrivacyReview(result.review);

      if (result.review.status === "clear") {
        setMarkdown(profileToMarkdown(reviewedProfile));
        router.push("/result");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "개인정보 검사를 완료하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  const refineModule = async (module: ProfileModule) => {
    const instruction = refineInstructions[module.id]?.trim();
    if (!instruction || busy || refiningModule) return;
    const revisionAtStart = draftRevisionRef.current;
    setRefiningModule(module.id);
    setError("");
    resetPrivacyReview();
    try {
      const response = await fetch("/api/profile/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: markPrivacyReviewPending(profile),
          instruction,
          moduleId: module.id,
          editableClaimIds: module.claims
            .filter((claim) => !claim.confirmedByUser)
            .map((claim) => claim.id),
        }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(
            response,
            "이 모듈을 다시 작성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          ),
        );
      }
      const result = (await response.json()) as {
        profile: TeacherContextProfile;
      };
      if (draftRevisionRef.current !== revisionAtStart) {
        setError(
          "AI가 작성하는 동안 문서가 수정되어 새 결과를 적용하지 않았습니다. 현재 수정 내용을 확인한 뒤 다시 시도해 주세요.",
        );
        return;
      }
      setProfile(markPrivacyReviewPending(result.profile));
      resetPrivacyReview();
      setSynthesisConfirmed(false);
      setRefineInstructions((current) => ({ ...current, [module.id]: "" }));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "다시 작성하지 못했습니다.",
      );
    } finally {
      setRefiningModule(null);
    }
  };

  const downloadDraft = () => {
    try {
      downloadMarkdown(
        profileToMarkdown(markPrivacyReviewPending(profile)),
        `tcontext-review-draft-${profile.metadata.schoolLevel}.md`,
      );
    } catch {
      setError(
        "빈 문장이 있어 초안을 만들 수 없습니다. 빈 문장을 작성하거나 삭제해 주세요.",
      );
    }
  };

  const continueWithPrivacyWarning = () => {
    if (
      !privacyWarningAccepted ||
      !synthesisConfirmed ||
      privacyReview?.status !== "needs_review" ||
      profile.privacyReview.status !== "needs_review"
    ) {
      return;
    }
    setMarkdown(profileToMarkdown(profile));
    router.push("/result");
  };

  return (
    <section aria-labelledby="review-title" className="space-y-12">
      <div className="max-w-4xl space-y-4">
        <p className="text-sm font-bold text-[#28684c]">AI 초안 검토</p>
        <h1
          id="review-title"
          className="text-3xl font-bold tracking-tight sm:text-5xl"
        >
          선생님의 말과 AI의 해석을 한 문장씩 확인해 주세요.
        </h1>
        <p className="text-lg leading-8 text-[#536159]">
          AI는 답변 전반을 연결해 수업 맥락과 실행 원칙을 풍부하게 제안합니다.
          이 문서는 평가 결과가 아니며, 맞지 않는 문장은 바로 고치거나 삭제할 수
          있습니다. AI 추론은 선생님이 승인하기 전까지 확정되지 않습니다.
        </p>
        <EvidenceLegend />
        <p
          className="font-semibold"
          aria-live="polite"
          data-testid="unresolved-count"
        >
          확인할 문장 {unresolvedCount}개
        </p>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-12 bg-white"
          onClick={downloadDraft}
        >
          <Download aria-hidden="true" />
          검토 중 초안 Markdown 다운로드
        </Button>
        <p className="text-sm leading-6 text-[#536159]">
          미확인 문장이 남아 있어도 내려받을 수 있으며, 문서 상단에 검토 필요
          경고가 포함됩니다.
        </p>
      </div>

      <section
        aria-labelledby="document-synthesis-title"
        className="space-y-5 border-t border-[#cfd8d0] pt-8"
      >
        <div className="max-w-3xl">
          <p className="text-sm font-bold text-[#28684c]">전체 문서</p>
          <h2
            id="document-synthesis-title"
            className="mt-1 text-2xl font-bold sm:text-3xl"
          >
            제목과 요약도 직접 고치거나 지울 수 있습니다.
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <EvidenceBadge basis="inferred" />
            <p className="leading-7 text-[#536159]">
              아래 내용은 AI가 답변 전체를 종합해 작성했습니다.
            </p>
          </div>
        </div>

        <div className="max-w-3xl rounded-xl border border-[#cfd8d0] bg-white p-4 sm:p-5">
          <Label htmlFor="profile-title" className="font-bold">
            문서 제목 직접 수정
          </Label>
          <Input
            id="profile-title"
            data-required-title={
              !profile.profileTitle.trim() ? "true" : undefined
            }
            value={profile.profileTitle}
            onChange={(event) =>
              updateSynthesis({
                ...profile,
                profileTitle: event.target.value,
              })
            }
            className="mt-2 min-h-12 border-[#aebbb0] bg-white text-base"
          />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="profile-summary" className="font-bold">
              전체 요약 직접 수정
            </Label>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!profile.shortSummary}
              onClick={() => updateSynthesis({ ...profile, shortSummary: "" })}
            >
              <Trash2 aria-hidden="true" />
              요약 삭제
            </Button>
          </div>
          <Textarea
            id="profile-summary"
            value={profile.shortSummary}
            rows={3}
            placeholder="요약을 삭제했습니다. 필요하면 직접 다시 작성할 수 있습니다."
            onChange={(event) =>
              updateSynthesis({
                ...profile,
                shortSummary: event.target.value,
              })
            }
            className="mt-2 min-h-28 resize-y border-[#aebbb0] p-3 text-base leading-7"
          />
        </div>
      </section>

      <div className="space-y-12">
        {profile.modules.map((module, moduleIndex) => (
          <section
            key={module.id}
            aria-labelledby={`module-${module.id}`}
            className="space-y-5 border-t border-[#cfd8d0] pt-8"
          >
            <div className="max-w-3xl space-y-4">
              <p className="text-sm font-bold text-[#28684c]">
                {moduleIndex + 1} / {profile.modules.length}
              </p>
              <h2
                id={`module-${module.id}`}
                className="mt-1 text-2xl font-bold sm:text-3xl"
              >
                {PROFILE_MODULE_TITLES[module.id]}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <EvidenceBadge basis="inferred" />
                <p className="leading-7 text-[#536159]">
                  제목과 요약은 AI가 종합한 문장입니다. 직접 수정하거나 요약을
                  삭제할 수 있습니다.
                </p>
              </div>

              <div className="rounded-xl border border-[#cfd8d0] bg-white p-4 sm:p-5">
                <Label
                  htmlFor={`module-title-${module.id}`}
                  className="font-bold"
                >
                  모듈 제목 직접 수정
                </Label>
                <Input
                  id={`module-title-${module.id}`}
                  data-required-title={
                    !module.title.trim() ? "true" : undefined
                  }
                  value={module.title}
                  onChange={(event) =>
                    updateModuleSynthesis(module.id, {
                      title: event.target.value,
                    })
                  }
                  className="mt-2 min-h-12 border-[#aebbb0] bg-white text-base"
                />

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <Label
                    htmlFor={`module-summary-${module.id}`}
                    className="font-bold"
                  >
                    모듈 요약 직접 수정
                  </Label>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={!module.summary}
                    onClick={() =>
                      updateModuleSynthesis(module.id, { summary: "" })
                    }
                  >
                    <Trash2 aria-hidden="true" />
                    요약 삭제
                  </Button>
                </div>
                <Textarea
                  id={`module-summary-${module.id}`}
                  value={module.summary}
                  rows={3}
                  placeholder="요약을 삭제했습니다. 필요하면 직접 다시 작성할 수 있습니다."
                  onChange={(event) =>
                    updateModuleSynthesis(module.id, {
                      summary: event.target.value,
                    })
                  }
                  className="mt-2 min-h-28 resize-y border-[#aebbb0] p-3 text-base leading-7"
                />
              </div>
            </div>

            {module.claims.length === 0 ? (
              <p className="border-l-4 border-[#cfd8d0] py-2 pl-4 text-[#536159]">
                이 모듈에 남긴 문장이 없습니다.
              </p>
            ) : (
              <ol className="space-y-5">
                {module.claims.map((claim, claimIndex) => {
                  const unresolved =
                    claim.basis === "needs_confirmation" ||
                    !claim.confirmedByUser;
                  return (
                    <li
                      key={claim.id}
                      tabIndex={unresolved ? -1 : undefined}
                      data-unresolved={unresolved ? "true" : undefined}
                      className="rounded-xl border border-[#cfd8d0] bg-white p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#536159]">
                            문장 {claimIndex + 1}
                          </span>
                          <EvidenceBadge basis={claim.basis} />
                          {claim.confirmedByUser ? (
                            <span className="inline-flex items-center gap-1 text-sm font-bold text-[#28684c]">
                              <Check aria-hidden="true" className="size-4" />
                              확인함
                            </span>
                          ) : null}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="문장을 위로 이동"
                            disabled={claimIndex === 0}
                            onClick={() => moveClaim(module.id, claim.id, -1)}
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="문장을 아래로 이동"
                            disabled={claimIndex === module.claims.length - 1}
                            onClick={() => moveClaim(module.id, claim.id, 1)}
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            aria-label="문장 삭제"
                            onClick={() => removeClaim(module.id, claim.id)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <Label
                          htmlFor={`claim-${claim.id}`}
                          className="inline-flex items-center gap-2"
                        >
                          <PencilLine aria-hidden="true" className="size-4" />
                          문장 직접 수정
                        </Label>
                        <Textarea
                          id={`claim-${claim.id}`}
                          value={claim.text}
                          rows={3}
                          onChange={(event) =>
                            updateClaim(module.id, claim.id, (current) => ({
                              ...current,
                              text: event.target.value,
                              confirmedByUser: false,
                            }))
                          }
                          className="min-h-28 resize-y border-[#aebbb0] p-3 text-base leading-7 focus-visible:ring-[#28684c]"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {unresolved ? (
                          <>
                            <Button
                              type="button"
                              size="lg"
                              disabled={!claim.text.trim()}
                              className="min-h-11 bg-[#153f2e] text-white"
                              onClick={() =>
                                updateClaim(module.id, claim.id, (current) => ({
                                  ...current,
                                  basis:
                                    current.basis === "needs_confirmation"
                                      ? "direct"
                                      : current.basis,
                                  confirmedByUser: true,
                                }))
                              }
                            >
                              <Check aria-hidden="true" />
                              {claim.basis === "inferred"
                                ? "이 추론 승인"
                                : "내용 확인"}
                            </Button>
                            {claim.basis === "inferred" ? (
                              <p className="self-center text-sm text-[#536159]">
                                승인해도 ‘AI 추론’ 표시는 유지됩니다.
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              updateClaim(module.id, claim.id, (current) => ({
                                ...current,
                                confirmedByUser: false,
                              }))
                            }
                          >
                            확인 취소
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="max-w-3xl border-l-4 border-[#8a6c33] bg-[#fff8e8] p-5">
              <Label
                htmlFor={`refine-${module.id}`}
                className="text-base font-bold"
              >
                이 모듈만 AI로 다시 작성
              </Label>
              <p className="mt-1 text-sm leading-6 text-[#66542e]">
                확인하지 않은 문장과 모듈 요약만 AI가 다시 작성합니다. 이미
                확인한 문장은 그대로 유지되며, 새 결과는 반드시 다시 검토해
                주세요.
              </p>
              <Textarea
                id={`refine-${module.id}`}
                disabled={busy || refiningModule !== null}
                value={refineInstructions[module.id] ?? ""}
                onChange={(event) =>
                  setRefineInstructions((current) => ({
                    ...current,
                    [module.id]: event.target.value,
                  }))
                }
                rows={3}
                maxLength={2000}
                placeholder="예: 추상적인 표현을 줄이고 실제 수업에서 활용할 수 있는 문장으로 다듬어 주세요."
                className="mt-3 min-h-24 bg-white"
              />
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-11 bg-white"
                disabled={
                  busy ||
                  refiningModule !== null ||
                  !(refineInstructions[module.id] ?? "").trim()
                }
                onClick={() => void refineModule(module)}
              >
                {refiningModule === module.id ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <PencilLine aria-hidden="true" />
                )}
                {refiningModule === module.id
                  ? "이 모듈 다시 작성 중"
                  : "이 모듈만 다시 작성"}
              </Button>
            </div>
          </section>
        ))}
      </div>

      <section
        aria-labelledby="synthesis-lists-title"
        className="space-y-8 border-t border-[#cfd8d0] pt-10"
      >
        <div className="max-w-3xl">
          <p className="text-sm font-bold text-[#28684c]">
            AI가 종합한 추가 문장
          </p>
          <h2 id="synthesis-lists-title" className="mt-1 text-3xl font-bold">
            원칙과 지침도 한 문장씩 검토해 주세요.
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <EvidenceBadge basis="inferred" />
            <p className="leading-7 text-[#536159]">
              맞지 않는 문장은 직접 고치거나 삭제할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {SYNTHESIS_LIST_SECTIONS.map(({ key, title, emptyText }) => {
            const items = profile[key];
            return (
              <section key={key} aria-labelledby={`synthesis-${key}`}>
                <h3 id={`synthesis-${key}`} className="text-xl font-bold">
                  {title}
                </h3>
                {items.length === 0 ? (
                  <p className="mt-3 border-l-4 border-[#cfd8d0] py-2 pl-4 text-[#536159]">
                    {emptyText}
                  </p>
                ) : (
                  <ol className="mt-3 space-y-3">
                    {items.map((item, index) => (
                      <li
                        key={`${key}-${index}`}
                        className="rounded-xl border border-[#cfd8d0] bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Label
                            htmlFor={`${key}-${index}`}
                            className="font-bold"
                          >
                            문장 {index + 1} 직접 수정
                          </Label>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            aria-label={`${title} 문장 ${index + 1} 삭제`}
                            onClick={() => removeSynthesisListItem(key, index)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                        <Textarea
                          id={`${key}-${index}`}
                          data-empty-synthesis={
                            !item.trim() ? "true" : undefined
                          }
                          value={item}
                          rows={3}
                          onChange={(event) =>
                            updateSynthesisListItem(
                              key,
                              index,
                              event.target.value,
                            )
                          }
                          className="mt-3 min-h-28 resize-y border-[#aebbb0] p-3 text-base leading-7"
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>

        <div
          data-synthesis-confirmation="true"
          tabIndex={-1}
          className="flex max-w-4xl items-start gap-3 border-l-4 border-[#28684c] bg-[#edf5ef] p-5"
        >
          <Checkbox
            id="synthesis-confirmed"
            checked={synthesisConfirmed}
            onCheckedChange={(value) => {
              draftRevisionRef.current += 1;
              resetPrivacyReview();
              setSynthesisConfirmed(value === true);
            }}
            className="mt-1 size-5"
          />
          <Label
            htmlFor="synthesis-confirmed"
            className="cursor-pointer text-base leading-7"
          >
            문서 제목, 전체·모듈 요약, 수업 원칙, 학급 지원, 현실적 제약, AI
            협업 지침을 모두 검토했으며 현재 내용으로 사용할 것을 확인합니다.
          </Label>
        </div>
      </section>

      <section
        aria-labelledby="tags-title"
        className="space-y-6 border-t border-[#cfd8d0] pt-10"
      >
        <div className="max-w-3xl">
          <p className="text-sm font-bold text-[#28684c]">선택 사항</p>
          <h2 id="tags-title" className="mt-1 text-3xl font-bold">
            AI가 제안한 태그를 직접 선택해 주세요.
          </h2>
          <p className="mt-3 leading-7 text-[#536159]">
            제안은 모두 선택되지 않은 상태입니다. 선생님이 고른 태그만 최종
            문서에 들어갑니다.
          </p>
        </div>
        {suggestedTags.length === 0 ? (
          <p className="text-[#536159]">제안된 태그가 없습니다.</p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {(Object.keys(TAG_CATEGORY_LABELS) as ControlledTagCategory[]).map(
              (category) => {
                const tags = suggestedTags.filter(
                  (tag) => tag.category === category,
                );
                if (tags.length === 0) return null;
                return (
                  <fieldset key={category} className="space-y-3">
                    <legend className="font-bold">
                      {TAG_CATEGORY_LABELS[category]}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const key = `${tag.category}:${tag.tag}`;
                        const checked = selectedTags.has(key);
                        return (
                          <Label
                            key={key}
                            className="min-h-11 cursor-pointer rounded-full border border-[#cfd8d0] bg-white px-4 py-2.5 has-[:checked]:border-[#28684c] has-[:checked]:bg-[#edf5ef] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#28684c]"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                draftRevisionRef.current += 1;
                                resetPrivacyReview();
                                setSelectedTags((current) => {
                                  const next = new Set(current);
                                  if (value === true) next.add(key);
                                  else next.delete(key);
                                  return next;
                                });
                              }}
                              className="mr-2"
                            />
                            {TAG_LABELS[tag.tag] ?? tag.tag}
                          </Label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              },
            )}
          </div>
        )}
      </section>

      <PrivacyReviewPanel review={privacyReview} />

      {privacyReview?.status === "needs_review" ? (
        <section
          aria-labelledby="privacy-warning-override-title"
          className="space-y-4 border-l-4 border-[#b66a2c] bg-[#fff8ec] p-5"
        >
          <div>
            <h2 id="privacy-warning-override-title" className="font-bold">
              꼭 필요한 내용이라면 경고를 확인하고 계속할 수 있습니다.
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#653f20]">
              이 선택은 검사 결과를 통과로 바꾸지 않습니다. 결과와 Markdown에는
              경고가 표시되며, 서버로 보내는 선택적 데이터 기여는
              비활성화됩니다.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="privacy-warning-accepted"
              checked={privacyWarningAccepted}
              onCheckedChange={(value) =>
                setPrivacyWarningAccepted(value === true)
              }
              className="mt-1 size-5"
            />
            <Label
              htmlFor="privacy-warning-accepted"
              className="cursor-pointer text-base leading-7"
            >
              식별 가능한 정보가 남아 있을 수 있음을 이해했습니다. 공유하거나
              다른 AI에 입력하기 전에 내용을 직접 다시 확인하겠습니다.
            </Label>
          </div>
          <Button
            type="button"
            size="lg"
            disabled={!privacyWarningAccepted || !synthesisConfirmed}
            onClick={continueWithPrivacyWarning}
            className="min-h-12 bg-[#653f20] text-white hover:bg-[#7a4b25]"
          >
            경고 확인하고 결과 보기
            <ArrowRight aria-hidden="true" />
          </Button>
        </section>
      ) : null}

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>검토를 마칠 수 없습니다</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-[#cfd8d0] bg-[#fbfaf5]/95 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" size="lg" className="min-h-12">
          <Link href="/interview">
            <ArrowLeft aria-hidden="true" />
            인터뷰로 돌아가기
          </Link>
        </Button>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {unresolvedCount > 0 ? (
            <span className="text-sm font-semibold text-[#8d352f]">
              문장 {unresolvedCount}개를 확인해 주세요.
            </span>
          ) : null}
          <Button
            type="button"
            size="lg"
            disabled={busy || refiningModule !== null}
            onClick={() => void completeReview()}
            className="min-h-12 bg-[#153f2e] px-6 text-base text-white hover:bg-[#235b43]"
          >
            {busy ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" />
                개인정보 최종 검사 중
              </>
            ) : (
              <>
                <ShieldCheck aria-hidden="true" />
                검토 마치고 개인정보 검사
                <ArrowRight aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </div>

      <button
        type="button"
        className="text-sm text-[#536159] underline underline-offset-4"
        onClick={() => {
          draftRevisionRef.current += 1;
          clearBrowserRecords();
          setPrivacyReview(null);
          setPrivacyWarningAccepted(false);
          setError("");
          router.push("/interview");
        }}
      >
        인터뷰와 초안을 모두 지우고 다시 시작
      </button>
    </section>
  );
}
