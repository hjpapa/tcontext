# AI 플랫폼 사실 확인 문서 (WU-10~12 입력)

- 확인일: 2026-10-25
- 확인자: Claude
- 방법: 각 회사의 공식 도움말 원문을 직접 읽었다. 2차 보도는 날짜가 서로 엇갈려 근거로 쓰지 않았다.
- 용도: runbook 5절에 따라 WU-10~12의 플랫폼 기능명, 단계, URL, 상태, 확인일은 **이 문서에 있는 내용만** 쓴다.
- 갱신 규칙: 플랫폼 화면이나 정책이 바뀌면 이 문서를 먼저 고치고, 콘텐츠 파일의 `verifiedAt`도 함께 갱신한다.

> 이 문서는 사실(1~4절), 사용자가 승인한 콘텐츠 값(5절), 사용자 실측 기록(6절)을 구분한다. 5절은 2026-10-25에 모두 승인되었다.

## 1. 공통

- 지침서 4.6의 공통 활용 지침 문안은 `instruct.md` 272~287행을 그대로 쓴다.
- 세 플랫폼 모두 파일과 지침을 외부 서비스로 보낸다. 데이터 사용(모델 개선) 설정은 각 서비스와 계정 유형에 따라 다르다. 예를 들어 ChatGPT 개인 계정은 "Improve the model for everyone" 설정의 영향을 받는다. 가이드에는 "등록하기 전에 각 서비스의 데이터 설정을 확인하세요" 수준으로만 안내하고, 특정 정책을 단정하지 않는다.
- TContext에서 고친 내용은 외부 서비스에 자동으로 반영되지 않는다. 수정한 뒤에는 파일을 다시 등록해야 한다(지침서 4.7).

## 2. Google Gemini

### 2.1 Gem → skill 전환 일정 (공식)

출처: [About the transition from Gems to skills](https://support.google.com/gemini/answer/18560919?hl=en), [Google Workspace Updates (2026-09-30, 2026-10-13 갱신)](https://workspaceupdates.googleblog.com/2026/09/skills-gemini-app-workspace.html)

| 계정 유형                              | 일정                                                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 개인 Google 계정(만 18세 이상)         | **2026-11-17부터 Gem 읽기 전용**: 사용·수정·새로 만들기 불가. **2026-12-17 제거**. Gem은 skill로 자동 전환되며, 지원되는 지식 파일은 함께 옮겨진다. 일괄 이전 기능은 없다.                                                       |
| 개인 계정(만 18세 미만)                | 나중에 발표 예정                                                                                                                                                                                                                 |
| Workspace 비즈니스·엔터프라이즈·비영리 | **2027-03-01 이전에는 바뀌지 않음**. 그 이후 Gem 생성·수정·사용 불가. 2026-11-17부터 Gem 메뉴가 설정 패널로 옮겨지지만 계속 쓸 수 있다.                                                                                          |
| Workspace 교육용(Education)            | **2027-06-01 이전에는 바뀌지 않음**. 그 이후에는 Gemini 앱, Google Classroom, LTI 연동 LMS에서도 Gem을 쓸 수 없다. 남은 Gem은 **초안 상태의 skill**로 자동 전환되며 직접 활성화해야 한다. 관리자는 최소 30일 전에 통지를 받는다. |

### 2.2 skill (공식)

출처: [Create & manage skills for Gemini Apps (Computer)](https://support.google.com/gemini/answer/17094296?hl=en&co=GENIE.Platform%3DDesktop)

- 이용 조건
  - 만 18세 이상, Gemini 앱에 로그인, "Keep Activity" 켜기
  - Gemini 웹앱(gemini.google.com), 모바일 앱, Mac 앱에서 쓸 수 있다.
  - Workspace 계정의 Gemini 앱 skill은 2026-10-13부터 배포되어 2026-11 중순 완료 예정이다. Workspace 앱(Studio 등) 쪽 배포는 지연 중이다.
- 직접 만들기(컴퓨터 웹)
  1. gemini.google.com에서 사이드바의 **Customize**를 누른다. 보이지 않으면 **More**를 먼저 누른다.
  2. 위쪽의 **Skills**를 누른다.
  3. **Create** → **Create manually**를 누른다.
  4. 이름(name), 설명(description), 지침(instructions)을 입력한다.
  5. 위쪽의 **Create**를 누른다.
- 파일 넣기
  - 참고 파일은 **skill을 업로드할 때만** 함께 넣을 수 있다. 직접 만들기 화면에서는 파일을 붙일 수 없다.
  - 업로드 경로: **Create** → **Upload** → `SKILL.md` 파일, 또는 루트에 `SKILL.md`가 있는 폴더나 `.zip` 선택 → **Open** → 검토 → **Create**
  - 조건
    - `SKILL.md`는 루트에 있어야 한다.
    - skill 이름은 **소문자와 하이픈**만 쓴다.
    - 전체 용량은 100 MB 이하다.
    - 지원 형식: `.txt`, `.md`, `.json`, `.csv`, `.pdf`, 이미지 등
    - 지원하지 않는 형식: `.docx`, `.doc`, `.xlsx`
    - 파일을 바꾸려면 skill 전체를 다시 업로드해야 한다.
  - 업로드는 웹앱과 Mac 앱에서만 된다(전환 안내 페이지 기준).
- 사용
  - 대화에서 `/`(바뀐 단축키가 적용된 계정은 `@`)를 입력한 뒤 skill을 고른다.
  - 활성화된 skill은 관련이 있을 때 자동으로 쓰일 수 있다.
  - 동시에 활성화할 수 있는 skill은 최대 100개다.
- 형식: Google은 skill이 공개 `SKILL.md` 표준을 따르며 다른 플랫폼의 skill을 가져올 수 있다고 밝혔다.
- 제한: Canvas, Deep Research와 Gem 기본 도구 대부분(Guided learning 등)은 아직 skill에서 동작하지 않는다.

### 2.3 Gem (전환 전까지, 공식)

출처: [Use Gems in Gemini Apps (Computer)](https://support.google.com/gemini/answer/15146780?hl=en&co=GENIE.Platform%3DDesktop)

1. 컴퓨터 브라우저에서 gemini.google.com을 연다.
2. 사이드바에서 **Gems**를 누른다. 처음이라면 **Settings and help** → **Gems** 순서다.
3. **New Gem**을 누른다.
4. 이름과 지침(instructions)을 입력한다.
5. (선택) **Knowledge** 아래 **Add files** → **Upload files**를 누른다.
6. **Save**를 누른다. 미리보기만으로는 저장되지 않는다.

- 이용 조건: 개인 계정은 만 13세(국가별 해당 연령) 이상이다.

### 2.4 일반 대화에 파일 첨부 (공식)

출처: [Upload & analyze files in Gemini Apps](https://support.google.com/gemini/answer/14903178?hl=en&co=GENIE.Platform%3DDesktop)

- 한 번에 최대 10개 파일을 올릴 수 있다(이용 가능 여부에 따라 다름). 동영상이 아닌 파일은 최대 100 MB다.
- 대화마다 다시 첨부해야 한다.

## 3. ChatGPT

출처: [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt). 원문을 브라우저로 직접 읽었으며, 페이지 표시는 "Updated: 15 minutes ago"였다.

- 이용 조건
  - 로그인한 사용자. 요금제와 워크스페이스 설정에 따라 다르다.
  - 프로젝트 수는 무제한이다.
- 프로젝트별 파일 수: Free 5개, Go·Plus 25개, Edu·Pro·Business·Enterprise 40개. 한 번에 올릴 수 있는 파일은 10개다.
- 만들기
  1. 사이드바에서 **New project**를 누른다.
  2. 프로젝트 이름을 입력하고 아이콘과 색을 고른다.
- 파일 추가: PDF, 스프레드시트, 문서, 이미지를 올리거나 텍스트를 붙여 넣는다. 추가한 파일은 프로젝트 소스 목록에서 미리 보기, 내려받기, 삭제할 수 있다.
- 프로젝트 지침
  - 더보기 메뉴(**•••**) → **Project settings**에서 지침을 추가한다.
  - **프로젝트 지침은 그 프로젝트 안에서만 적용되며, 전체 맞춤 지침(custom instructions)보다 우선한다.**
- 메모리: 기본 메모리와 프로젝트 전용 메모리 중에서 고른다(**•••** → **Project settings** → Memory). 공유 프로젝트는 프로젝트 전용 메모리로 고정된다.
- 삭제: **•••** → **Delete project**. 되돌릴 수 없다.
- 데이터: 개인 계정에서 공유 프로젝트의 데이터는 소유자와 모든 참여자가 "Improve the model for everyone"을 켠 경우에만 모델 개선에 쓰일 수 있다. Business·Enterprise·Edu 데이터는 기본적으로 학습에 쓰지 않는다.
- 일반 대화 대안: 대화에 Markdown 파일을 첨부하거나 내용을 붙여 넣는다.

## 4. Claude

출처: [How can I create and manage projects?](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects), [What are projects?](https://support.claude.com/en/articles/9517075-what-are-projects), [Understanding Claude's personalization features](https://support.claude.com/en/articles/10185728-understanding-claude-s-personalization-features)

- 이용 조건
  - **무료 계정을 포함한 모든 사용자**가 프로젝트를 쓸 수 있다. 무료 계정은 프로젝트를 최대 5개까지 만들 수 있다.
  - 유료 요금제(Pro, Max, Team, Enterprise)는 지식이 커지면 RAG로 확장된다.
- 만들기
  1. 사이드바의 **Projects**를 누르거나 claude.ai/projects로 이동한다.
  2. 오른쪽 위의 **+ New Project**를 누른다.
  3. 이름과 설명을 입력한다. 이 이름과 설명은 Claude가 읽지 않는다.
- 지식 추가: 프로젝트 화면 오른쪽 지식 영역의 **+** 버튼으로 문서, 텍스트, 코드를 올린다. 공식 문서에 파일 형식과 용량 한도는 적혀 있지 않다.
- 프로젝트 지침: **Set project instructions** → 입력 → **Save instructions**. 그 프로젝트의 모든 대화에 적용된다.
- **확인되지 않은 점**
  - 무료 요금제에서 프로젝트 지침을 쓸 수 있는지 공식 문서끼리 설명이 다르다. 한 문서는 모든 사용자에게 안내하고, 개인화 문서는 "paid plans only"라고 적는다.
  - 가이드 문구는 "요금제에 따라 프로젝트 지침을 쓰지 못할 수 있습니다. 그 경우 대화를 시작할 때 공통 지침을 붙여 넣으세요"로 쓴다.
- 새 버전의 프로젝트가 단계적으로(Claude Code부터) 배포되는 중이라, 일부 Pro·Max 사용자에게는 화면이 다를 수 있다.
- 일반 대화 대안: 대화에 Markdown 파일을 첨부하거나 내용을 붙여 넣는다.

## 5. WU-10 콘텐츠 값 (2026-10-25 사용자 승인)

5.1과 5.2는 Claude 권장안이었고, 사용자가 2026-10-25에 모두 승인했다. Codex는 아래 값을 그대로 구현한다.

### 5.1 설계 9장 결정 6의 수정 — 승인됨

설계 확정 당시(2026-10-25 오전)에는 "Gem 권장, skill은 출시 예정"이었다. 그러나 공식 일정상 **개인 계정의 Gem은 Phase 2 배포 무렵(2026-11-17) 읽기 전용이 된다.** 그래서 다음과 같이 바꾼다.

| id                       | status          | 안내 요지                                                                                                                                                                                        |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gemini-skill`           | `recommended`   | 개인 계정(만 18세 이상)의 기본 경로. TContext가 만든 zip 패키지를 업로드한다(5.2, WU-10a).                                                                                                       |
| `gemini-gem`             | `transitioning` | Workspace 교육용(2027-06-01 이전)·비즈니스(2027-03-01 이전) 계정에서만 새로 만들 수 있다. 개인 계정은 2026-11-17부터 읽기 전용이며, 기존 Gem은 skill로 자동 전환된다는 `migrationNote`를 붙인다. |
| `gemini-chat-attachment` | `available`     | A 방식: 공통 지침 복사(또는 지침 전용 `SKILL.md` 내려받아 첨부) + 교사 프로파일 Markdown 첨부. 모든 계정의 대안(`fallbackMethodId`)                                                              |

### 5.2 Gemini skill에 교사 문서를 넣는 방법 — zip 패키지(C)로 결정

공식 사양상 skill에 파일을 넣으려면 `SKILL.md`를 포함한 파일, 폴더 또는 `.zip`을 **업로드**해야 한다. 직접 만들기 화면에서는 파일을 붙일 수 없다. 파일을 바꾸려면 skill 전체를 다시 업로드해야 한다(공식).

- **결정(2026-10-25, 사용자)**
  - **skill 경로 = C**: zip 패키지(`teacher-context/SKILL.md` + `teacher-context/references/teacher-profile.md`)를 업로드한다(WU-10a).
    - 지침(고정)과 교사 프로필(수시 변경)을 분리한다.
    - Phase 4의 Agent Skill 패키지 구조와 같다.
  - **대안 경로 = A**(`gemini-chat-attachment`): 공통 지침을 복사해 붙이거나 **지침 전용 `SKILL.md`**(`name: teacher-context-guide`, 프로필 없음)를 내려받아 첨부하고, 교사 프로파일 Markdown을 대화에 직접 첨부한다. 모든 계정에서 쓸 수 있으며 ChatGPT·Claude의 대안 경로도 같다.
  - 이전에 승인한 "단일 파일 `SKILL.md`(선택 B)"는 쓰지 않는다.
- 안내: Gemini 웹에서 **Customize** → **Skills** → **Create** → **Upload** → 내려받은 `teacher-context.zip` 선택 → **Open** → 검토 → **Create**. 갱신할 때는 새 zip을 **Replace skill**로 다시 올린다.
- **확인되지 않은 점**: Gemini가 참고 파일(`references/teacher-profile.md`)을 실제로 읽어 답에 반영하는지는 공식 문서로 확인할 수 없다.
- **확인 절차**: 사용자가 표본 zip(시험 C)과 Codex가 만든 실제 zip을 계정에 올려 보고, 결과를 6절에 기록한다. 구현(WU-10a)은 결과를 기다리지 않는다. 최종 리뷰 전까지 반영이 확인되지 않으면 skill 안내를 보류하고 A를 기본 경로로 둔다.

### 5.3 ChatGPT·Claude

- `chatgpt-project`(recommended): 3절의 단계. 프로젝트 지침 칸에 공통 지침을 붙여 넣는다.
- `chatgpt-chat-attachment`(available, fallback): A 방식(지침 복사 또는 지침 `SKILL.md` 첨부 + 교사 프로파일 Markdown 첨부)
- `claude-project`(recommended): 4절의 단계. 지침을 쓸 수 없는 요금제를 위한 대안 문구를 포함한다.
- `claude-chat-attachment`(available, fallback): A 방식(지침 복사 또는 지침 `SKILL.md` 첨부 + 교사 프로파일 Markdown 첨부)

## 6. 사용자 실측 기록

| 날짜       | 항목                                                               | 결과                                                                                                                |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 2026-10-25 | 표본 1(구분선 `---`이 있는 단일 `SKILL.md`) 업로드                 | 업로드는 됨. 교사 프로필이 반영되지 않는 느낌(구분선에서 본문이 잘렸을 가능성)                                      |
| -          | 시험 B(구분선 없는 단일 `SKILL.md`)                                | 시험하지 않음                                                                                                       |
| -          | 시험 C(수작업 zip)                                                 | 시험하지 않음(아래 실제 zip으로 대체)                                                                               |
| 2026-10-26 | Codex 생성 코드로 만든 실제 zip(`teacher-context.zip`) 업로드·사용 | **skill은 만들어짐. 그러나 참고 파일(`references/teacher-profile.md`)을 읽지 않고 지침만으로 답하는 경우가 있었음** |
| 2026-10-26 | 지침 전용 `SKILL.md`(`teacher-context-guide`) 업로드               | skill은 만들어짐                                                                                                    |

### 6.1 판단 (Claude, 2026-10-26)

- zip 방식은 Gemini가 참고 파일을 **항상 읽는다고 확인되지 않았다.** 5.2의 확인 절차에 따라 Gemini의 기본 경로를 대화 첨부(A)로 바꾸는 조정이 필요하다(`docs/codex/wu-12a-gemini-guide-adjustment.md`, 적용됨(WU-12a)).
- 대화 첨부는 교사 문서가 대화 안에 직접 들어가므로 참고 파일 열람 여부에 의존하지 않는다.

## 7. skill 공식 사양 (2026-10-30 확인, Phase 4 입력)

Claude가 2026-10-30에 공식 문서를 직접 읽고 정리했다. Phase 4 콘텐츠(`chatgpt-skill`, `claude-skill`)와 호환성 검사(`src/content/skill-format.ts`)는 이 절의 값만 쓴다.

### 7.1 공개 Agent Skills 사양

출처: [Agent Skills Specification](https://agentskills.io/specification)

- 폴더 하나가 skill 하나다. 필수 파일은 `SKILL.md`이고, `references/`·`scripts/`·`assets/`는 선택이다.
- `SKILL.md`는 YAML 머리말 뒤에 Markdown 본문이 온다.
- `name`(필수): 1~64자, 소문자·숫자·하이픈만, 하이픈으로 시작·끝나거나 연속(`--`)이면 안 된다. **상위 폴더 이름과 같아야 한다.**
- `description`(필수): 1~1024자. 무엇을 하는지와 언제 쓰는지를 적는다.
- 선택 필드: `license`, `compatibility`(1~500자), `metadata`(문자열 키-값), `allowed-tools`(실험적)
- 점진적 로딩: 시작할 때는 `name`·`description`만, skill이 켜지면 `SKILL.md` 본문 전체, `references/` 등의 파일은 **필요할 때만** 읽힌다.
- 본문은 5,000토큰 미만, 500줄 미만을 권장한다. 참조는 `SKILL.md`에서 한 단계 깊이만 둔다.

### 7.2 Claude

출처: [Create custom skills](https://claude.com/docs/skills/how-to), [Using Skills in Claude](https://support.claude.com/en/articles/12512180-using-skills-in-claude)

- 이용 조건: Free·Pro·Max·Team·Enterprise. **코드 실행이 켜져 있어야 한다.** Team·Enterprise는 소유자가 사용자 skill을 끌 수 있고, Enterprise 사용자 역할에 skill 만들기 권한이 없을 수 있다.
- 올리기: **Customize → Skills → + → Create skill → Upload a skill**에서 zip 파일을 올린다.
- zip 구조: 최상위에 skill 폴더가 있어야 한다(`<skill-name>/SKILL.md`). 루트에 `SKILL.md`만 있으면 skill로 인식하지 않는다. 폴더 이름은 `name`과 같아야 한다.
- 흔한 실패: zip 크기 초과, 폴더 이름과 skill 이름 불일치, `SKILL.md` 누락, 이름·설명의 잘못된 문자
- 올린 뒤 Customize → Skills에서 skill을 켠다.

### 7.3 ChatGPT

출처: [Skills in ChatGPT](https://help.openai.com/en/articles/20001066-skills-in-chatgpt) (페이지 표시: "Updated: 9일 전")

- 이용 조건: **Business·Enterprise·Healthcare·Edu** 사용자. 워크스페이스 설정과 제품 제공 여부에 따라 다르다. Plus·Free는 공식 문서에 없다.
- 찾기: 사이드바 **Plugins** → Plugin Directory의 **Skills** 탭
- 올리기: Skills → **Create** → **Upload from your computer**
- 올린 skill은 검사(scan)를 거친다. 대부분 검사 직후 쓸 수 있고, 일부는 Needs Review나 Blocked가 될 수 있다.
- Enterprise·Edu 관리자는 skill 사용, 올리기, 공유 권한을 따로 켜고 끈다.
- **확인되지 않은 점**: 업로드 파일 형식(zip, 폴더, 단일 파일). 그래서 가이드에 "업로드가 되지 않으면 대화 첨부 방식을 쓰세요"를 붙인다(설계 9장 결정 8).

### 7.4 Gemini

- 2.2의 사실(2026-10-25)을 그대로 쓴다. 파일·폴더·zip 업로드, 이름은 소문자와 하이픈, 파일을 바꾸려면 Replace skill로 다시 올린다.
- Phase 4 구현 뒤 사용자가 핵심본을 넣은 새 `SKILL.md`로 다시 실측해 6절에 기록한다.
