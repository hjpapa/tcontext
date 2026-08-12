"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { PrivacyNotice } from "@/components/consent/privacy-notice";
import { useInterviewSession } from "@/components/layout/interview-session-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  addFollowUpQuestion,
  createInterviewState,
  goToPreviousQuestion,
  setInterviewAnswer,
} from "@/lib/interview/state";
import { detectPrivacyRisks } from "@/lib/privacy/detector";
import { MAX_INTERVIEW_ANSWER_LENGTH } from "@/types/interview";
import type {
  AnswerDisposition,
  FollowUpQuestion,
  InterviewQuestion,
  InterviewState,
  TeacherRole,
} from "@/types/interview";
import type { PrivacyScanResult } from "@/types/privacy";
import type { ProfileModuleId, SchoolLevel } from "@/types/profile";

type SetupStep = "privacy" | "setup" | "questions";

const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  kindergarten: "유치원",
  elementary: "초등학교",
  middle: "중학교",
  high: "고등학교",
};

const ROLE_LABELS: Record<TeacherRole, string> = {
  homeroom_teacher: "담임교사",
  subject_teacher: "교과전담·교과교사",
  special_education_teacher: "특수교사",
  counselor: "상담교사",
  school_nurse: "보건교사",
  librarian: "사서교사",
  administrator: "관리자·교육 리더",
  other: "기타",
};

const MODULE_LABELS: Record<ProfileModuleId, string> = {
  identity_and_role: "현재 역할",
  educational_philosophy: "교육관",
  preferred_teaching: "선호하는 수업 방식",
  class_context: "수업 맥락",
  participation_and_emotion: "참여와 정서 지원",
  materials_assessment_feedback: "자료·평가·피드백",
  environment_and_ai: "환경·제약과 AI 활용",
};

function questionText(question: InterviewQuestion): string {
  return question.prompt;
}

function exchangeFrom(
  state: InterviewState,
  question: InterviewQuestion,
  answer: string,
) {
  return {
    questionId: question.id,
    moduleId: question.moduleId,
    question: questionText(question),
    answer,
  };
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string;
      error?: { message?: string };
    };
    return body.message ?? body.error?.message ?? "요청을 처리하지 못했습니다.";
  } catch {
    return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

export function InterviewFlow() {
  const router = useRouter();
  const {
    interview,
    setInterview,
    setProfile,
    setSuggestedTags,
    deviceProgressEnabled,
    progressHydrated,
    restoredProgress,
    setDeviceProgressEnabled,
    clearBrowserRecords,
  } = useInterviewSession();
  const [step, setStep] = useState<SetupStep>(
    interview ? "questions" : "privacy",
  );
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>("elementary");
  const [role, setRole] = useState<TeacherRole>("homeroom_teacher");
  const [answer, setAnswer] = useState(() => {
    if (!interview) return "";
    const question = interview.questions[interview.currentQuestionIndex];
    return question ? (interview.answers[question.id]?.text ?? "") : "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [privacyRisks, setPrivacyRisks] = useState<PrivacyScanResult | null>(
    null,
  );

  const currentQuestion = interview?.questions[interview.currentQuestionIndex];
  const answeredCount = interview
    ? Object.values(interview.answers).filter(
        (stored) => stored.disposition === "answered",
      ).length
    : 0;

  if (!progressHydrated) {
    return (
      <div
        role="status"
        className="text-muted-foreground flex min-h-48 items-center justify-center gap-3"
      >
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        저장된 진행 위치 확인 중
      </div>
    );
  }

  const startInterview = () => {
    const next = createInterviewState({
      schoolLevel,
      role,
      privacyNoticeAccepted: privacyAccepted,
    });
    clearBrowserRecords();
    setInterview(next);
    setAnswer("");
    setError("");
    setPrivacyRisks(null);
    setStep("questions");
  };

  const previousExchanges = (state: InterviewState) =>
    state.questions.flatMap((question) => {
      const stored = state.answers[question.id];
      return stored?.disposition === "answered"
        ? [exchangeFrom(state, question, stored.text)]
        : [];
    });

  const maybeAddFollowUp = async (
    state: InterviewState,
    question: InterviewQuestion,
    answerText: string,
  ): Promise<InterviewState> => {
    if (
      state.followUpCount >= 4 ||
      question.source === "follow_up" ||
      state.followUps.some(
        (followUp) => followUp.basedOnQuestionId === question.id,
      )
    ) {
      return state;
    }

    let response: Response;
    try {
      response = await fetch("/api/interview/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolLevel: state.schoolLevel,
          role: state.role,
          current: exchangeFrom(state, question, answerText),
          previousAnswers: previousExchanges(state).filter(
            (item) => item.questionId !== question.id,
          ),
          followUpCount: state.followUpCount,
        }),
      });
    } catch {
      return state;
    }

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) return state;
      throw new Error(await responseMessage(response));
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return state;
    }
    const decision = body as {
      needed?: unknown;
      question?: null | {
        prompt?: unknown;
        intent?: unknown;
        example?: unknown;
        privacyHint?: unknown;
      };
    };
    if (decision.needed !== true || !decision.question) return state;

    const { prompt, intent, example, privacyHint } = decision.question;
    if (
      typeof prompt !== "string" ||
      typeof intent !== "string" ||
      typeof example !== "string" ||
      typeof privacyHint !== "string"
    ) {
      return state;
    }

    const followUp: FollowUpQuestion = {
      id: `follow-up-${state.followUpCount + 1}-${question.id}`,
      moduleId: question.moduleId,
      source: "follow_up",
      basedOnQuestionId: question.id,
      prompt,
      intent,
      example,
      privacyHint,
      required: false,
    };
    return addFollowUpQuestion(state, followUp);
  };

  const generateProfile = async (state: InterviewState) => {
    const exchanges = previousExchanges(state);
    if (exchanges.length === 0) {
      throw new Error(
        "초안을 만들려면 적어도 한 질문에는 직접 답해 주세요. 이전 질문으로 돌아가 답변을 추가할 수 있습니다.",
      );
    }
    const response = await fetch("/api/profile/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolLevel: state.schoolLevel,
        role: state.role,
        answers: exchanges,
      }),
    });
    if (!response.ok) throw new Error(await responseMessage(response));
    const result = (await response.json()) as {
      profile: Parameters<typeof setProfile>[0];
      suggestedTags: Parameters<typeof setSuggestedTags>[0];
    };
    setProfile(result.profile);
    setSuggestedTags(result.suggestedTags);
    router.push("/review");
  };

  const commitAndContinue = async (disposition: AnswerDisposition) => {
    if (!interview || !currentQuestion || busy) return;
    setError("");
    setPrivacyRisks(null);
    if (disposition === "answered" && !answer.trim()) {
      setError(
        "답변을 적거나 ‘잘 모르겠어요’ 또는 ‘건너뛰기’를 선택해 주세요.",
      );
      return;
    }
    if (disposition === "answered") {
      const scan = detectPrivacyRisks(answer.trim());
      if (scan.status === "blocked") {
        setPrivacyRisks(scan);
        return;
      }
    }

    setBusy(true);
    try {
      let next = setInterviewAnswer(
        interview,
        currentQuestion.id,
        answer,
        disposition,
      );
      if (disposition === "answered") {
        next = await maybeAddFollowUp(next, currentQuestion, answer.trim());
      }

      if (next.currentQuestionIndex < next.questions.length - 1) {
        next = { ...next, currentQuestionIndex: next.currentQuestionIndex + 1 };
        setInterview(next);
        const nextQuestion = next.questions[next.currentQuestionIndex];
        if (!nextQuestion) {
          throw new Error(
            "다음 질문을 찾지 못했습니다. 인터뷰를 다시 시작해 주세요.",
          );
        }
        const nextStored = next.answers[nextQuestion.id];
        setAnswer(nextStored?.text ?? "");
      } else {
        setInterview(next);
        await generateProfile(next);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "잠시 문제가 생겼습니다. 답변은 이 탭에 그대로 있습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (step === "privacy") {
    return (
      <PrivacyNotice
        accepted={privacyAccepted}
        onAcceptedChange={setPrivacyAccepted}
        onContinue={() => setStep("setup")}
      />
    );
  }

  if (step === "setup") {
    return (
      <section aria-labelledby="setup-title" className="space-y-10">
        <div className="space-y-3">
          <p className="eyebrow">인터뷰 설정</p>
          <h1
            id="setup-title"
            className="text-3xl font-bold tracking-tight sm:text-5xl"
          >
            지금의 학교급과 역할을 알려주세요.
          </h1>
          <p className="text-muted-foreground text-lg leading-8">
            기본 질문은 11개입니다. 답을 더 이해할 필요가 있을 때만 짧은 AI 후속
            질문이 최대 4개 추가되며, 결과에는 고정 유형이나 점수를 붙이지
            않습니다.
          </p>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-xl font-bold">학교급</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(SCHOOL_LEVEL_LABELS) as SchoolLevel[]).map(
              (value) => (
                <label
                  key={value}
                  className="bg-card has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:ring-primary flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 has-[:focus-visible]:ring-2"
                >
                  <input
                    type="radio"
                    name="school-level"
                    value={value}
                    checked={schoolLevel === value}
                    onChange={() => setSchoolLevel(value)}
                    className="accent-primary size-5"
                  />
                  <span className="font-semibold">
                    {SCHOOL_LEVEL_LABELS[value]}
                  </span>
                </label>
              ),
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-xl font-bold">현재 역할</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(ROLE_LABELS) as TeacherRole[]).map((value) => (
              <label
                key={value}
                className="bg-card has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:ring-primary flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 has-[:focus-visible]:ring-2"
              >
                <input
                  type="radio"
                  name="teacher-role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="accent-primary size-5"
                />
                <span className="font-semibold">{ROLE_LABELS[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-12"
            onClick={() => setStep("privacy")}
          >
            <ArrowLeft aria-hidden="true" />
            이전
          </Button>
          <Button
            type="button"
            size="lg"
            className="min-h-12 px-6 text-base"
            onClick={startInterview}
          >
            인터뷰 시작하기
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </section>
    );
  }

  if (!interview || !currentQuestion) return null;

  const progress = Math.round(
    ((interview.currentQuestionIndex + 1) / interview.questions.length) * 100,
  );

  return (
    <section aria-labelledby="question-title" className="mx-auto max-w-3xl">
      <div className="mb-10 space-y-3">
        {restoredProgress ? (
          <Alert className="mb-6 border-[#9a7a42] bg-[#fff9eb]">
            <AlertTitle>진행 위치만 복원했어요</AlertTitle>
            <AlertDescription className="space-y-1 leading-6">
              <p>
                {restoredProgress.source === "session"
                  ? "이 탭에 임시 저장된"
                  : "이 기기에 저장된"}{" "}
                질문 {restoredProgress.restoredQuestionNumber} 위치와
                학교급·역할 설정을 복원했습니다.
              </p>
              <p>
                답변 원문은 저장하지 않으므로
                {restoredProgress.previousCompletedQuestionCount > 0
                  ? ` 이전에 처리한 ${restoredProgress.previousCompletedQuestionCount}개 질문의 내용은 복원되지 않았고, 완료된 답변으로 계산하지 않습니다.`
                  : " 작성 중이던 내용은 복원되지 않았습니다."}{" "}
                필요한 경우 이전 질문으로 돌아가 다시 입력해 주세요.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex items-center justify-between gap-4 text-sm font-semibold">
          <span>
            질문 {interview.currentQuestionIndex + 1} /{" "}
            {interview.questions.length}
          </span>
          <span className="text-muted-foreground">
            답변 {answeredCount}개 · AI 후속 {interview.followUpCount}/4
          </span>
        </div>
        <Progress
          value={progress}
          aria-label={`인터뷰 ${progress}% 진행`}
          className="bg-muted [&>div]:bg-primary h-2"
        />
        <div>
          <label className="text-muted-foreground flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={deviceProgressEnabled}
              onChange={(event) =>
                setDeviceProgressEnabled(event.target.checked)
              }
              className="accent-primary size-5"
            />
            브라우저를 닫아도 이 기기에서 진행 위치 이어가기
          </label>
          <p className="text-muted-foreground ml-8 text-sm leading-6">
            같은 탭에서는 기본으로 위치를 복원합니다. 이 선택을 켜면 새 탭이나
            재방문 때도 이어갈 수 있으며, 원문 답변과 생성 문서는 저장하지
            않습니다.
          </p>
        </div>
      </div>

      <div className="space-y-7">
        <div className="space-y-3">
          <p className="text-primary text-sm font-bold">
            {currentQuestion.source === "follow_up" ? (
              <span className="inline-flex items-center gap-2">
                <Sparkles aria-hidden="true" className="size-4" />
                답변을 더 잘 이해하기 위한 후속 질문
              </span>
            ) : (
              MODULE_LABELS[currentQuestion.moduleId]
            )}
          </p>
          <h1
            id="question-title"
            className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl"
          >
            {questionText(currentQuestion)}
          </h1>
          <p className="text-muted-foreground text-base leading-7">
            정답은 없습니다. 떠오르는 장면부터 편하게 적어 주세요. 구체적인
            경험을 2~5문장으로 적으면 충분합니다.
          </p>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <div className="bg-secondary/65 rounded-xl border p-4">
              <h2 className="text-sm font-bold">질문의 의도</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {currentQuestion.intent}
              </p>
            </div>
            <details
              key={currentQuestion.id}
              className="group bg-accent/25 rounded-xl border p-4"
            >
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold underline decoration-current/40 underline-offset-4">
                답하기 어렵다면 예시 보기
              </summary>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                정답이 아닌 짧은 참고 예시입니다. {currentQuestion.example}
              </p>
            </details>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="interview-answer" className="text-base font-bold">
            답변
          </Label>
          <Textarea
            id="interview-answer"
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              setError("");
              setPrivacyRisks(null);
            }}
            disabled={busy}
            rows={8}
            maxLength={MAX_INTERVIEW_ANSWER_LENGTH}
            aria-describedby="answer-length-help answer-privacy-help question-privacy-guidance"
            className="bg-card border-input min-h-48 resize-y p-4 text-lg leading-8"
            placeholder="예: 먼저 짧은 질문으로 생각을 꺼내고, 개인 메모 뒤 모둠에서 나누도록 합니다…"
          />
          <div className="text-muted-foreground flex flex-col justify-between gap-2 text-sm sm:flex-row">
            <div className="space-y-1">
              <p id="answer-privacy-help">
                이름·학교명·반·연락처·성적·진단명은 적지 마세요.
              </p>
              <details className="text-[#653f20]">
                <summary className="min-h-8 cursor-pointer py-1 font-semibold underline underline-offset-4">
                  개인정보 없이 답하는 방법
                </summary>
                <p id="question-privacy-guidance" className="pb-1 leading-6">
                  {currentQuestion.privacyHint}
                </p>
              </details>
            </div>
            <span id="answer-length-help">
              권장 200~800자 · {answer.length} /{" "}
              {MAX_INTERVIEW_ANSWER_LENGTH.toLocaleString("ko-KR")}자
            </span>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>다시 확인해 주세요</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {privacyRisks?.matches.length ? (
          <div
            role="alert"
            className="border-l-4 border-[#a6443d] bg-[#fff0ee] p-5"
          >
            <h2 className="font-bold">전송 전에 이 표현을 바꿔 주세요.</h2>
            <ul className="mt-3 space-y-3">
              {privacyRisks.matches.map((match, index) => (
                <li
                  key={`${match.type}-${match.start}-${index}`}
                  className="rounded-lg bg-white/70 p-4"
                >
                  <p className="text-sm font-semibold">
                    감지된 부분:{" "}
                    <mark className="rounded bg-[#ffd8cf] px-1">
                      {match.matchedText}
                    </mark>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#653c38]">
                    {match.reason}
                  </p>
                  <p className="mt-2 text-sm leading-6">
                    <strong>지원 중심 대체 표현:</strong>{" "}
                    {match.suggestedRewrite}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-3 border-t pt-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy || interview.currentQuestionIndex === 0}
            className="min-h-12 justify-center"
            onClick={() => {
              setError("");
              setPrivacyRisks(null);
              const previous = goToPreviousQuestion(interview);
              const previousQuestion =
                previous.questions[previous.currentQuestionIndex];
              if (!previousQuestion) {
                setError(
                  "이전 질문을 찾지 못했습니다. 인터뷰를 다시 시작해 주세요.",
                );
                return;
              }
              setInterview(previous);
              setAnswer(previous.answers[previousQuestion.id]?.text ?? "");
            }}
          >
            <ArrowLeft aria-hidden="true" />
            이전 질문
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={busy}
              className="min-h-12"
              onClick={() => void commitAndContinue("unsure")}
            >
              잘 모르겠어요
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              className="min-h-12"
              onClick={() => void commitAndContinue("skipped")}
            >
              건너뛰기
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={busy}
              className="col-span-2 min-h-12 w-full px-6 text-base sm:w-auto"
              onClick={() => void commitAndContinue("answered")}
            >
              {busy ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  {interview.currentQuestionIndex ===
                  interview.questions.length - 1
                    ? "초안 만드는 중"
                    : "답변 확인 중"}
                </>
              ) : interview.currentQuestionIndex ===
                interview.questions.length - 1 ? (
                <>
                  <Check aria-hidden="true" />
                  초안 만들기
                </>
              ) : (
                <>
                  다음 질문
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>

        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 rounded-md text-sm underline underline-offset-4"
          onClick={() => {
            if (
              !window.confirm(
                "이 탭의 인터뷰 답변과 진행 내용을 모두 지울까요? 이 작업은 되돌릴 수 없습니다.",
              )
            ) {
              return;
            }
            clearBrowserRecords();
            setStep("privacy");
            setPrivacyAccepted(false);
            setAnswer("");
            setError("");
            setPrivacyRisks(null);
          }}
        >
          <RotateCcw aria-hidden="true" className="size-4" />이 탭의 인터뷰를
          모두 지우고 다시 시작
        </button>
      </div>
    </section>
  );
}
