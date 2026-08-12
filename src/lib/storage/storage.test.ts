import { describe, expect, it } from "vitest";

import { createInterviewState, setInterviewAnswer } from "@/lib/interview";
import {
  LOCAL_PROGRESS_KEY,
  LOCAL_RESUME_PREFERENCE_KEY,
  loadLocalProgress,
  saveLocalProgress,
  setLocalResumeEnabled,
} from "./local";
import {
  SESSION_PROGRESS_KEY,
  loadSessionProgress,
  saveSessionProgress,
} from "./session";
import { restoreInterviewProgress } from "./restore";
import { toStoredInterviewProgress } from "./schema";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const stateWithPrivateAnswer = () => {
  const initial = createInterviewState({
    schoolLevel: "elementary",
    role: "homeroom_teacher",
    privacyNoticeAccepted: true,
    now: "2026-07-30T00:00:00.000Z",
  });
  const questionId = initial.questions[0]?.id;
  if (!questionId) throw new Error("Expected an interview question");
  return setInterviewAnswer(
    initial,
    questionId,
    "절대로 저장되면 안 되는 원문 답변",
    "answered",
    "2026-07-30T00:01:00.000Z",
  );
};

describe("session progress", () => {
  it("is the default and never serializes raw interview answers", () => {
    const storage = new MemoryStorage();
    expect(saveSessionProgress(stateWithPrivateAnswer(), storage)).toBe(true);
    const serialized = storage.getItem(SESSION_PROGRESS_KEY) ?? "";
    expect(serialized).not.toContain("절대로 저장되면 안 되는 원문 답변");
    expect(serialized).not.toContain('"answers"');
    expect(loadSessionProgress(storage)?.completedQuestionCount).toBe(1);
  });

  it("removes malformed stored progress", () => {
    const storage = new MemoryStorage();
    storage.setItem(SESSION_PROGRESS_KEY, '{"answers":{"secret":"raw"}}');
    expect(loadSessionProgress(storage)).toBeNull();
    expect(storage.getItem(SESSION_PROGRESS_KEY)).toBeNull();
  });

  it("maps the saved question id to the current bank without restoring answers", () => {
    const original = {
      ...stateWithPrivateAnswer(),
      currentQuestionIndex: 3,
      updatedAt: "2026-07-30T00:02:00.000Z",
    };
    const restored = restoreInterviewProgress(
      toStoredInterviewProgress(original),
      "2026-07-31T00:00:00.000Z",
    );

    expect(restored?.interview.currentQuestionIndex).toBe(3);
    expect(restored?.interview.questions[3]?.id).toBe("common-lesson-flow");
    expect(restored?.interview.answers).toEqual({});
    expect(restored?.interview.followUps).toEqual([]);
    expect(restored?.interview.followUpCount).toBe(0);
    expect(restored?.previousCompletedQuestionCount).toBe(1);
  });

  it("restores a bookmark from the legacy ten-question bank by stable id", () => {
    const currentProgress = toStoredInterviewProgress(stateWithPrivateAnswer());
    const legacyProgress = {
      ...currentProgress,
      currentQuestionId: "common-class-support",
      currentQuestionIndex: 4,
      fixedQuestionIds: currentProgress.fixedQuestionIds.filter(
        (questionId) => questionId !== "common-adaptive-tendency",
      ),
    };

    const restored = restoreInterviewProgress(
      legacyProgress,
      "2026-07-31T00:00:00.000Z",
    );

    expect(legacyProgress.fixedQuestionIds).toHaveLength(10);
    expect(restored?.interview.currentQuestionIndex).toBe(5);
    expect(restored?.interview.questions[5]?.id).toBe("common-class-support");
    expect(restored?.interview.answers).toEqual({});
  });

  it("resets to the first current-bank question when an old id cannot be mapped", () => {
    const progress = {
      ...toStoredInterviewProgress(stateWithPrivateAnswer()),
      currentQuestionId: "removed-question-id",
      currentQuestionIndex: 8,
    };

    const restored = restoreInterviewProgress(progress);

    expect(restored?.interview.currentQuestionIndex).toBe(0);
    expect(restored?.interview.questions[0]?.id).toBe("common-role-focus");
  });

  it("does not restore a completed interview as an unanswered result", () => {
    const progress = toStoredInterviewProgress(stateWithPrivateAnswer());
    expect(
      restoreInterviewProgress({
        ...progress,
        completedQuestionCount:
          progress.fixedQuestionIds.length + progress.followUpCount,
      }),
    ).toBeNull();
  });
});

describe("optional local progress", () => {
  it("is off by default and only writes after explicit opt-in", () => {
    const storage = new MemoryStorage();
    const state = stateWithPrivateAnswer();
    expect(saveLocalProgress(state, storage)).toBe(false);
    expect(storage.getItem(LOCAL_PROGRESS_KEY)).toBeNull();

    setLocalResumeEnabled(true, storage);
    expect(storage.getItem(LOCAL_RESUME_PREFERENCE_KEY)).toBe("true");
    expect(saveLocalProgress(state, storage)).toBe(true);
    expect(loadLocalProgress(storage)?.schoolLevel).toBe("elementary");
    expect(storage.getItem(LOCAL_PROGRESS_KEY)).not.toContain(
      "절대로 저장되면 안 되는 원문 답변",
    );
  });

  it("deletes progress when opt-in is turned off", () => {
    const storage = new MemoryStorage();
    setLocalResumeEnabled(true, storage);
    saveLocalProgress(stateWithPrivateAnswer(), storage);
    setLocalResumeEnabled(false, storage);
    expect(storage.getItem(LOCAL_PROGRESS_KEY)).toBeNull();
    expect(storage.getItem(LOCAL_RESUME_PREFERENCE_KEY)).toBeNull();
  });
});
