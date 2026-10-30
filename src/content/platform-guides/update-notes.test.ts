import { expect, it } from "vitest";
import { PLATFORM_GUIDES } from "./index";
import { platformGuideMethodSchema, platformGuidesSchema } from "./schema";

const approvedNotes: Record<string, string> = {
  "chatgpt-project":
    "프로젝트 소스 목록에서 이전 교사 문서를 삭제하고 새로 내려받은 문서를 올립니다.",
  "chatgpt-chat-attachment":
    "새 대화를 시작할 때 새로 내려받은 문서를 첨부합니다.",
  "gemini-chat-attachment":
    "새 대화를 시작할 때 새로 내려받은 문서를 첨부합니다.",
  "gemini-skill":
    "Skills 화면에서 Replace skill을 눌러 새 teacher-context.zip을 다시 올립니다.",
  "gemini-gem":
    "Gem을 고칠 수 있는 계정이면 지식 파일을 새 문서로 바꿉니다. 개인 계정은 2026-11-17부터 Gem을 고칠 수 없으므로 skill이나 대화 첨부로 옮깁니다.",
  "claude-project":
    "프로젝트 지식에서 이전 교사 문서를 지우고 새로 내려받은 문서를 올립니다.",
  "claude-chat-attachment":
    "새 대화를 시작할 때 새로 내려받은 문서를 첨부합니다.",
};

it("gives every method an update note while keeping the approved existing method text exact", () => {
  const methods = PLATFORM_GUIDES.flatMap((guide) => guide.methods);
  expect(platformGuidesSchema.safeParse(PLATFORM_GUIDES).success).toBe(true);
  for (const method of methods)
    expect(method.updateNote).toEqual(expect.any(String));
  for (const [id, note] of Object.entries(approvedNotes))
    expect(methods.find((method) => method.id === id)?.updateNote).toBe(note);
});

it("allows an omitted update note and rejects a blank supplied note", () => {
  const method = structuredClone(PLATFORM_GUIDES[0]!.methods[0]!);
  delete method.updateNote;
  expect(platformGuideMethodSchema.safeParse(method).success).toBe(true);
  expect(
    platformGuideMethodSchema.safeParse({ ...method, updateNote: "  " })
      .success,
  ).toBe(false);
});
