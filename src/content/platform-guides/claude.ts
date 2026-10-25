import type { PlatformGuide } from "./schema";
// Approved source: docs/codex/platform-facts.md sections 4 and 5.3.
export const CLAUDE_GUIDE: PlatformGuide = {
  id: "claude",
  name: "Claude",
  summary: "프로젝트 지식에 교사 문서를 넣고 공통 지침을 함께 활용합니다.",
  fallbackMethodId: "claude-chat-attachment",
  methods: [
    {
      id: "claude-project",
      label: "프로젝트",
      status: "recommended",
      requiredArtifacts: ["profile-markdown", "usage-instructions"],
      steps: [
        {
          title: "프로젝트 만들기",
          body: "사이드바의 Projects에서 오른쪽 위 + New Project를 누르고 이름과 설명을 입력합니다.",
        },
        {
          title: "교사 문서 추가",
          body: "프로젝트 화면 오른쪽 지식 영역의 + 버튼으로 교사 문서를 올립니다.",
        },
        {
          title: "공통 지침 등록",
          body: "Set project instructions에 공통 활용 지침을 입력하고 Save instructions를 누릅니다. 그 프로젝트의 모든 대화에 적용됩니다.",
        },
      ],
      instructionTarget: "Set project instructions",
      availabilityNote:
        "무료 계정을 포함한 모든 사용자가 프로젝트를 쓸 수 있으며 무료 계정은 최대 5개입니다. 요금제에 따라 프로젝트 지침을 쓰지 못할 수 있습니다. 그 경우 대화를 시작할 때 공통 지침을 붙여 넣으세요. 일부 Pro·Max 계정은 새 프로젝트 화면 배포로 화면이 다를 수 있습니다.",
      officialUrl:
        "https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects",
      verifiedAt: "2026-10-25",
    },
    {
      id: "claude-chat-attachment",
      label: "일반 대화에 첨부",
      status: "available",
      requiredArtifacts: ["profile-markdown", "usage-instructions"],
      steps: [
        {
          title: "교사 문서 전달",
          body: "대화에 Markdown 파일을 첨부하거나 내용을 붙여 넣습니다.",
        },
        {
          title: "지침과 작업 요청 전달",
          body: "공통 활용 지침과 함께 지금 필요한 교육 관련 작업을 적습니다.",
        },
      ],
      instructionTarget: "대화 입력창",
      officialUrl:
        "https://support.claude.com/en/articles/10185728-understanding-claude-s-personalization-features",
      verifiedAt: "2026-10-25",
    },
  ],
};
