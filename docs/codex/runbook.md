# Codex 연속 실행 지침: WU-1a ~ WU-12

이 문서는 Codex가 여러 작업 단위(WU)를 사람의 개입 없이 이어서 구현할 때 따르는 운영 규칙이다. Claude는 중간 점검(WU-9 이후)과 최종 리뷰(WU-12 이후)에서 커밋과 진행 기록을 함께 검토한다.

## 1. 실행 순서

```text
WU-1a → WU-2 → WU-3 → WU-4 → WU-5 → WU-6 → WU-7 → WU-8 → WU-9
   ▶ 중간 정지(완료, 2026-10-25): Claude 리뷰 + platform-facts.md 작성 + 사용자 결정
WU-9(커밋) → WU-9a → WU-10 → WU-10a → WU-11 → WU-12
   ▶ 최종 정지: Claude 최종 리뷰(WU-9a 포함)
```

- 중간 정지는 끝났다. 남은 단계는 `docs/codex/wu-09a-phase1-review-fixes.md`의 0단계(WU-9 커밋)부터 시작해 **WU-12까지 멈추지 않고** 이어 간다(4절의 멈춤 조건은 계속 적용).
- WU-10a는 2026-10-25 사용자 승인으로 Phase 4에서 앞당긴 "단일 파일 `SKILL.md` 내보내기"다(5절).

## 2. 입력 문서와 우선순위

충돌하면 위의 문서가 우선한다.

1. `AGENTS.md`(저장소 불변 조건)
2. WU별 상세 지시문과 사실 문서
   - `docs/codex/wu-01a-serialize-migrate-hardening.md`
   - `docs/codex/wu-02-indexeddb-repository.md`
   - `docs/codex/wu-09a-phase1-review-fixes.md`
   - `docs/codex/platform-facts.md`(WU-10~12의 플랫폼 사실과 승인된 콘텐츠 값)
3. 이 문서 5절의 WU별 지침
4. `docs/local-profile-design.md` 7장(WU 범위·완료 조건)과 11.8절(WU-10~12)
5. `docs/local-profile-design.md`의 나머지 본문(근거·배경)

문서 사이에 모순이 있으면 임의로 고르지 말고, 진행 기록에 적은 뒤 4절의 기준에 따라 계속할지 멈출지 판단한다.

## 3. 공통 규칙

### 3.1 브랜치와 커밋

- 브랜치: `feat/local-profiles`. 새 브랜치를 만들지 않는다.
- **WU 하나당 커밋 하나.** 커밋 메시지는 영어 명령문 요약 뒤에 WU 번호를 붙인다.
  - 예: `Add opt-in IndexedDB repository for local profiles (WU-2)`
- 이전 WU의 커밋을 수정(amend, rebase)하지 않는다.
- 이전 WU에서 결함을 발견하면, **지금 WU 범위 안에서 꼭 필요할 때만** 고친다. 이 경우 진행 기록에 "이전 WU 수정"으로 따로 적는다.

### 3.2 커밋 전 자동 관문

모든 관문은 `corepack pnpm <명령>`으로 실행한다.

| 시점        | 반드시 통과                           |
| ----------- | ------------------------------------- |
| 모든 WU     | `lint`, `typecheck`, `test`           |
| WU-4부터    | 위 항목 + `build`                     |
| WU-9, WU-12 | 위 항목 + `test:e2e`(chromium·mobile) |

- 관문이 실패한 상태로 커밋하지 않는다.
- 테스트를 건너뛰게(`skip`, `only`, `todo`) 바꾸거나, 기대값을 구현에 맞춰 느슨하게 고치거나, lint 규칙을 끄는 방식으로 통과시키지 않는다.

### 3.3 변경 금지 영역

- `src/lib/export/profile-to-markdown*.ts`, `profile-to-text.ts`, `src/content/profile-document.ts`: Markdown 출력은 기여·관리자 검증 계약이다.
- `src/app/api/**`, `src/lib/ai/**`, `src/lib/consent/**`, `src/lib/supabase/**`, `supabase/**`: 서버 변경은 없다.
- `src/content/questions/**`, `src/lib/interview/**`, `src/lib/privacy/**`, `src/lib/storage/{index,local,session,schema,restore}.ts`
- `bd81a2e` 이전부터 있던 테스트 케이스: 수정하거나 삭제하지 않는다.
  - 예외는 E2E 공용 헬퍼를 `e2e/helpers.ts`로 **옮기는 것**뿐이다. 테스트 본문과 기대값은 그대로 둔다.
- `package.json`: 런타임 의존성을 추가하지 않는다. devDependency는 WU-2의 `fake-indexeddb@6.2.5` 하나만 추가한다.

### 3.4 진행 기록

`docs/codex/progress.md`를 만들고, 각 WU 커밋에 함께 포함한다. 같은 커밋 안에서 갱신하므로 커밋 해시는 적지 않는다(리뷰어가 `git log`로 연결한다).

```markdown
## WU-n 제목

- 상태: 완료 | 부분 완료(사유)
- 변경 파일: …
- 관문: lint ✓ typecheck ✓ test ✓(통과 N, 건너뜀 M) build ✓ e2e -
- 설계·지시와 다르게 구현한 부분과 이유: …
- 이전 WU 수정: 없음 | …
- 확인하지 못한 것·남은 위험: …
- 리뷰어에게 묻고 싶은 것: …
```

- 이 기록이 Claude 리뷰의 출발점이다.
- "다르게 구현한 부분"과 "확인하지 못한 것"은 비워 두지 말고, 없으면 "없음"이라고 쓴다.

## 4. 멈추고 물어봐야 하는 경우

다음 중 하나라도 해당하면 **그 WU를 커밋하지 말고** 진행 기록에 상황을 적은 뒤 멈춘다.

1. 3.3절의 변경 금지 영역을 고쳐야만 진행할 수 있다.
2. 저장 형식이 바뀐다: 로컬 기록 스키마, 백업 파일 형식, DB 이름·버전, 저장 키.
3. 개인정보 불변 조건과 충돌한다.
   - 원문 답변, 서명 토큰, 기여 영수증, 경고 확인 상태를 저장해야 하는 상황
   - 동의 전에 DB를 만들어야 하는 상황
   - 가져온 파일의 검사 결과를 신뢰해야 하는 상황
4. 같은 WU에서 관문을 세 번 고쳐도 통과하지 못한다.
5. 기존 테스트의 기대값을 바꿔야 한다.
6. 새 런타임 의존성이 필요하다.
7. WU-10~12에서 `docs/codex/platform-facts.md`에 없는 플랫폼 사실(기능명, 단계, URL, 일정, 요금제 조건)이 필요할 때

**정지 지점(1절: WU-9 완료, WU-12 완료)은 위의 "커밋하지 않는" 경우가 아니다.** 관문을 모두 통과했으면 그 WU를 평소처럼 커밋한 **뒤에** 멈춘다. (2026-10-25 정정: 이전 판의 7번이 정지 지점을 커밋 금지 목록에 넣어 WU-9가 미커밋으로 남았다.)

"작은 설계 판단"(내부 함수 분리, 컴포넌트 이름, 문구 다듬기)은 멈추지 말고 결정한 뒤 진행 기록에 남긴다.

## 5. WU별 지침

설계 문서 7장의 범위와 완료 조건이 기본이다. 아래는 그 위에 반드시 지킬 구체적 결정과 함정이다.

### WU-1a, WU-2

상세 지시문을 그대로 따른다. WU-2는 WU-1a 커밋 위에서 시작한다.

### WU-3. JSON 백업 생성·파싱과 결과 화면 다운로드

- `src/lib/export/files.ts`
  - `ExportFile = { path; mediaType; content }`
  - `downloadTextFile(file, { bom })`를 추가한다.
  - **`downloadMarkdown`은 지금처럼 BOM(`﻿`)을 붙이고 파일명을 정리(sanitize)하는 동작을 그대로 유지**하며, 내부에서 `downloadTextFile(…, { bom: true })`에 위임한다.
  - JSON은 BOM 없이 내려받는다.
- `src/lib/storage/profiles/backup.ts`
  - `createProfileBackupFile({ kind, profile, suggestedTags, recordId?, now }) → Result<ExportFile>`
    - `profileBackupFileSchema`로 검증한 뒤 `JSON.stringify(file, null, 2) + "\n"`으로 만든다.
    - 파일명은 `profileBackupFilename(schoolLevel, date)`로 만들며, Markdown 파일명과 같은 패턴에 확장자만 `.json`이다.
  - `parseProfileBackupFile(file: Pick<File, "name" | "size" | "text">, now) → Promise<Result<BackupImportPreview>>`
    - `MAX_BACKUP_FILE_BYTES = 1_048_576`이다. **크기 검사는 `text()`를 읽기 전에** 한다.
    - 확장자 `.json`(대소문자 무시) → UTF-8 BOM 제거 → `JSON.parse` → `migrateBackupFile` 순서로 처리한다.
    - 정규화: `privacyReview`는 항상 `PENDING_PRIVACY_REVIEW`의 새 복사본으로 바꾸고, 결과는 `localDraftProfileSchema`로 검증한다.
    - `localAuthoredProfilePrivacyReview`(`@/lib/security/privacy-guard`)로 경고 개수를 계산한다.
    - 미리보기에는 제목, 학교급·역할, 모듈별 문장 수, 미확인 수, 경고 수, 원본 종류(`kind`, `source`), `recordId`를 담는다.
  - 오류 코드마다 한국어 안내 문구 표(`BACKUP_IMPORT_ERROR_MESSAGES`)를 둔다. 각 문구에는 "무엇이 잘못됐는지"와 "어떻게 하면 되는지"를 모두 넣는다.
- `result-actions.tsx`
  - "JSON 백업 다운로드" 버튼을 추가한다.
  - 용도 안내: Markdown은 AI 활용용, JSON은 TContext에서 다시 열기 위한 보관·복원용.
  - `suggestedTags`는 `ResultView`가 세션에서 꺼내 prop으로 넘긴다.
  - **IndexedDB를 열지 않는다.**

### WU-4. 세션 연결과 태그 보존 — 회귀 위험 높음

- `LocalProfileLink = { recordId, revision, baseline: TeacherContextProfile | null, openedAt: number }`
  - `openedAt`은 `openProfile`을 호출할 때마다 새로 정하는 값이다.
- `InterviewSessionProvider`
  - `localProfileLink`, `setLocalProfileLink`, `openProfile(...)`을 추가한다.
  - `openProfile`은 profile·suggestedTags·markdown을 한 번에 설정하고 token·receipt를 비운다.
    - view 모드: `markdown = profileToMarkdown(profile)`
    - edit 모드: `markdown = ""`
    - 메모리에만 연 가져오기 문서는 link가 `null`인 edit 모드다.
  - `clearBrowserRecords`는 link만 `null`로 만들고 **IndexedDB에는 손대지 않는다**(R1).
- `interview-flow.tsx`의 `generateProfile`: `setProfile` 전에 `setLocalProfileLink(null)`을 호출한다(R2).
- `ProfileReview`
  - 실제 본문을 내부 컴포넌트로 감싸고 `key={localProfileLink?.openedAt ?? "interview"}`로 다시 마운트한다.
  - **`revision`을 key에 쓰지 않는다.** 그러면 자동 저장 때마다 지역 상태가 날아간다.
  - `selectedTags` 초기값은 `selectedTagKeysFromConfirmedTags(profile.confirmedTags)`다(R3).
  - `completeReview`의 태그 계산은 `confirmedTagsFromSelection`으로 바꿔도 된다(동치성은 WU-1 테스트로 고정).
- `LocalProfilesProvider`
  - 하이드레이션 전에는 availability를 `"unknown"`으로 두고 저장 관련 UI를 그리지 않는다.
  - 마운트할 때는 `getLocalProfileAvailability`만 호출한다(DB 생성 금지).
  - `LOCAL_PROFILES_CHANNEL` 메시지를 받으면 목록과 availability를 다시 읽는다.
  - 테스트용으로 `factory` prop을 받는다.
- **link가 `null`이면 기존 동작과 완전히 같아야 한다.** 기존 RTL·E2E는 수정 없이 통과해야 한다.

### WU-5. 결과 화면 로컬 저장(opt-in)

- `LocalSavePanel` 상태는 다음과 같다: `unknown`(렌더링 안 함), `unavailable`, `unsupported_version`, 꺼짐(동의 체크박스·기본 해제), 켜짐·미연결(한 번 클릭 저장), 연결됨(저장 시각, "내 프로파일 열기"), 상한 도달.
- 저장 순서
  1. 꺼져 있으면 `enableLocalProfiles`
  2. `toConfirmedSnapshot(profile, now)`
  3. `createLocalProfile({ origin: "interview", confirmed, suggestedTags })`
  4. link 설정(`baseline` = 스냅샷의 profile)
- 고지 4가지: 이 브라우저에만 저장, 서버로 보내지 않음, 공용 기기 주의, 브라우저 데이터를 지우면 사라질 수 있으니 JSON 백업 권장.
- 패널 제목은 "이 브라우저에 보관하기 (서버로 보내지 않음)"이다. `ContributionPanel`과 상태·체크박스·오류를 공유하지 않는다.
- "다시 수정하기"는 `/review`로 이동하며 link를 유지한다.
- **"내 프로파일" 내비게이션·푸터 링크는 WU-6에서 추가한다.** WU-5 시점에는 `/profiles`가 없기 때문이다. 설계 7장의 WU-5 범위를 이렇게 조정한다.

### WU-6. 내 프로파일 화면과 가져오기

- `/profiles`: 서버 컴포넌트 껍데기(`robots: noindex`)와 클라이언트 `ProfileLibrary`로 구성한다.
- 상태별 표시
  - 꺼짐: opt-in 카드와 "JSON 불러와 저장하지 않고 열기"만 보인다. 이 화면에 들어오는 것만으로 DB가 생기면 안 된다.
  - 켜짐: 목록(배지 3종), 가져오기, 모두 삭제.
- 동작별 처리
  - 보기: `getLocalProfile` → `openProfile(view)` → `/result`
  - 수정: `toEditableSession` → `openProfile(edit)` → `/review`
- 메모리에 저장하지 않은 문서(`profile !== null && link === null`)가 있으면, 다른 문서를 열기 전에 AlertDialog로 경고한다.
- 가져오기 선택지는 설계 6.4를 따른다.
  - "기존 프로파일의 편집 초안으로"는 `saveDraft`(expectedRevision 포함)를 쓴다. 기존 초안이 있으면 대체 확인을 받는다. 확정본은 바뀌지 않는다.
- 손상·미래 버전 항목은 내용을 렌더링하지 않고 삭제만 제공한다(`id`가 `null`이면 전체 삭제 안내).
- 홈 화면 `SavedProfilesEntry`: DB가 없으면 `null`을 렌더링한다. 레이아웃이 흔들리지 않게 한다.
- `primary-nav.tsx`와 `app-shell.tsx`에 "내 프로파일"을 추가한다.
  - **320px 넘침 E2E를 통과해야 한다.** 모바일에서는 짧은 라벨이나 아이콘+`aria-label`을 쓴다.
  - 기존 "문서 예시" 링크의 이름과 `href`는 바꾸지 않는다.

### WU-7. 검토 화면 편집 강화와 자동 저장 — 회귀 위험 가장 높음

- **문장 추가**: `createTeacherAuthoredClaim` → 반드시 기존 `updateDraftProfile` 경로로 반영한다(검사 무효화). 종합 목록 4종의 "문장 추가"는 `updateSynthesis`를 쓴다.
- **`diffProfiles`**(`src/lib/profile/changes.ts`): 설계 4.5. 태그는 비교 대상이 아니다. 비교하더라도 집합으로 비교한다.
- **자동 저장 훅(`useLocalDraftAutosave`) 설계**

  1. 트리거는 `profile` 객체가 바뀌거나 `selectedTags`가 바뀌는 것이다. `openProfile` 직후의 첫 값은 건너뛴다.
     - `refineModule` 성공 경로는 `updateDraftProfile`을 거치지 않으므로 `draftRevisionRef`만 보면 놓친다.
  2. 800ms 디바운스. `pagehide`와 `visibilitychange(hidden)`에서는 즉시 flush한다.
  3. **모든 쓰기(초안과 확정본)는 훅이 가진 하나의 직렬 큐로 처리한다.** 앞선 쓰기가 끝난 뒤의 최신 `revision`을 다음 쓰기의 `expectedRevision`으로 쓴다.
  4. 확정 흐름(`finalizeAndShowResult`)이 시작되면 대기 중인 초안 저장을 **취소**하고, 큐에 `saveConfirmed`를 넣는다. 확정 이후에는 초안을 저장하지 않는다.
     - 확정 직후 `setProfile(reviewedProfile)`가 다시 트리거를 일으켜 확정본 뒤에 초안이 생기는 경쟁 상태를 막기 위해서다.
  5. 언마운트될 때: 확정 중이 아니면 flush, 확정 중이면 아무것도 하지 않는다.
  6. 저장이 성공하면 link의 `revision`만 갱신한다(`openedAt`은 그대로라 다시 마운트되지 않는다). 상태는 `LocalDraftStatus`(`aria-live="polite"`)로 표시한다.

- **`finalizeAndShowResult(finalProfile)`**
  - clear 분기와 경고 확인 분기가 같이 쓴다.
  - 순서: markdown 설정 → link가 있으면 확정 저장을 큐에 넣음(기다리지 않음) → `/result`로 이동
  - 저장 결과(성공 시 link의 `revision`·`baseline` 갱신, 실패 시 오류)는 `LocalSavePanel`이 보여준다.
  - **저장 실패가 이동이나 다운로드를 막지 않는다.**
- **초안 버리기**: AlertDialog → `discardDraft` → 기록이 남아 있으면 `toEditableSession`으로 다시 연다(새 `openedAt`). 삭제됐으면 `/profiles`로 이동한다.
- **충돌**: "이 탭 내용으로 저장"은 최신 기록을 읽어 그 `revision`으로 다시 저장한다. "저장된 최신 내용 불러오기"는 다시 연다.
- 새 UI는 `src/components/local-profiles/*`의 작은 컴포넌트로 분리한다. `profile-review.tsx`에는 연결 코드만 둔다.
- 필수 RTL
  - 확정 직후 초안이 생기지 않는다.
  - 모듈 재작성 결과가 자동 저장된다.
  - link가 없으면 저장 호출이 0회다.
  - 연속 입력이 저장 1회로 합쳐진다.
  - 저장이 실패해도 결과 화면으로 이동한다.
  - 기존 늦은 응답 무시 테스트가 그대로 통과한다.

### WU-8. 개인정보 안내·문서

- 사실과 달라지는 문구를 고친다.
  - 확인 위치: `README.md:36`, `docs/privacy-design.md:21·24`, `src/app/privacy/page.tsx:40-44`, `src/components/privacy/browser-record-controls.tsx:17`, `src/components/profile/profile-review.tsx:458`, `src/components/export/result-view.tsx:39`, `src/components/layout/app-shell.tsx:51`
  - 원칙: "원문 답변은 저장하지 않는다"는 유지한다. "프로필은 브라우저에 저장하지 않는다"는 "교사가 켠 경우에만 이 브라우저에 저장한다"로 바꾼다.
- **홈 화면의 "저장 없이도 완성" 제목은 유지한다**(E2E가 검사한다. 저장은 선택이므로 여전히 사실이다).
- `docs/data-dictionary.md`에 "브라우저 로컬 저장(IndexedDB)" 절을 추가한다: DB 이름·store, 저장 필드, 저장하지 않는 항목, 보존 기간(교사가 지우거나 브라우저가 지울 때까지), 삭제 방법.
- `/privacy`에 `LocalProfileDeleteControls`를 둔다. "이 탭의 모든 기록 삭제" 버튼 근처에는 그 버튼이 저장된 프로파일은 지우지 않는다는 안내를 붙인다.

### WU-9. E2E와 Phase 1 회귀

- 새 파일은 `e2e/local-profiles.spec.ts`이며, 설계 8.4표의 시나리오를 모두 구현한다.
- 브라우저 재접속은 `context.storageState({ indexedDB: true })`로 상태를 저장하고 새 `browser.newContext({ storageState })`를 여는 방식으로 재현한다.
- #10(동의하지 않은 사용자)은 `indexedDB.databases()`에 `tcontext-local-profiles`가 없고, Web Storage에 프로필 본문이 없는 것을 함께 확인한다.
- 기존 E2E 전체가 수정 없이 통과해야 한다(헬퍼 이동만 허용).
- **완료 후 1절에 따라 정지한다.** 진행 기록 맨 아래에 Phase 1 요약을 적는다: 전체 관문 결과, 남은 위험, 리뷰어에게 묻고 싶은 것.

### WU-10 ~ WU-12. AI 플랫폼 활용 가이드(Phase 2)

- 범위와 완료 조건은 설계 11.4~11.8을 따른다.
- **플랫폼 기능명, 단계, 공식 URL, 상태, 확인일은 `docs/codex/platform-facts.md`에 있는 내용만 쓴다.** 모르는 사실을 추측해 채우지 않는다. 필요한 사실이 그 문서에 없으면 해당 항목을 비워 두지 말고 멈춘다(4절 7번). 각 방법의 `verifiedAt`은 `2026-10-25`다.
- 방법 구성과 상태는 `platform-facts.md` 5절(승인됨)을 그대로 쓴다.
  - Gemini: `gemini-skill`(`recommended`, zip 패키지 업로드 — WU-10a), `gemini-gem`(`transitioning` + `migrationNote`), `gemini-chat-attachment`(`available`, fallback — A 방식: 지침 복사 또는 지침 `SKILL.md` 내려받기 + 교사 프로파일 문서 첨부)
  - ChatGPT: `chatgpt-project`(`recommended`), `chatgpt-chat-attachment`(`available`, fallback — A 방식)
  - Claude: `claude-project`(`recommended`), `claude-chat-attachment`(`available`, fallback — A 방식)
  - 설계 9장 결정 6의 이전 값(`gemini-skill`=`announced`)은 쓰지 않는다.
- 렌더러에는 플랫폼 id 문자열 비교가 없어야 한다. 아키텍처 가드 테스트가 계속 통과해야 한다.
- WU-12 완료 후 정지한다(최종 리뷰).

### WU-10a. Agent Skill zip 패키지와 지침 전용 `SKILL.md` 내보내기 (2026-10-25 승인, Phase 4에서 앞당김)

사용자 결정(2026-10-25): Gemini skill에는 **zip 패키지(`SKILL.md` + `references/teacher-profile.md`)**를 쓴다. 지침과 교사 프로필을 분리하고, Phase 4의 패키지 구조를 그대로 앞당긴다. 처음 승인한 "단일 파일 `SKILL.md`" 방식은 쓰지 않는다.

- 산출물 두 가지: ① skill용 zip 패키지(3절), ② A 방식용 지침 전용 `SKILL.md`(3-1절)
- 위치: `src/lib/export/zip.ts`, `src/lib/export/skill.ts`(신규)와 각 테스트. 이 폴더는 아키텍처 가드 대상이므로 **플랫폼 이름을 쓰지 않는다.** 공개 Agent Skills 형식만 다룬다.
- **새 런타임 의존성 금지**(runbook 3.3). zip은 직접 작성한다.

#### 1) `ExportFile` 확장 (`src/lib/export/files.ts`, `download.ts`)

- `content: string | Uint8Array`로 넓히고, `mediaType`에 `"application/zip"`을 추가한다.
- `downloadTextFile`은 `content`가 `Uint8Array`이면 BOM 옵션을 무시하고 바이트 그대로 Blob을 만든다.
- 기존 Markdown·JSON 다운로드 동작과 테스트는 바뀌지 않아야 한다.

#### 2) 무압축 zip 작성기 (`src/lib/export/zip.ts`)

- 함수: `createStoredZip(entries: ReadonlyArray<{ path: string; content: Uint8Array }>, modifiedAt: Date) → Uint8Array`
- 저장 방식은 무압축(method 0)이다.
  - CRC-32는 표준 다항식 테이블로 계산한다.
  - 각 항목에 로컬 파일 헤더 → 데이터를 쓰고, 끝에 중앙 디렉터리와 EOCD를 쓴다.
  - 파일 이름은 UTF-8로 쓰고 general purpose flag bit 11을 켠다.
  - 수정 시각은 `modifiedAt`에서 DOS 날짜·시각으로 만든다(결정적 출력).
- 경로 규칙: `/` 구분자만 허용한다. 빈 경로, 절대 경로, `..`, `\`, 중복 경로는 오류(예외)다(프로그래밍 오류). 디렉터리 항목은 만들지 않는다.
- ZIP64는 지원하지 않는다. 전체 크기가 4 GiB 이상이거나 항목 수가 65,535를 넘으면 오류다.

#### 3) 패키지 생성 (`src/lib/export/skill.ts`)

- 함수: `createSkillPackageFile({ profile, now }) → Result<ExportFile>`
  - 입력은 **확정본**만 받는다. `teacherContextProfileSchema` 검증에 실패하거나 privacyReview가 검사 대기 상태이면 오류다.
  - 결과 파일: `path` `"teacher-context.zip"`, `mediaType` `"application/zip"`
- zip 내부 구조. 사용자가 시험한 표본 zip과 같은 배치이며, 디렉터리 항목 없이 파일 2개만 넣는다.

```text
teacher-context/SKILL.md
teacher-context/references/teacher-profile.md
```

- `teacher-context/SKILL.md`(순서 고정, UTF-8, BOM 없음)
  1. YAML 머리말
     - `name: teacher-context`(상수, 소문자·하이픈만, 폴더 이름과 같아야 한다)
     - `description`: 고정 문구 "교사가 검토한 교육관·수업 방식·학급 맥락·AI 협업 원칙입니다. 수업 설계, 활동지, 평가, 수업 검토 같은 교육 관련 요청에서 참고합니다."
     - 값은 기존 `yamlQuoted`로 인용한다.
     - **프로필 제목이나 본문을 머리말에 넣지 않는다.**
  2. `# 교사 컨텍스트 사용 지침`
     - 첫 문단 고정: "교사 컨텍스트는 이 skill의 참고 파일 `references/teacher-profile.md`에 있습니다. 교육 관련 요청을 받으면 먼저 이 파일을 읽고 요청과 관련 있는 내용을 선별해 반영하세요."
     - 이어서 WU-10의 `COMMON_USAGE_INSTRUCTIONS` 본문
  3. `## 사용 원칙`: 지침서 7.3의 7개 항목. 첫 항목은 "교육 관련 요청에서 `references/teacher-profile.md`를 참고한다."로 쓴다. 상수는 `src/content/usage-instructions.ts`에 둔다.
  4. **`---` 수평선을 본문에 쓰지 않는다.** 머리말 구분자와 혼동될 수 있다.
- `teacher-context/references/teacher-profile.md`: `profileToMarkdown(profile)`의 결과를 **그대로** 넣는다(UTF-8, BOM 없음).
  - Markdown 다운로드 파일과 내용이 같아야 한다.
  - `profileToMarkdown`은 수정하지 않는다(변경 금지 영역).
  - 개인정보 경고·미확인 문장 경고 블록은 그대로 들어간다.

#### 3-1) 지침 전용 `SKILL.md` (A 방식용, `src/lib/export/skill.ts`)

- 함수: `createUsageInstructionsFile() → ExportFile`
  - 교사 프로필이 필요 없는 **고정 내용**이다. 문서가 메모리에 없어도 만들 수 있다.
  - `path` `"SKILL.md"`, `mediaType` `"text/markdown"`, UTF-8, BOM 없음
- 내용(순서 고정)
  1. YAML 머리말: `name: teacher-context-guide`(zip 패키지의 `teacher-context`와 겹치지 않게 다른 이름), `description`: "대화에 첨부한 교사 프로파일 컨텍스트 문서를 함께 사용하기 위한 활용 지침입니다. 교육 관련 요청에서 참고합니다." 값은 `yamlQuoted`로 인용한다.
  2. `# 교사 컨텍스트 활용 지침`
     - 첫 문단 고정: "이 대화에 첨부된 교사 프로파일 컨텍스트 문서(TContext에서 내려받은 Markdown)를 교사 컨텍스트로 사용하세요. 문서가 첨부되어 있지 않으면 먼저 첨부를 요청하세요."
     - 이어서 `COMMON_USAGE_INSTRUCTIONS`
  3. `## 사용 원칙`: 지침서 7.3의 7개 항목. 첫 항목은 "교육 관련 요청에서 첨부된 교사 프로파일 컨텍스트 문서를 참고한다."로 쓴다.
  4. 본문에 `---` 수평선을 쓰지 않는다.
- 이 파일은 플랫폼을 가리지 않는다. 세 플랫폼의 A 방식(대화 첨부)에서 같은 파일을 쓴다.

#### 4) 가이드 연결

- **순서**
  - WU-10에서는 `gemini-skill`의 `requiredArtifacts`를 `["profile-markdown", "usage-instructions"]`로 두어 콘텐츠 검증을 통과시킨다.
  - WU-10a에서 `AVAILABLE_ARTIFACTS`에 `"skill-package"`를 추가하면서, `gemini-skill`의 `requiredArtifacts`를 `["skill-package"]`로 바꾸고 단계 문구를 아래 업로드 경로로 고친다.
  - 설계 11.4의 `GuideArtifactId`에 이미 있는 `"skill-package"`를 쓴다. 이전 판의 `"skill-file"`은 쓰지 않는다.
- 가이드 문구(`platform-facts.md` 2.2 기준)
  - 만들기: Gemini 웹에서 **Customize** → **Skills** → **Create** → **Upload** → 내려받은 `teacher-context.zip` 선택 → **Open** → 검토 → **Create**
  - 사용: 대화에서 `/`(또는 `@`)를 입력하고 skill을 고른다.
  - 조건: 만 18세 이상, Keep Activity 켜기, 업로드는 웹·Mac 앱에서만 된다는 점을 표시한다.
  - 갱신: TContext에서 문서를 고치면 새 zip을 내려받아 해당 skill의 **Replace skill**로 다시 올려야 한다. Gemini에서는 참고 파일만 따로 고칠 수 없다(공식 문서: 파일을 바꾸려면 skill 전체를 다시 업로드).
  - zip 파일 이름은 바뀌어도 괜찮다(`teacher-context (1).zip` 등). 안쪽 폴더 이름이 skill 이름이다.
- **A 방식(대화에 붙이기)**: `gemini-chat-attachment`, `chatgpt-chat-attachment`, `claude-chat-attachment`에 같은 구성을 쓴다.
  - `requiredArtifacts`: `["usage-instructions", "profile-markdown"]`
  - 렌더러는 artifact `usage-instructions`에 버튼 두 개를 둔다: **지침 복사**, **지침 `SKILL.md` 내려받기**(`createUsageInstructionsFile`). 새 artifact id는 만들지 않는다.
  - 단계 문구
    1. 공통 지침을 복사해 대화 첫 메시지에 붙이거나, 지침 `SKILL.md`를 내려받아 대화에 첨부한다.
    2. 교사 프로파일 컨텍스트 문서(Markdown)를 대화에 첨부한다.
    3. 요청을 입력한다.
  - 대화마다 다시 붙이거나 첨부해야 한다는 안내를 붙인다.
  - 문서가 메모리에 없으면 Markdown 다운로드만 비활성화하고, 지침 복사·내려받기는 그대로 쓸 수 있다(설계 11.8 WU-11).

#### 5) 테스트

- **zip**
  - CRC-32 표준 검증값: `"123456789"` → `0xCBF43926`
  - 테스트 안의 최소 판독기(EOCD → 중앙 디렉터리 → 로컬 헤더)로 다시 읽었을 때 항목 이름, 크기, CRC, 내용 바이트가 입력과 같다. UTF-8 한글 파일 이름도 확인한다.
  - 경로 규칙 위반은 오류다. 같은 입력과 시각이면 출력 바이트가 같다.
- **패키지**
  - 항목이 정확히 위 2개다.
  - `SKILL.md` 머리말의 `name`이 `^[a-z0-9-]+$`이고 폴더 이름과 같다. `description`이 비어 있지 않다.
  - `SKILL.md`에 `---`이 머리말 한 쌍 외에는 없다.
  - `SKILL.md`가 `references/teacher-profile.md`를 가리킨다.
  - 참고 파일이 `profileToMarkdown(profile)`과 바이트 단위로 같다.
  - 경고 상태 프로필의 경고 블록이 참고 파일에 남아 있다.
  - 검사 대기 상태이거나 유효하지 않은 프로필은 오류를 반환한다.
- **지침 전용 `SKILL.md`**: 머리말 `name`이 `teacher-context-guide`이고 패키지 이름과 다르다. 본문에 공통 지침과 사용 원칙이 있고, `---`은 머리말 한 쌍뿐이다. 교사 프로필 내용이 들어가지 않는다(입력이 없다). 출력이 결정적이다.
- **다운로드**: `Uint8Array` 내용이 BOM 없이 Blob으로 만들어진다. 기존 Markdown BOM 테스트는 그대로 통과한다.
- 아키텍처 가드가 통과한다.

#### 6) 실측

- 사용자가 표본 zip(시험 C) 업로드 결과를 `platform-facts.md` 6절에 기록한다. 이 결과는 최종 리뷰에서 다룬다. Codex는 결과를 기다리지 않는다.
- 최종 리뷰 전에 Codex가 만든 실제 zip으로 사용자가 한 번 더 업로드해 보는 것을 권장한다.
