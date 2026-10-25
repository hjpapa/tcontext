import type { PlatformGuide } from "./schema";
// Approved source: docs/codex/platform-facts.md sections 3 and 5.3.
export const CHATGPT_GUIDE: PlatformGuide = {
  id: "chatgpt",
  name: "ChatGPT",
  summary: "프로젝트에 교사 문서와 공통 지침을 등록해 활용합니다.",
  fallbackMethodId: "chatgpt-chat-attachment",
  methods: [
    {
      id: "chatgpt-project",
      label: "프로젝트",
      status: "recommended",
      requiredArtifacts: ["profile-markdown", "usage-instructions"],
      steps: [
        {
          title: "프로젝트 만들기",
          body: "사이드바에서 New project를 누르고 프로젝트 이름, 아이콘과 색을 고릅니다.",
        },
        {
          title: "교사 문서 추가",
          body: "내려받은 Markdown 문서를 프로젝트 소스에 올리거나 내용을 붙여 넣습니다.",
        },
        {
          title: "공통 지침 등록",
          body: "더보기 메뉴(•••) → Project settings에서 공통 활용 지침을 붙여 넣습니다. 프로젝트 지침은 그 프로젝트 안에서만 적용되며 전체 맞춤 지침보다 우선합니다.",
        },
      ],
      instructionTarget: "••• → Project settings의 프로젝트 지침",
      availabilityNote:
        "로그인이 필요하며 요금제와 워크스페이스 설정에 따라 다릅니다. 파일은 Free 5개, Go·Plus 25개, Edu·Pro·Business·Enterprise 40개까지, 한 번에 10개까지 올릴 수 있습니다.",
      officialUrl:
        "https://help.openai.com/en/articles/10169521-projects-in-chatgpt",
      verifiedAt: "2026-10-25",
    },
    {
      id: "chatgpt-chat-attachment",
      label: "일반 대화에 첨부",
      status: "available",
      requiredArtifacts: ["usage-instructions", "profile-markdown"],
      steps: [
        {
          title: "공통 지침 전달",
          body: "공통 지침을 복사해 대화 첫 메시지에 붙이거나, 지침 SKILL.md를 내려받아 대화에 첨부합니다.",
        },
        {
          title: "교사 문서 첨부",
          body: "교사 프로파일 컨텍스트 문서(Markdown)를 대화에 첨부합니다. 지침과 교사 문서는 대화마다 다시 붙이거나 첨부해야 합니다.",
        },
        {
          title: "작업 요청 전달",
          body: "지금 필요한 교육 관련 작업을 입력합니다.",
        },
      ],
      instructionTarget: "대화 입력창",
      officialUrl:
        "https://help.openai.com/en/articles/10169521-projects-in-chatgpt",
      verifiedAt: "2026-10-25",
    },
  ],
};
