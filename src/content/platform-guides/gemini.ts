import type { PlatformGuide } from "./schema";
// Approved source: docs/codex/platform-facts.md sections 2, 5 and 6 (WU-12a).
export const GEMINI_GUIDE: PlatformGuide = {
  id: "gemini",
  name: "Google Gemini",
  summary:
    "대화에 교사 문서를 첨부하는 방법을 기본으로 안내하고, skill과 계정별 Gem 전환 일정도 함께 안내합니다.",
  fallbackMethodId: "gemini-chat-attachment",
  methods: [
    {
      id: "gemini-chat-attachment",
      label: "일반 대화에 첨부",
      status: "recommended",
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
      updateNote: "새 대화를 시작할 때 새로 내려받은 문서를 첨부합니다.",
      availabilityNote:
        "한 번에 최대 10개 파일을 올릴 수 있으며 이용 가능 여부에 따라 다릅니다. 동영상이 아닌 파일은 최대 100 MB입니다.",
      officialUrl:
        "https://support.google.com/gemini/answer/14903178?hl=en&co=GENIE.Platform%3DDesktop",
      verifiedAt: "2026-10-25",
    },
    {
      id: "gemini-skill",
      label: "skill",
      status: "available",
      replaces: "gemini-gem",
      updateNote:
        "Skills 화면에서 Replace skill을 눌러 새 teacher-context.zip을 다시 올립니다.",
      requiredArtifacts: ["skill-package"],
      steps: [
        {
          title: "Skills 열기",
          body: "Gemini 웹의 사이드바에서 Customize → Skills를 누릅니다. Customize가 보이지 않으면 More를 먼저 누릅니다.",
        },
        {
          title: "ZIP 패키지 업로드",
          body: "Create → Upload에서 내려받은 teacher-context.zip을 선택하고 Open을 누릅니다. 내용을 검토한 뒤 Create를 누릅니다. 직접 만들기 화면에서는 참고 파일을 붙일 수 없습니다.",
        },
        {
          title: "파일명 확인",
          body: "zip 파일 이름은 teacher-context (1).zip처럼 바뀌어도 괜찮습니다. 안쪽 폴더 이름이 skill 이름입니다.",
        },
        {
          title: "대화에서 사용",
          body: "대화에서 / 또는 @로 skill을 고릅니다. TContext에서 문서를 고치면 새 zip을 내려받아 Replace skill로 다시 올려 주세요. 참고 파일만 따로 고칠 수 없으므로 skill 전체를 다시 업로드해야 합니다. 답에 교사 문서 내용이 보이지 않으면 '참고 파일을 먼저 읽고 답해 주세요'라고 덧붙이거나, 교사 Markdown을 대화에 함께 첨부하세요.",
        },
      ],
      availabilityNote:
        "만 18세 이상, 로그인과 Keep Activity 켜기가 필요합니다. 업로드는 웹앱과 Mac 앱에서만 가능합니다. Workspace 계정에는 2026-10-13부터 배포되어 2026-11 중순 완료 예정입니다. skill이 참고 문서를 읽지 않고 지침만으로 답하는 경우가 확인되었습니다(2026-10 기준). 답에 교사 문서 내용이 보이지 않으면 '참고 파일을 먼저 읽고 답해 주세요'라고 덧붙이거나, 교사 Markdown을 대화에 함께 첨부하세요.",
      officialUrl:
        "https://support.google.com/gemini/answer/17094296?hl=en&co=GENIE.Platform%3DDesktop",
      verifiedAt: "2026-10-25",
    },
    {
      id: "gemini-gem",
      label: "Gem",
      status: "transitioning",
      requiredArtifacts: ["profile-markdown", "usage-instructions"],
      steps: [
        {
          title: "Gems 열기",
          body: "컴퓨터 브라우저에서 Gemini를 열고 사이드바의 Gems를 누릅니다. 처음이라면 Settings and help → Gems 순서로 이동합니다.",
        },
        {
          title: "Gem 만들기",
          body: "New Gem에서 이름과 공통 활용 지침을 입력합니다.",
        },
        {
          title: "교사 문서 추가와 저장",
          body: "Knowledge 아래 Add files → Upload files로 교사 문서를 올리고 Save를 누릅니다. 미리보기만으로는 저장되지 않습니다.",
        },
      ],
      instructionTarget: "New Gem의 instructions",
      updateNote:
        "Gem을 고칠 수 있는 계정이면 지식 파일을 새 문서로 바꿉니다. 개인 계정은 2026-11-17부터 Gem을 고칠 수 없으므로 skill이나 대화 첨부로 옮깁니다.",
      availabilityNote:
        "새 Gem 만들기는 Workspace 교육용(2027-06-01 이전)·비즈니스(2027-03-01 이전) 계정의 경로로 안내합니다.",
      migrationNote:
        "개인 계정은 2026-11-17부터 Gem이 읽기 전용이 되어 사용·수정·새로 만들기가 불가능하고 2026-12-17 제거됩니다. 기존 Gem은 skill로 자동 전환됩니다. Workspace 교육용은 2027-06-01 이전에는 바뀌지 않으며, 이후 남은 Gem은 초안 상태의 skill로 전환되어 직접 활성화해야 합니다.",
      officialUrl:
        "https://support.google.com/gemini/answer/15146780?hl=en&co=GENIE.Platform%3DDesktop",
      verifiedAt: "2026-10-25",
    },
  ],
};
