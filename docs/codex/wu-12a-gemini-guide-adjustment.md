# Codex 작업 지시: WU-12a Gemini 안내 조정 (실측 반영)

- 상태: **사용자 승인 대기**. 승인되기 전에는 시작하지 않는다.
- 근거: `docs/codex/platform-facts.md` 6절(2026-10-26 사용자 실측)과 5.2의 확인 절차
- 선행 커밋: WU-12(`1c08b03`)와 그 뒤의 문서 커밋
- 산출물: 커밋 1개. 규칙은 `docs/codex/runbook.md` 3~4절을 그대로 적용한다.

## 1. 배경

- Codex 생성 코드로 만든 실제 `teacher-context.zip`을 Gemini에 업로드하면 skill은 만들어진다.
- 그러나 **참고 파일(`references/teacher-profile.md`)을 읽지 않고 지침만으로 답하는 경우가 있었다.**
- 5.2에서 정한 규칙("반영이 확인되지 않으면 대화 첨부(A)를 기본 경로로")에 따라, Gemini의 기본 경로를 A로 바꾼다. skill은 보조 경로로 남기되 한계를 안내한다.

## 2. 변경 범위

### 2.1 `src/content/platform-guides/gemini.ts`

1. 방법 순서를 `gemini-chat-attachment` → `gemini-skill` → `gemini-gem`으로 바꾼다. 배열 순서가 곧 권장 순서다.
2. `gemini-chat-attachment`
   - `status`를 `"recommended"`로 바꾼다.
   - 단계 문구는 그대로 둔다: 지침 복사 또는 지침 `SKILL.md` 첨부 + 교사 Markdown 첨부.
3. `gemini-skill`
   - `status`를 `"available"`로 바꾼다. `replaces: "gemini-gem"`은 유지한다.
   - `availabilityNote` 끝에 다음 문장을 추가한다: "skill이 참고 문서를 읽지 않고 지침만으로 답하는 경우가 확인되었습니다(2026-10 기준). 답에 교사 문서 내용이 보이지 않으면 '참고 파일을 먼저 읽고 답해 주세요'라고 덧붙이거나, 교사 Markdown을 대화에 함께 첨부하세요."
   - 마지막 단계("대화에서 사용") 본문에 같은 요령을 한 문장으로 넣는다.
4. `summary`: "대화에 교사 문서를 첨부하는 방법을 기본으로 안내하고, skill과 계정별 Gem 전환 일정도 함께 안내합니다."
5. `fallbackMethodId`는 `"gemini-chat-attachment"`로 유지한다. 모든 계정에서 쓸 수 있는 경로이기 때문이다.

### 2.2 `src/components/ai-guide/platform-guide-view.tsx` (렌더러, 플랫폼 무관 변경)

- 대안 안내 문장("권장 방법을 이용하기 어렵다면 …")은 **대안 방법 자체가 `recommended`이면 표시하지 않는다.** 권장 방법이 곧 대안이면 문장이 자기 자신을 가리키게 되기 때문이다.
- 플랫폼 id로 분기하지 않는다. 상태 값으로만 판단한다.

### 2.3 `src/lib/export/skill.ts`

1. YAML 머리말의 `name`은 **따옴표 없이** 쓴다: `name: teacher-context`, `name: teacher-context-guide`.
   - 두 값은 상수이며 `^[a-z0-9-]+$`를 만족하므로 인용할 필요가 없다. 테스트로 이 조건을 고정한다.
   - 사용자가 처음 시험한 표본(따옴표 없음)과 같은 형태다.
   - `description`은 지금처럼 `yamlQuoted`를 유지한다.
2. zip 안 `SKILL.md`의 첫 문단을 다음으로 바꾼다. 참고 파일을 반드시 읽게 하기 위해서다.
   - "이 skill을 사용할 때는 답하기 전에 반드시 참고 파일 `references/teacher-profile.md` 전체를 먼저 읽으세요. 교사 컨텍스트는 이 파일에만 있습니다. 파일을 읽지 못했다면 그 사실을 사용자에게 알리고, 교사 프로파일 문서를 대화에 첨부해 달라고 요청하세요."
3. 지침 전용 `SKILL.md`의 첫 문단은 그대로 둔다.

### 2.4 테스트

다음 테스트의 **기대값을 새 결정에 맞게 바꾼다.** 사용자가 승인하면 runbook 4절 5번(기존 테스트 기대값 변경)의 예외로 허용된다.

- `src/content/platform-guides/schema.test.ts`의 상태 표: `gemini-chat-attachment` → `recommended`, `gemini-skill` → `available`
- `src/components/ai-guide/transition.test.tsx`: Gemini 방법 상태를 바꾸는 시뮬레이션의 출발 상태를 새 값에 맞춘다. 전환 시뮬레이션 자체(상태만 바꾸면 화면이 바뀐다는 검증)는 유지한다.
- `src/lib/export/skill.test.ts`: 머리말 `name`이 따옴표 없이 정확히 `name: teacher-context`인 줄을 확인한다. 첫 문단에 "반드시"와 참고 파일 경로가 있는지 확인한다.
- 새 RTL: 대안 방법이 권장 상태이면 대안 안내 문장이 보이지 않는다. ChatGPT·Claude처럼 권장 방법과 대안이 다르면 그대로 보인다.
- `e2e/ai-guide.spec.ts`: Gemini 화면에서 첫 번째 방법이 "일반 대화에 첨부"이고 "권장" 배지를 갖는지 확인한다. 이에 맞지 않는 기존 선택자만 고친다.

## 3. 범위 밖

- zip 구조, 참고 파일 내용, Markdown 생성, 저장 형식, 서버
- ChatGPT·Claude 콘텐츠(이번 실측은 Gemini만 해당)

## 4. 완료 조건

- [ ] `lint`, `typecheck`, `test`, `build`, `test:e2e`(chromium·mobile, 재시도 0)가 통과한다.
- [ ] 아키텍처 가드가 통과하고, 렌더러에 플랫폼 id 비교가 없다.
- [ ] `platform-facts.md` 6.1의 "사용자 승인 대기" 문구를 "적용됨(WU-12a)"으로 바꾼다.
- [ ] 진행 기록에 "WU-12a" 절을 추가한다.
- [ ] 커밋 메시지: `Make chat attachment the default Gemini path after field testing (WU-12a)`
- [ ] 커밋한 뒤 멈추고 보고한다.
