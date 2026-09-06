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
  it("builds a concise 14-question interview for every level and role", () => {
    for (const schoolLevel of SCHOOL_LEVELS) {
      for (const role of TEACHER_ROLES) {
        const questions = buildInterviewQuestions({ schoolLevel, role });
        expect(questions).toHaveLength(14);
        expect(
          questions.filter((item) => item.source === "common"),
        ).toHaveLength(12);
        expect(
          questions.filter((item) => item.source === "school_level"),
        ).toHaveLength(1);
        expect(questions.filter((item) => item.source === "role")).toHaveLength(
          1,
        );
        expect(new Set(questions.map((item) => item.id)).size).toBe(14);

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
      questions.some((item) => item.id === "elementary-group-sharing"),
    ).toBe(false);
    expect(questions.some((item) => item.id === "role-counselor")).toBe(true);
  });

  it("covers the approved common themes with one core judgment each", () => {
    const questions = buildInterviewQuestions({
      schoolLevel: "elementary",
      role: "homeroom_teacher",
    });
    const promptFor = (id: string) =>
      questions.find((item) => item.id === id)?.prompt ?? "";
    const intentFor = (id: string) =>
      questions.find((item) => item.id === id)?.intent ?? "";

    expect(promptFor("common-role-focus")).toContain("더 알아보고 싶은");
    expect(promptFor("common-personal-value")).toContain(
      "사람으로서 중요하게 여기는 가치",
    );
    expect(intentFor("common-personal-value")).toContain("유형화하지 않고");
    expect(promptFor("common-good-lesson")).toContain("행동 하나");
    expect(promptFor("common-educational-principle")).toContain(
      "지키려는 원칙",
    );
    expect(promptFor("common-lesson-flow")).toContain("가장 먼저 정하는");
    expect(promptFor("common-adaptive-tendency")).toContain("판단하는 신호");
    expect(promptFor("common-adaptive-tendency")).not.toContain("운전 습관");
    expect(intentFor("common-adaptive-tendency")).toContain("고정된 유형 대신");
    expect(intentFor("common-adaptive-tendency")).toContain("상황마다");
    expect(promptFor("common-class-support")).toContain("학급의 상황 하나");
    expect(promptFor("common-assessment-feedback")).toContain(
      "가장 먼저 무엇을 살펴보나요",
    );
    expect(promptFor("common-environment")).toContain("학교의 현실 조건");
    expect(promptFor("common-ai-boundaries")).toContain("확인하고 결정");
    expect(promptFor("common-personal-value")).toContain("어떤 선택");
    expect(promptFor("common-educational-principle")).toContain("부딪힐 때");
    expect(promptFor("common-ai-task")).toContain("작업 하나");
    expect(promptFor("common-ai-response")).toContain("어떤 방식");
    for (const id of ["common-ai-task", "common-ai-response"]) {
      expect(questions.find((question) => question.id === id)).toMatchObject({
        moduleId: "environment_and_ai",
        required: false,
      });
    }

    const metaphorQuestions = questions.filter((question) =>
      /나침반|리셋 버튼/u.test(question.prompt),
    );
    expect(metaphorQuestions).toHaveLength(2);

    for (const question of questions) {
      expect(question.prompt.match(/\?/gu)).toHaveLength(1);
      expect(question.example.match(/[.!?](?:\s|$)/gu)).toHaveLength(2);
      expect(question.example.length).toBeLessThanOrEqual(160);
    }
  });

  it("adapts every common question to kindergarten language", () => {
    const questions = buildInterviewQuestions({
      schoolLevel: "kindergarten",
      role: "homeroom_teacher",
    });
    const commonQuestions = questions.filter(
      (question) => question.source === "common",
    );

    expect(commonQuestions).toHaveLength(12);
    expect(commonQuestions.map((question) => question.id)).toContain(
      "common-personal-value",
    );

    for (const question of commonQuestions) {
      expect(question.prompt).not.toMatch(/학생|과제|교과/u);
      expect(question.prompt).toMatch(/유아|놀이|일과|유치원/u);
    }
  });

  it("keeps every authored question normalized and free of broken text or hanja", () => {
    const questions = SCHOOL_LEVELS.flatMap((schoolLevel) =>
      TEACHER_ROLES.flatMap((role) =>
        buildInterviewQuestions({ schoolLevel, role }),
      ),
    );
    const fixedTextFields = [
      "prompt",
      "intent",
      "example",
      "privacyHint",
    ] as const;
    const unsafeText =
      /[\uFFFD\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]|\u00C3|\u00C2|\u00E2\u20AC|\u00EF\u00BF\u00BD/u;

    for (const question of questions) {
      for (const field of fixedTextFields) {
        const value = question[field];
        expect(value, `${question.id}.${field} must use NFC`).toBe(
          value.normalize("NFC"),
        );
        expect(
          value,
          `${question.id}.${field} contains unsafe text`,
        ).not.toMatch(unsafeText);
      }
    }
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
      total: 14,
    });
  });

  it("keeps an optional controlled teaching subject in runtime state", () => {
    const state = createInterviewState({
      schoolLevel: "high",
      role: "subject_teacher",
      teachingSubject: "mathematics",
      privacyNoticeAccepted: true,
      now: "2026-07-30T00:00:00.000Z",
    });

    expect(state.teachingSubject).toBe("mathematics");
    expect(state.questions).toHaveLength(14);
  });
});
