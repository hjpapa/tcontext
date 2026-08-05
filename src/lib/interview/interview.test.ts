import { describe, expect, it } from "vitest";

import { buildInterviewQuestions } from "./router";
import {
  addFollowUpQuestion,
  createInterviewState,
  setInterviewAnswer,
} from "./state";
import { calculateInterviewProgress } from "./progress";
import {
  MAX_FOLLOW_UPS,
  TEACHER_ROLES,
  type FollowUpQuestion,
} from "@/types/interview";
import { PROFILE_MODULE_IDS, SCHOOL_LEVELS } from "@/types/profile";

describe("question routing", () => {
  it("builds a concise 10-question interview for every level and role", () => {
    for (const schoolLevel of SCHOOL_LEVELS) {
      for (const role of TEACHER_ROLES) {
        const questions = buildInterviewQuestions({ schoolLevel, role });
        expect(questions).toHaveLength(10);
        expect(
          questions.filter((item) => item.source === "common"),
        ).toHaveLength(7);
        expect(
          questions.filter((item) => item.source === "school_level"),
        ).toHaveLength(2);
        expect(questions.filter((item) => item.source === "role")).toHaveLength(
          1,
        );
        expect(new Set(questions.map((item) => item.id)).size).toBe(10);

        for (const moduleId of PROFILE_MODULE_IDS) {
          expect(
            questions.some((question) => question.moduleId === moduleId),
            `${schoolLevel}/${role} is missing ${moduleId}`,
          ).toBe(true);
        }
      }
    }
  });

  it("selects the requested school-level and role branches only", () => {
    const questions = buildInterviewQuestions({
      schoolLevel: "middle",
      role: "counselor",
    });
    expect(
      questions.some((item) => item.id === "middle-autonomy-participation"),
    ).toBe(true);
    expect(
      questions.some((item) => item.id === "elementary-class-culture"),
    ).toBe(false);
    expect(questions.some((item) => item.id === "role-counselor")).toBe(true);
  });

  it("asks varied, observable, and support-centered questions", () => {
    const questions = buildInterviewQuestions({
      schoolLevel: "elementary",
      role: "homeroom_teacher",
    });
    const promptFor = (id: string) =>
      questions.find((item) => item.id === id)?.prompt ?? "";

    expect(promptFor("common-role-focus")).toContain("교실 검색창");
    expect(promptFor("common-good-lesson")).toContain("어떤 행동");
    expect(promptFor("common-class-support")).toContain("집단 전체");
    expect(promptFor("common-environment")).toContain("우회로");
    expect(promptFor("common-ai-boundaries")).toContain("직접 판단");
  });
});

describe("interview runtime state", () => {
  const makeFollowUp = (
    index: number,
    basedOnQuestionId: string,
  ): FollowUpQuestion => ({
    id: `follow-up-${index}`,
    moduleId: "educational_philosophy",
    source: "follow_up",
    basedOnQuestionId,
    prompt: `실제 수업에서 그 원칙을 적용한 장면 ${index}을 알려 주세요.`,
    intent: "이미 언급한 원칙을 실제 경험으로 구체화합니다.",
    example: "학생이 설명을 고친 장면처럼 개인을 특정하지 않고 적습니다.",
    privacyHint: "이름, 학교명, 개별 성적이나 진단명은 적지 마세요.",
    required: false,
  });

  it("enforces the global maximum of four follow-up questions", () => {
    let state = createInterviewState({
      schoolLevel: "elementary",
      role: "homeroom_teacher",
      privacyNoticeAccepted: true,
      now: "2026-07-30T00:00:00.000Z",
    });
    const sourceId = state.questions[0]?.id;
    if (!sourceId) throw new Error("Expected an interview source question");

    for (let index = 1; index <= MAX_FOLLOW_UPS; index += 1) {
      state = addFollowUpQuestion(
        state,
        makeFollowUp(index, sourceId),
        "2026-07-30T00:01:00.000Z",
      );
    }
    expect(state.followUpCount).toBe(4);
    expect(() => addFollowUpQuestion(state, makeFollowUp(5, sourceId))).toThrow(
      /최대 4개/,
    );
  });

  it("updates answers immutably and calculates bounded progress", () => {
    const initial = createInterviewState({
      schoolLevel: "high",
      role: "subject_teacher",
      privacyNoticeAccepted: true,
      now: "2026-07-30T00:00:00.000Z",
    });
    const questionId = initial.questions[0]?.id;
    if (!questionId) throw new Error("Expected an interview question");
    const answered = setInterviewAnswer(
      initial,
      questionId,
      "핵심 개념 뒤 자료를 탐구합니다.",
      "answered",
      "2026-07-30T00:01:00.000Z",
    );

    expect(initial.answers).toEqual({});
    expect(answered.answers[questionId]?.text).toContain("자료");
    expect(calculateInterviewProgress(answered)).toMatchObject({
      current: 1,
      total: 10,
    });
  });
});
