import { expect, it } from "vitest";
import { CHATGPT_GUIDE } from "./chatgpt";
import { CLAUDE_GUIDE } from "./claude";
import { platformGuideMethodSchema } from "./schema";

const shared = {
  label: "skill로 등록(고급)",
  status: "available",
  requiredArtifacts: ["skill-package"],
  verifiedAt: "2026-10-30",
};

it("adds only the approved advanced ChatGPT skill method at the end", () => {
  const method = CHATGPT_GUIDE.methods.at(-1)!;
  expect(method).toEqual({
    ...shared,
    id: "chatgpt-skill",
    officialUrl:
      "https://help.openai.com/en/articles/20001066-skills-in-chatgpt",
    availabilityNote:
      "Business·Enterprise·Healthcare·Edu 요금제에서 워크스페이스 설정에 따라 쓸 수 있습니다. 업로드 파일 형식은 공식 문서에 적혀 있지 않습니다.",
    steps: [
      {
        title: "skill 패키지 내려받기",
        body: "아래에서 ZIP 패키지를 내려받습니다. 압축은 풀지 않습니다.",
      },
      {
        title: "skill 올리기",
        body: "ChatGPT 사이드바에서 Plugins → Skills 탭 → Create → Upload from your computer를 고르고 teacher-context.zip을 올립니다. 올린 뒤 검사가 끝나면 쓸 수 있습니다.",
      },
      {
        title: "확인하기",
        body: "수업 설계를 요청해 교사 맥락이 반영되는지 확인합니다. 업로드가 되지 않으면 대화 첨부 방식을 쓰세요.",
      },
    ],
    updateNote:
      "Skills 화면에서 기존 teacher-context skill을 지우고 새 teacher-context.zip을 다시 올립니다.",
  });
  expect(platformGuideMethodSchema.safeParse(method).success).toBe(true);
});

it("adds only the approved advanced Claude skill method at the end", () => {
  const method = CLAUDE_GUIDE.methods.at(-1)!;
  expect(method).toEqual({
    ...shared,
    id: "claude-skill",
    officialUrl:
      "https://support.claude.com/en/articles/12512180-using-skills-in-claude",
    availabilityNote:
      "Free·Pro·Max·Team·Enterprise에서 쓸 수 있으며 코드 실행이 켜져 있어야 합니다. Team·Enterprise는 관리자가 사용자 skill을 막을 수 있습니다.",
    steps: [
      {
        title: "skill 패키지 내려받기",
        body: "아래에서 ZIP 패키지를 내려받습니다. 압축은 풀지 않습니다.",
      },
      {
        title: "skill 올리기",
        body: "Claude에서 Customize → Skills로 이동해 + → Create skill → Upload a skill을 고르고 teacher-context.zip을 올립니다.",
      },
      {
        title: "켜고 확인하기",
        body: "올린 skill을 켭니다. 수업 설계를 요청해 교사 맥락이 반영되는지 확인합니다.",
      },
    ],
    updateNote:
      "Customize → Skills에서 기존 teacher-context skill을 지우고 새 teacher-context.zip을 다시 올립니다.",
  });
  expect(platformGuideMethodSchema.safeParse(method).success).toBe(true);
});
