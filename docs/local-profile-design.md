# Phase 0·1 설계: 로컬 프로파일 관리

- 기준 문서: 「TContext 고도화 개발 지침서 v1.0」(`instruct.md`)
- 기준 코드: `main` @ `bd81a2e`
- 범위: Phase 0(현행 분석)과 Phase 1(로컬 프로파일 관리)을 구현 수준으로 다룬다. 추가 요구사항(Gemini Gem→Skill 전환 대응)에 따라 플랫폼 독립 내보내기 구조와 Phase 2 가이드의 데이터 구조는 11장에서 설계만 한다. 핵심본·모듈 선택본(Phase 3), 버전 이력·스킬 패키지 생성(Phase 4), Markdown 역변환 가져오기, Gemini Skill 자동 생성·설치는 범위 밖이다.
- 상태: 9장 결정 확정(2026-10-25). WU-1 지시문은 `docs/codex/wu-01-schema-serialize-migrate.md`에 있다. 설계 작성 단계에서는 코드를 변경하지 않았다.
- 역할: Claude가 설계와 리뷰, Codex가 구현을 맡는다. 작업 단위와 완료 조건은 7장에 있다.

## 0. 핵심 결정 요약

1. **canonical JSON은 바꾸지 않는다.** `TeacherContextProfile`(`src/types/profile.ts`)과 `profileToMarkdown` 출력은 그대로 둔다. 로컬 저장은 이 JSON을 감싸는 `LocalProfileRecord` 래퍼로만 추가한다.
2. **저장소는 IndexedDB 하나만 쓰고 opt-in으로만 생성한다.** 동의하기 전에는 DB를 만들지 않는다. 존재 여부만 확인하는 `openExisting` 경로를 두고, 사용 중지는 `deleteDatabase`로 처리한다.
3. **확정본과 편집 초안은 한 레코드 안의 별도 칸에 둔다.** `confirmed`는 기존 검토 흐름(교사 확인 → 개인정보 검사 또는 경고 확인)을 통과한 프로파일만 담는다. `draft`는 그 뒤에 수정한 내용으로, 자동 저장 대상이다.
4. **첫 저장은 /result에서 명시적으로 한다.** 처음 생성한 AI 초안은 검토가 끝나기 전에는 저장하지 않는다. 저장한 프로파일을 다시 열어 고칠 때만 초안을 자동 저장한다.
5. **기존 개인정보 체계를 재사용한다.** 편집하면 기존 `markPrivacyReviewPending` 규칙으로 검사 결과·토큰·Markdown이 무효화된다. 서명 토큰(`privacyReviewToken`), 기여 영수증, 경고 확인 체크, 원문 답변은 IndexedDB에 저장하지 않는다.
6. **가져온 JSON은 확정본으로 취급하지 않는다.** 파일 안의 `privacyReview`를 신뢰하지 않고 초안으로 들인다. 교사가 다시 확정해야 확정본이 된다. 기존 확정본은 가져오기 때문에 덮어써지지 않는다.
7. **`clearBrowserRecords`는 저장된 프로파일을 지우지 않는다.** 이 함수는 새 인터뷰를 시작할 때도 호출된다(`interview-flow.tsx:173`). 저장된 프로파일 삭제는 별도의 명시적 동작으로 분리한다.
8. **대규모 리팩터링은 하지 않는다.** `profile-review.tsx`에는 연결 지점만 추가하고, 새 UI·로직은 작은 컴포넌트, 훅, 순수 함수로 분리한다.
9. **플랫폼 정보는 콘텐츠 데이터에만 둔다.** ChatGPT·Gemini·Claude의 기능명, 설치 절차, 링크는 `src/content/platform-guides/*`에만 존재한다. 핵심 로직(`src/types`, `src/lib/export`, `src/lib/storage`, `src/lib/profile`)에는 플랫폼 이름을 쓰지 않으며, 이를 테스트로 고정한다. Gemini Gem→Skill 전환은 `gemini.ts` 콘텐츠 파일 하나만 고쳐 반영할 수 있어야 한다(11장).

---

## 1. Phase 0 — 현행 분석

### 1.1 구조

| 영역          | 위치                                                                                   | 역할                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 라우트        | `src/app/{interview,review,result,privacy,delete,examples}/page.tsx`                   | 서버 컴포넌트 껍데기 + 클라이언트 본문 컴포넌트                                                                                                   |
| 세션 상태     | `src/components/layout/interview-session-provider.tsx`                                 | interview·profile·suggestedTags·markdown·privacyReviewToken·contributionReceipt를 React 메모리에 보관. 루트 `layout.tsx`에서 전역 Provider로 사용 |
| 인터뷰        | `src/components/interview/interview-flow.tsx`, `src/lib/interview/*`                   | 질문 분기, 후속 질문, `/api/profile/generate` 호출                                                                                                |
| 검토·편집     | `src/components/profile/profile-review.tsx` (1,697줄)                                  | 문장 확인·수정·삭제·이동, 모듈 AI 재작성, 태그 선택, 최종 개인정보 검사                                                                           |
| 결과·내보내기 | `src/components/export/result-view.tsx`, `result-actions.tsx`, `src/lib/export/*`      | Markdown 다운로드·복사·인쇄, 일반·짧은 텍스트                                                                                                     |
| 기여          | `src/components/consent/contribution-panel.tsx`, `src/lib/consent/*`                   | Supabase 선택 저장(서명 토큰 필수)                                                                                                                |
| 개인정보      | `src/lib/privacy/*`, `src/lib/security/privacy-guard.ts`, `src/lib/ai/privacy.ts`      | 규칙 탐지기(클라이언트에서도 사용 가능), 최종 AI 검사                                                                                             |
| 브라우저 저장 | `src/lib/storage/{schema,session,local,restore}.ts`                                    | 진행 위치 메타데이터만 저장(allowlist 직렬화)                                                                                                     |
| 스키마        | `src/types/profile.ts`                                                                 | Zod canonical 스키마, 태그 어휘, 개인정보 검사 상태                                                                                               |
| 테스트        | `src/**/*.test.ts(x)`(Vitest+RTL, jsdom), `e2e/*.spec.ts`(Playwright, chromium+mobile) | API는 `page.route`로 모킹                                                                                                                         |

### 1.2 현재 데이터 흐름

```text
[인터뷰 화면] 답변(메모리) ──POST /api/profile/generate──▶ profile + suggestedTags (메모리)
      │  sessionStorage/localStorage(opt-in): 진행 위치 메타데이터만
      ▼
[/review] ProfileReview
  편집할 때마다 updateDraftProfile → privacyReview=PENDING, markdown/token 초기화
  completeReview: 제목·빈 문장·종합 확인·미확인 문장 검사
      └─POST /api/privacy/review──▶ clear      → token + markdown → /result
                                   needs_review → 경고 확인 체크 → markdown → /result
                                   429/5xx/시간 초과 → UNVERIFIED(=needs_review) → 경고 확인 → /result
      ▼
[/result] ResultView
  ResultActions: Markdown 다운로드·복사·인쇄 (서버 요청 없음)
  ContributionPanel: clear + 동의 + 서명 토큰(1시간) → /api/submissions/create
  "이 탭의 모든 기록 삭제" → clearBrowserRecords
```

### 1.3 상태 보관 위치

| 데이터                                                                                      | 보관 위치                                  | 비고                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| 원문 답변(`interview.answers`)                                                              | React 메모리                               | Web Storage·IDB 저장 금지(AGENTS.md 불변 조건)  |
| 진행 위치 메타데이터                                                                        | `sessionStorage`, opt-in 시 `localStorage` | `toStoredInterviewProgress` allowlist           |
| `profile`, `suggestedTags`, `markdown`                                                      | React 메모리                               | 새로고침하면 사라짐                             |
| `privacyReviewToken`                                                                        | React 메모리                               | 서버 HMAC 서명, 1시간 TTL, 프로필 digest에 결합 |
| `contributionReceipt`(삭제 코드 원문)                                                       | React 메모리                               | 한 번만 표시                                    |
| `selectedTags`, `synthesisConfirmed`, `privacyWarningAccepted`, 화면 표시용 `privacyReview` | `ProfileReview` 지역 상태                  | 화면을 다시 열면 초기화됨                       |

### 1.4 프로파일 스키마 요점

- `teacherContextProfileSchema`(`src/types/profile.ts:373`)는 strict 객체다. 모듈 7개가 각각 정확히 1회 있어야 하고, claim id는 전역에서 고유해야 하며, `needs_confirmation`이면서 `confirmedByUser=true`인 조합은 금지된다. `privacyReview`의 status와 items는 서로 일치해야 한다.
- claim: `id`, `text`(공백 불가), `basis`(`direct|inferred|needs_confirmation`), `evidenceQuestionIds`(1개 이상, machine id 정규식), `confirmedByUser`.
- 편집 중인 메모리 상태는 스키마상 무효일 수 있다(빈 문장·빈 제목). `downloadDraft`가 이 경우를 오류 메시지로 처리한다.
- `metadata.schemaVersion`은 현재 `"1.0"`, `teachingSubject`는 구형 호환을 위해 optional이다.
- 지침서의 7개 모듈과 `PROFILE_MODULE_IDS`는 다음과 같이 1:1로 대응한다.

| 지침서 3.4                   | module id                       |
| ---------------------------- | ------------------------------- |
| 1. 기본 프로필 및 역할       | `identity_and_role`             |
| 2. 교육관과 학생관           | `educational_philosophy`        |
| 3. 선호하는 수업 방식        | `preferred_teaching`            |
| 4. 학급·수업 집단 맥락       | `class_context`                 |
| 5. 참여 및 정서 지원         | `participation_and_emotion`     |
| 6. 자료·평가·피드백·의사소통 | `materials_assessment_feedback` |
| 7. 환경·제약 및 AI 활용      | `environment_and_ai`            |

### 1.5 개인정보 검사 상태

| 상태                 | 표현                                                          | 결과·기여                                                  |
| -------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| 검사 대기(편집 직후) | `PENDING_PRIVACY_REVIEW`(`profile-review.tsx:147`, 지역 상수) | 결과 이동 불가                                             |
| 통과                 | `status: "clear"` + 서명 토큰                                 | 결과 이동, 기여 가능                                       |
| 경고                 | `needs_review` + 실제 항목                                    | 경고 확인 체크 후 결과 이동, Markdown 경고 표시, 기여 차단 |
| 확인 안 됨           | `UNVERIFIED_PRIVACY_REVIEW`(`types/profile.ts:312`)           | 경고와 같은 처리                                           |

편집 시 무효화는 `updateDraftProfile`(`profile-review.tsx:480`)과 `resetPrivacyReview`가 맡는다. 검사 도중 수정되면 `draftRevisionRef`로 이전 결과를 버린다.

### 1.6 Markdown 생성과 고정 제약

- `profileToMarkdown`(`src/lib/export/profile-to-markdown.ts`)은 strict parse 뒤 결정적으로 문서를 생성한다(형식 2.0).
- **출력 문자열이 사실상 계약이다.**
  - 기여 API가 `profileToMarkdown(profile)`과 제출된 Markdown의 일치를 검사한다(`src/lib/consent/contribution.ts:99`).
  - 관리자 화면이 저장된 Markdown을 `profileToMarkdown` 또는 `profileToLegacyMarkdownV1` 결과와 대조한다(`src/lib/supabase/admin-submissions.ts:178`).
  - 따라서 Phase 1에서 Markdown 템플릿을 바꾸면 기존 기여 문서의 관리자 열람이 깨진다. **Phase 1은 `profileToMarkdown`을 수정하지 않는다.**

### 1.7 테스트 현황

- Vitest: `storage.test.ts`(원문 미저장, opt-in), `interview-session-provider.test.tsx`, `profile-review.test.tsx`, `result-actions.test.tsx`, `export.test.ts`, 개인정보·API 테스트.
- Playwright `e2e/tcontext.spec.ts`
  - 생성·재작성·일괄 확인·늦은 응답 무시·경고 경로·기여·삭제를 다룬다.
  - 982행에서 Web Storage에 원문이 없는지 확인한다.
  - `public-pages.spec.ts:55`는 홈의 "저장 없이도 완성" 제목을, 173행은 320px 너비에서 넘침이 없는지를 검사한다.
- jsdom에는 IndexedDB가 없다. 테스트용 구현체가 필요하다(`fake-indexeddb` dev 의존성 추가).

### 1.8 지침서 대비 현재 공백

| 지침서 요구                          | 현재                                                                                                                                                            | Phase 1 처리                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 같은 브라우저에서 재접속 후 불러오기 | 없음(메모리만)                                                                                                                                                  | IndexedDB 레코드                       |
| 문장 추가                            | 없음(수정·삭제·이동만)                                                                                                                                          | 교사 작성 문장 추가                    |
| 변경 내용 표시                       | 없음                                                                                                                                                            | 확정본 대비 diff 표시                  |
| 저장 및 저장 취소                    | 없음                                                                                                                                                            | 초안 자동 저장 + 초안 버리기           |
| JSON 백업·복원                       | 없음                                                                                                                                                            | 백업 파일 형식 + 검증 파이프라인       |
| 결과 화면에서 다시 수정              | 링크 없음                                                                                                                                                       | "다시 수정하기"                        |
| **복원 프로파일의 태그 보존**        | `completeReview`가 `suggestedTags × selectedTags`로 `confirmedTags`를 다시 계산함(`profile-review.tsx:645`). 복원 시 두 값이 비어 있으면 **확정 태그가 소실됨** | 초기 선택값을 `confirmedTags`에서 만듦 |
| 저장 금지 안내 문구                  | "초안은 브라우저 저장소에 보관하지 않습니다" 등                                                                                                                 | opt-in 사실을 반영해 문구 수정         |

---

## 2. 변경이 필요한 파일과 핵심 함수

### 2.1 신규 파일

| 파일                                                              | 핵심 export                                                                                                                                                                                                                | 비고                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/lib/storage/profiles/schema.ts`                              | `LOCAL_PROFILE_DB_NAME`, `LOCAL_PROFILE_STORAGE_SCHEMA_VERSION`, `MAX_LOCAL_PROFILES`, `localDraftProfileSchema`, `localProfileRecordSchema`, `profileBackupFileSchema`                                                    | 기존 `teacherContextProfileSchema`를 재사용하고, 완화 스키마는 초안 칸에만 쓴다. |
| `src/lib/storage/profiles/serialize.ts`                           | `toConfirmedSnapshot(profile, now)`, `toDraftSnapshot({ profile, suggestedTags, selectedTagKeys, baseConfirmedAt, now })`, `toEditableSession(record)`                                                                     | `toStoredInterviewProgress`와 같은 allowlist 방식                                |
| `src/lib/storage/profiles/migrate.ts`                             | `migrateLocalProfileRecord(raw)`, `migrateBackupFile(raw)`                                                                                                                                                                 | 버전별 디스패치 표                                                               |
| `src/lib/storage/profiles/database.ts`                            | `openExistingDatabase(factory)`, `openOrCreateDatabase(factory)`, `deleteLocalProfileDatabase(factory)`                                                                                                                    | IDB 저수준 Promise 래퍼(새 런타임 의존성 없음)                                   |
| `src/lib/storage/profiles/repository.ts`                          | `getLocalProfileAvailability`, `enableLocalProfiles`, `listLocalProfiles`, `getLocalProfile`, `createLocalProfile`, `saveConfirmed`, `saveDraft`, `discardDraft`, `deleteLocalProfile`, `disableAndDeleteAllLocalProfiles` | 모든 함수가 `IDBFactory`를 주입받는다(테스트 격리).                              |
| `src/lib/storage/profiles/backup.ts`                              | `createProfileBackup(...)`, `parseProfileBackupFile(file)`, `MAX_BACKUP_FILE_BYTES`                                                                                                                                        | 순수 함수                                                                        |
| `src/lib/profile/changes.ts`                                      | `diffProfiles(baseline, current)`, `createTeacherAuthoredClaim(moduleId, existingIds)`, `TEACHER_AUTHORED_EVIDENCE_ID`                                                                                                     | 저장소와 무관한 편집 로직                                                        |
| `src/lib/profile/tags.ts`                                         | `tagKey`, `suggestedTagsFromConfirmedTags`, `mergeSuggestedTags`, `confirmedTagsFromSelection`                                                                                                                             | 태그 선택 ↔ `confirmedTags` 변환(4.8, WU-4에서 재사용)                           |
| `src/components/local-profiles/local-profiles-provider.tsx`       | `LocalProfilesProvider`, `useLocalProfiles()`                                                                                                                                                                              | availability·목록·동작, BroadcastChannel 구독                                    |
| `src/components/local-profiles/use-local-draft-autosave.ts`       | `useLocalDraftAutosave(...)`                                                                                                                                                                                               | 디바운스, pagehide flush, 충돌 처리                                              |
| `src/components/local-profiles/local-save-panel.tsx`              | `LocalSavePanel`                                                                                                                                                                                                           | /result용 opt-in·저장 상태 패널                                                  |
| `src/components/local-profiles/local-draft-status.tsx`            | `LocalDraftStatus`                                                                                                                                                                                                         | /review 상단·하단 바의 저장 상태, 초안 버리기                                    |
| `src/components/local-profiles/profile-library.tsx`               | `ProfileLibrary`                                                                                                                                                                                                           | /profiles 본문                                                                   |
| `src/components/local-profiles/backup-import.tsx`                 | `BackupImport`                                                                                                                                                                                                             | 파일 선택 → 검증 → 미리보기 → 저장 방식 선택                                     |
| `src/components/local-profiles/saved-profiles-entry.tsx`          | `SavedProfilesEntry`                                                                                                                                                                                                       | 홈 화면의 작은 클라이언트 영역. DB가 있을 때만 표시                              |
| `src/components/local-profiles/local-profile-delete-controls.tsx` | `LocalProfileDeleteControls`                                                                                                                                                                                               | /privacy와 /profiles의 "로컬 저장 끄고 모두 삭제"                                |
| `src/app/profiles/page.tsx`                                       | 서버 컴포넌트 껍데기                                                                                                                                                                                                       | metadata에 `robots: noindex` 권장                                                |
| `src/lib/export/files.ts`                                         | `ExportFile` 타입                                                                                                                                                                                                          | 산출물을 `{path, mediaType, content}` 파일 단위로 표현(11.3)                     |
| `src/lib/export/platform-neutral.test.ts`                         | —                                                                                                                                                                                                                          | 핵심 로직 폴더에 플랫폼 이름이 없음을 검사하는 아키텍처 가드(11.3)               |
| `e2e/local-profiles.spec.ts`                                      | —                                                                                                                                                                                                                          | 지침서 11.2 시나리오                                                             |

> `src/lib/storage/index.ts`에서 `profiles/*`를 다시 내보내지 않는다. `e2e/progress-resume.spec.ts`가 Node 환경에서 이 index를 import하고, IDB 코드를 기존 진행 저장과 분리해 두는 편이 번들과 테스트 모두에 안전하다.

### 2.2 수정 파일

| 파일                                                                                     | 함수·위치                                                                                                                              | 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/types/profile.ts`                                                                   | 추가 export                                                                                                                            | `PENDING_PRIVACY_REVIEW`와 `isPendingPrivacyReview`를 `profile-review.tsx`에서 옮겨 온다(값은 그대로). `teacherContextProfileSchema`의 교차 검증 본문을 `refineTeacherContextProfile`로 꺼내 초안 스키마와 공유한다. **스키마가 받아들이고 거절하는 입력, 오류 메시지와 경로는 바꾸지 않는다.**                                                                                                                                                        |
| `src/components/layout/interview-session-provider.tsx`                                   | 상태·`clearBrowserRecords`·신규 `openProfile`                                                                                          | `localProfileLink` 상태와 setter를 추가한다. `openProfile({profile, suggestedTags, link, mode})`는 profile·tags·markdown을 한 번에 설정하고 token과 receipt를 비운다. `clearBrowserRecords`는 link만 초기화하고 IndexedDB에는 손대지 않는다(주석 갱신).                                                                                                                                                                                                |
| `src/components/interview/interview-flow.tsx`                                            | `generateProfile`(302행 근처)                                                                                                          | `setLocalProfileLink(null)` 한 줄을 추가한다. 새로 생성한 문서가 이전 레코드에 저장되는 일을 막는 방어선이다.                                                                                                                                                                                                                                                                                                                                          |
| `src/components/profile/profile-review.tsx`                                              | `selectedTags` 초기화(383), 모듈 문장 목록, 종합 목록, `completeReview`(705), `continueWithPrivacyWarning`(833), 빈 상태(453), 하단 바 | ① `selectedTags`의 초기값을 `profile.confirmedTags`에서 만든다. ② 모듈마다 "문장 추가", 종합 목록마다 "문장 추가" 버튼을 넣는다. ③ baseline이 있으면 diff 배지를 표시한다. ④ `useLocalDraftAutosave`와 `<LocalDraftStatus>`를 연결한다. ⑤ 두 확정 분기를 `finalizeAndShowResult()`로 모아 link가 있으면 `saveConfirmed`를 호출한다. ⑥ 빈 상태 문구에 "내 프로파일" 링크를 넣는다. ⑦ link가 있으면 "인터뷰로 돌아가기" 대신 "내 프로파일로"를 보여준다. |
| `src/components/export/result-view.tsx`                                                  | 본문                                                                                                                                   | `ResultActions` 아래에 `<LocalSavePanel>`, 헤더에 "다시 수정하기"(/review) 버튼을 추가한다. 빈 상태 문구를 바꾸고 "내 프로파일" 링크를 넣는다. `ContributionPanel`은 위치와 동작을 그대로 둔다.                                                                                                                                                                                                                                                        |
| `src/components/export/result-actions.tsx`                                               | 버튼 그리드                                                                                                                            | "JSON 백업 다운로드"를 추가하고, Markdown(AI 활용용)과 JSON(보관·복원용)의 용도를 한 줄로 안내한다. opt-in과 무관하게 항상 동작해야 한다.                                                                                                                                                                                                                                                                                                              |
| `src/lib/export/download.ts`                                                             | 신규 `downloadTextFile(file: ExportFile)`, `profileBackupFilename`                                                                     | `downloadMarkdown`의 시그니처는 유지하고 내부에서 `downloadTextFile`에 위임한다.                                                                                                                                                                                                                                                                                                                                                                       |
| `src/components/layout/primary-nav.tsx`                                                  | 링크                                                                                                                                   | "내 프로파일"(/profiles)을 추가한다. 320px 넘침 테스트를 통과해야 하므로 모바일에서는 짧은 라벨이나 아이콘을 쓴다.                                                                                                                                                                                                                                                                                                                                     |
| `src/components/layout/app-shell.tsx`                                                    | 푸터 링크                                                                                                                              | "내 프로파일"을 추가하고 푸터 문구에 opt-in 로컬 저장을 반영한다.                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/app/layout.tsx`                                                                     | Provider                                                                                                                               | `InterviewSessionProvider` 안에 `LocalProfilesProvider`를 넣는다.                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/app/page.tsx`                                                                       | 히어로                                                                                                                                 | `<SavedProfilesEntry />`를 삽입한다. 기존 문구와 "저장 없이도 완성" 제목은 유지한다.                                                                                                                                                                                                                                                                                                                                                                   |
| `src/app/privacy/page.tsx`                                                               | 섹션 추가                                                                                                                              | IndexedDB 저장 사실, 저장 항목, 삭제 방법, 공용 기기 주의, 브라우저 정책으로 지워질 수 있다는 점을 안내하고 `<LocalProfileDeleteControls>`를 둔다.                                                                                                                                                                                                                                                                                                     |
| `src/components/privacy/browser-record-controls.tsx`                                     | 문구                                                                                                                                   | 이 버튼이 저장된 프로파일은 지우지 않는다는 점을 명시한다.                                                                                                                                                                                                                                                                                                                                                                                             |
| `README.md`, `docs/privacy-design.md`, `docs/data-dictionary.md`, `docs/product-spec.md` | 문서                                                                                                                                   | "IndexedDB에 기록하지 않는다"는 문장은 원문 답변에 한정해 유지하고, opt-in 프로파일 저장 절을 추가한다.                                                                                                                                                                                                                                                                                                                                                |
| `package.json`                                                                           | devDependencies                                                                                                                        | `fake-indexeddb`(테스트 전용)                                                                                                                                                                                                                                                                                                                                                                                                                          |

### 2.3 변경하지 않는 파일(보존 대상)

- `src/lib/export/profile-to-markdown.ts`, `profile-to-markdown-v1.ts`, `profile-to-text.ts`: 출력이 기여·관리자 검증 계약이다.
- `src/content/profile-document.ts`의 Markdown용 상수(`AI_CONTEXT_PRIORITIES`, `PROFILE_INTERPRETATION_RULES`, `LESSON_DESIGN_SELF_CHECKS` 등): Markdown 출력에 들어가므로 같은 계약에 묶인다. 플랫폼 공통 활용 지침은 이 파일에 섞지 않고 별도 파일로 둔다(11.5).
- `src/lib/ai/*`, 모든 `src/app/api/*` Route Handler: 서버 변경이 없다. 로컬 저장은 서버로 아무것도 보내지 않는다.
- `src/lib/consent/*`, `src/components/consent/*`, `src/lib/supabase/*`: 기여 경로를 그대로 둔다.
- `src/lib/storage/{schema,session,local,restore}.ts`: 진행 위치 저장을 그대로 둔다.
- `src/content/questions/*`, `src/lib/interview/*`: 인터뷰 분기와 질문 수를 그대로 둔다.
- `src/lib/privacy/*`: 탐지 규칙을 그대로 둔다(클라이언트에서 호출만 추가).

---

## 3. IndexedDB 기반 로컬 저장 아키텍처

### 3.1 계층

```text
UI (/result LocalSavePanel, /review LocalDraftStatus, /profiles ProfileLibrary, 홈 SavedProfilesEntry)
   │ useLocalProfiles()  ← LocalProfilesProvider (client, 하이드레이션 이후에만 동작)
   ▼
repository.ts   — 도메인 연산, revision 검사, Zod 검증, 오류 코드화
   ▼
database.ts     — open/upgrade/delete, onversionchange 처리, Promise 래핑
   ▼
IndexedDB (window.indexedDB 또는 테스트용 IDBFactory 주입)
```

- `profile ↔ record` 변환은 `serialize.ts`와 `migrate.ts`만 맡는다. UI는 IDB 객체를 직접 다루지 않는다.
- SSR에서 실행하지 않는다. Provider는 `useSyncExternalStore`로 하이드레이션 여부를 판단하며, 기존 `progressHydrated` 방식과 같다. 하이드레이션 전에는 저장 관련 UI를 렌더링하지 않는다.

### 3.2 DB 스키마

| 항목             | 값                                                                             |
| ---------------- | ------------------------------------------------------------------------------ |
| DB 이름          | `tcontext-local-profiles`                                                      |
| DB 버전          | `1` (object store·index 구조용, 레코드 스키마 버전과 별개)                     |
| store `meta`     | keyPath `key`. `{ key: "settings", enabledAt, storageSchemaVersion: 1 }` 한 건 |
| store `profiles` | keyPath `id`, index `updatedAt`                                                |
| 최대 레코드 수   | `MAX_LOCAL_PROFILES = 10` (초과하면 `limit_reached` 오류, 삭제 안내)           |

### 3.3 opt-in과 DB 생성 규칙

- `openExistingDatabase`
  - `indexedDB.databases()`를 지원하면 목록에 DB가 없을 때 열지 않고 `disabled`를 반환한다.
  - 지원하지 않으면 `open(name)`을 호출하되, `onupgradeneeded`에서 `oldVersion === 0`이면 versionchange 트랜잭션을 `abort()`한다. 그러면 DB가 생성되지 않고 `disabled`로 판단된다.
- `openOrCreateDatabase`는 **교사가 "이 브라우저에 저장"을 누른 경우에만** 호출한다. `enableLocalProfiles()`가 `meta.settings`를 쓴다.
- availability는 다음 넷 중 하나다.
  - `unavailable`: IDB가 없거나 open이 SecurityError·InvalidStateError로 실패한 경우(일부 프라이빗 모드).
  - `disabled`: DB가 없거나 `meta.settings`가 없는 경우.
  - `unsupported_version`: 더 새 버전의 TContext가 만든 DB인 경우(`VersionError`). 데이터를 보존하고 읽기·쓰기를 하지 않는다.
  - `enabled`: 그 밖의 경우.
- 사용 중지는 `disableAndDeleteAllLocalProfiles()`가 `deleteDatabase`로 처리한다. 그래서 설정과 데이터가 함께 사라진다.
- opt-in 플래그는 `localStorage`가 아니라 IDB의 `meta`에 둔다. `clearBrowserRecords`가 `tcontext:` 접두사가 붙은 Web Storage 키를 모두 지우기 때문이다. localStorage에 두면 새 인터뷰를 시작할 때 설정만 지워지고 데이터는 남는 불일치가 생긴다.

### 3.4 레코드 구조

지침서의 개념 구조를 다음 필드로 확정한다.

```ts
type LocalProfileRecord = {
  id: string; // crypto.randomUUID()
  storageSchemaVersion: 1; // 래퍼 스키마 버전
  createdAt: string; // ISO
  updatedAt: string; // 마지막 쓰기 시각
  revision: number; // 쓰기마다 +1, 낙관적 동시성 (지침서 savedRevision)
  origin: "interview" | "import";
  suggestedTags: SuggestedTag[]; // 통제 어휘만, 최대 30개 (태그 선택 UI 복원용)
  confirmed: {
    profile: TeacherContextProfile; // teacherContextProfileSchema(엄격) 통과본
    confirmedAt: string; // 지침서 lastConfirmedAt
  } | null;
  draft: {
    // 지침서 localDraftState
    profile: TeacherContextProfile; // localDraftProfileSchema(완화) 통과본
    baseConfirmedAt: string | null; // 이 초안이 시작된 확정본
    updatedAt: string;
  } | null;
};
// 불변식: confirmed와 draft 중 최소 하나는 non-null.
```

- `localDraftProfileSchema`는 canonical 구조를 그대로 따르되(strict, 모듈 7개 고유, claim id 고유, basis enum, evidence 1개 이상, `needs_confirmation`+확인 금지) **텍스트 공백 허용만** 완화한다. 각 문자열은 20,000자 이하로 제한한다. 추론 타입은 `TeacherContextProfile`에 대입할 수 있어야 한다.
- 레코드를 읽을 때마다 `migrateLocalProfileRecord`와 Zod 검증을 거친다. 실패한 레코드는 `{ id, corrupted: true }` 항목으로 목록에 표시한다. **자동 삭제하거나 덮어쓰지 않는다.**

### 3.5 저장 대상 allowlist와 금지 목록

| 저장함                                             | 저장하지 않음                                                  |
| -------------------------------------------------- | -------------------------------------------------------------- |
| 확정 프로파일 JSON(검토 완료본)                    | `interview` 전체(원문 답변·후속 질문 텍스트)                   |
| 편집 초안 JSON(privacyReview는 PENDING으로 정규화) | `privacyReviewToken`(서버 서명)                                |
| 초안 시점의 태그 선택(`confirmedTags`에 반영)      | `contributionReceipt`(제출 ID·삭제 코드)                       |
| `suggestedTags`(통제 어휘)                         | `privacyWarningAccepted`, `synthesisConfirmed`(매번 새로 확인) |
| 시각·revision·origin                               | 모듈 재작성 지시문(`refineInstructions`)                       |
|                                                    | 브라우저·기기 식별자, IP, 쿠키                                 |

- 직렬화는 `serialize.ts`의 명시적 생성 함수만 쓴다. `{...sessionValue}`처럼 객체를 펼쳐 저장하는 방식은 금지한다.
- 초안의 `privacyReview`는 항상 `PENDING_PRIVACY_REVIEW`로 바꿔 저장한다. 이전 검사 결과의 `items[].text`(지적된 원문 사본)를 초안에 남기지 않기 위해서다.

### 3.6 동시성·오류·용량

- **여러 탭**
  - 쓰기 연산은 하나의 readwrite 트랜잭션 안에서 `get → revision 비교 → put` 순서로 처리한다. 불일치하면 `conflict`를 반환한다.
  - UI는 "다른 탭에서 이 프로파일이 수정되었습니다"를 표시하고 [이 탭 내용으로 저장] / [저장된 최신 내용 불러오기]를 제공한다.
  - 변경 알림은 `BroadcastChannel("tcontext:local-profiles")`로 보낸다. 메시지에는 `{type:"changed"}`만 담고 본문은 넣지 않는다.
  - 열린 연결은 `onversionchange`에서 `close()`한다. 그래야 다른 탭의 `deleteDatabase`가 막히지 않는다.
- **오류 코드**: `unavailable | disabled | unsupported_version | quota_exceeded | conflict | corrupted | not_found | limit_reached | blocked | invalid`
  - 모든 경우에 메모리 상태는 유지한다.
  - Markdown·JSON 다운로드는 저장 실패와 무관하게 동작해야 한다(AGENTS 불변 조건).
- **용량**: put이 `QuotaExceededError`를 던지면 `quota_exceeded`로 바꾸고 "JSON 백업을 먼저 내려받으세요"라고 안내한다. 레코드 하나는 수십 KB 수준이고 상한은 10개다.
- **중단 안전성**: IDB 트랜잭션은 원자적이므로 쓰기가 중단되면 이전 상태가 남는다. 확정본 승격(`confirmed=초안, draft=null`)도 한 트랜잭션으로 처리한다.
- **영속성 한계**: Safari는 오랫동안 방문하지 않은 사이트의 스크립트 저장소를 지울 수 있다. 프라이빗 창은 닫으면 사라진다. 이런 사실을 안내 문구에 일반화해 넣는다. `navigator.storage.persist()`는 브라우저마다 권한 프롬프트를 띄울 수 있으므로 Phase 1에서는 호출하지 않는다.

### 3.7 삭제 정책

| 동작                     | 위치                | 효과                                                                                                           |
| ------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| 초안 버리기(저장 취소)   | /review, /profiles  | `draft=null`. 확정본이 없는 가져온 레코드라면 레코드를 삭제한다(확인 대화상자).                                |
| 프로파일 삭제            | /profiles           | 레코드 1건 삭제(확인 대화상자)                                                                                 |
| 로컬 저장 끄고 모두 삭제 | /profiles, /privacy | `deleteDatabase`. blocked면 "다른 TContext 탭을 닫고 다시 시도"를 안내한다.                                    |
| 이 탭의 모든 기록 삭제   | 기존 버튼들         | 메모리와 Web Storage 진행 메타데이터만 지운다. **저장된 프로파일은 유지**하며, 버튼 근처에 이 사실을 표시한다. |

---

## 4. 편집 초안과 최종 확정본의 상태 관리

### 4.1 정의

- **확정본(`confirmed`)**: 기존 `ProfileReview`의 확정 분기를 통과한 프로파일이다. 확정 분기는 다음 둘 중 하나다.
  - `privacyReview.status === "clear"` → `/result`
  - `needs_review`(또는 UNVERIFIED) + 경고 확인 체크 → `/result`
- 확정본은 항상 strict 스키마를 만족하고 그 시점의 privacyReview를 그대로 가진다.
- **편집 초안(`draft`)**: 확정본을 다시 열어 고친 결과, 또는 가져온 파일이다. 아직 확정 분기를 다시 통과하지 않은 상태다.

### 4.2 상태 전이

```text
          (새 인터뷰 결과, 메모리)
                 │  /result에서 "이 브라우저에 저장"(opt-in)
                 ▼
     ┌──── C: confirmed만 ◀───────────────────────────┐
     │           │ /profiles "수정하기" 후 편집 발생        │ 확정 분기 통과 → saveConfirmed
     │           ▼                                        │ (confirmed=새 프로필, draft=null)
     │     CD: confirmed + draft ─────────────────────────┤
     │           │ "초안 버리기" → C                       │
     │                                                    │
     │  JSON 가져오기(새 항목)                              │
     └──▶ D: draft만(origin=import) ──────────────────────┘
               │ "초안 버리기" → 레코드 삭제
```

| 사건                               | 메모리 세션                                                            | IDB                                    |
| ---------------------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| /profiles "보기"                   | `openProfile(mode:"view")`: profile=확정본, markdown 생성, link 설정   | 없음                                   |
| /profiles "수정하기"               | `openProfile(mode:"edit")`: profile = draft ?? 확정본, baseline=확정본 | 없음(편집 전까지 쓰지 않음)            |
| /review 편집                       | 기존 `updateDraftProfile`                                              | 800ms 디바운스 뒤 `saveDraft`          |
| /review 확정 분기 통과             | 기존 흐름 + `finalizeAndShowResult`                                    | `saveConfirmed`(초안 제거, revision+1) |
| /review "초안 버리기"              | profile=baseline, 지역 상태 초기화                                     | `discardDraft`                         |
| 새 인터뷰 시작                     | `clearBrowserRecords` → link=null                                      | 없음                                   |
| /result "다시 수정하기"(link 있음) | /review로 이동, baseline 유지                                          | 편집 시 초안 저장                      |

### 4.3 세션 연결(`localProfileLink`)

```ts
type LocalProfileLink = {
  recordId: string;
  revision: number; // 마지막으로 읽거나 쓴 revision
  baseline: TeacherContextProfile | null; // 변경 표시 기준(확정본). 가져온 초안이면 null
};
```

- link가 `null`이면 **기존 동작과 완전히 같다**(자동 저장 없음, diff 표시 없음). 기존 테스트와 E2E가 그대로 통과해야 한다는 뜻이다.
- 메모리에 저장하지 않은 문서가 있는데(`profile && !link`) 저장된 프로파일을 열면, 현재 문서가 사라진다는 확인 대화상자를 먼저 띄운다.

### 4.4 자동 저장(`useLocalDraftAutosave`)

- 조건: link가 있고, availability가 `enabled`이며, `ProfileReview`의 `draftRevisionRef`가 증가한 경우(실제 편집이 있었을 때). 이미 있는 `draftRevisionRef`를 재사용한다.
- 저장 내용: `toDraftSnapshot(profile, selectedTags)`. privacy를 PENDING으로 바꾸고, `confirmedTags`에는 현재 선택을 반영한다.
- 타이밍: 마지막 편집 뒤 800ms 디바운스. `pagehide`나 `visibilitychange(hidden)`가 발생하면 즉시 flush한다.
- 상태 표시(`LocalDraftStatus`, `aria-live="polite"`):
  - "이 브라우저에 초안 저장됨 · HH:MM"
  - "저장 중"
  - "저장하지 못함: 사유 + JSON 백업 안내"
  - "다른 탭에서 수정됨"
- AI 모듈 재작성 결과도 `setProfile`을 거쳐 같은 경로로 초안에 저장된다.

### 4.5 변경 표시(`diffProfiles`)

- 입력은 baseline(확정본)과 현재 profile이다.
- 출력:
  - `profileTitleChanged`, `shortSummaryChanged`
  - 모듈별 `{ titleChanged, summaryChanged, added: claimId[], edited: claimId[], removedCount, reordered }`
  - 종합 목록 4종의 `changed`
- UI 표시:
  - 문서 지도에서 모듈에 "변경" 배지를 붙인다.
  - claim에는 "새 문장"이나 "수정됨" 배지를 붙인다.
  - 상단에 "확정본 대비 변경 n곳"을 표시한다.
- claim id 기준으로 비교하므로 순서 이동은 `reordered`로만 표시하고 문장 확인 상태는 건드리지 않는다.

### 4.6 문장 추가 규칙

- `createTeacherAuthoredClaim(moduleId, existingIds)`가 반환하는 값은 다음과 같다.
  - `id`: `${moduleId}:teacher:${8자 무작위}` 형식이며 전역 고유성을 검사한다. machine id 정규식을 만족한다.
  - `text: ""`
  - `basis: "direct"`
  - `evidenceQuestionIds: ["teacher-authored"]`
  - `confirmedByUser: false`
- 근거 처리 원칙:
  - 인터뷰 질문 ID를 지어내지 않는다. 지침서의 "복원할 수 없는 근거 정보는 새로 만들어내지 않는다" 원칙에 따라 고정 표지 하나만 쓴다.
  - 기존 claim의 `basis`와 `evidenceQuestionIds`는 어떤 편집 동작으로도 바꾸지 않는다. 기존 코드의 확인 버튼이 `needs_confirmation → direct`로 바꾸는 동작만 예외이며, 이는 현행 정책이다.
- 새 문장은 빈 상태로 미확인이다. 교사가 쓰고 "내용 확인"을 눌러야 확정할 수 있다. 빈 문장은 기존 `completeReview` 검사와 strict 스키마에 막힌다.
- 종합 목록 4종에도 "문장 추가"(빈 문자열 push)를 넣는다. 기존의 빈 문장 검사가 그대로 적용된다.
- 서버 영향 검토:
  - `/api/profile/refine`과 `/api/privacy/review`는 strict 스키마만 검사하고, evidence ID를 답변과 대조하지 않는다. 대조는 `generate`에서만 한다.
  - 따라서 `teacher-authored` 표지는 서버 검증을 통과한다. 이 동작을 고정하는 테스트를 추가한다.

### 4.7 저장 취소

- "초안 버리기"는 확인 대화상자를 거친 뒤 profile을 baseline으로 되돌리고 `discardDraft`를 호출한다.
- `ProfileReview`의 지역 상태(`refineFeedback`, `privacyReview`, `privacyWarningAccepted`, `synthesisConfirmed`)도 초기화한다. 구현은 `ProfileReview`에 `key={recordId:revision}`을 줘서 다시 마운트하는 방식이 가장 단순하다.

### 4.8 태그 보존 수정(복원의 전제 조건)

- `selectedTags` 초기값은 `profile.confirmedTags`의 `category:tag` 키 집합으로 만든다. 새 AI 초안은 `confirmedTags`가 비어 있으므로 기존 동작과 같다.
- `openProfile`은 `suggestedTags`를 `record.suggestedTags ∪ 확정본 태그 ∪ 초안 태그`로 설정한다(WU-1a). 초안에서 해제한 확정 태그도 선택지에 남아 다시 고를 수 있다.
- 이렇게 해야 복원한 문서를 다시 확정해도 태그가 사라지지 않는다. 회귀 테스트로 고정한다.
- **태그는 선택 집합만 보존한다.** 다시 확정할 때 카테고리 안의 배열 순서는 추천 순서, 그다음 통제 어휘 순서로 정규화될 수 있다. Markdown에는 태그가 나오지 않으므로 출력에는 영향이 없다. 변경 표시(WU-7)와 "변경 없음" 판단에서는 태그를 순서 없는 집합으로 비교한다.

---

## 5. 개인정보 검사와 기존 스키마 호환성

### 5.1 보존하는 기존 정책

| 정책                                                 | Phase 1에서의 처리                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 편집하면 검사 결과·경고 확인·Markdown·토큰 무효화    | 기존 `updateDraftProfile`을 그대로 쓴다. 새 편집 동작(문장 추가, 종합 문장 추가, 초안 불러오기)도 반드시 이 경로를 거친다.                  |
| 검사 도중 수정되면 결과 폐기                         | 그대로 유지한다(`draftRevisionRef`).                                                                                                        |
| 경고 확인 후 로컬 내보내기 허용                      | 그대로 유지한다. 이 경로의 확정본은 `needs_review` 상태로 저장되고, 다시 열면 결과 화면에 경고 배지가 그대로 나온다.                        |
| 기여는 clear + 서명 토큰 + 서버 재검사               | 변경 없음. 토큰은 저장하지 않으므로, 다시 연 문서로 기여하려면 개인정보 검사를 다시 받아야 한다. 기존 422 `reviewAgain` 처리를 그대로 쓴다. |
| 기여는 메타데이터(modelName·promptVersion) 일치 필요 | 변경 없음. 모델이 바뀐 뒤 다시 연 문서는 409가 난다. 알려진 한계로 문서화한다.                                                              |
| 로그에 본문 금지                                     | IDB 코드는 `console.*`로 본문을 출력하지 않는다. 오류 메시지에는 코드만 담는다.                                                             |

### 5.2 로컬 레코드의 privacyReview

- 확정본: 확정 시점의 실제 결과를 그대로 저장한다(clear, needs_review, UNVERIFIED). 결과 화면 배지와 Markdown 머리말(`privacy_review:`)이 이 값과 일치한다.
- 초안: 항상 PENDING이다.
- 가져온 파일: 확정본이든 초안이든 PENDING으로 바꾼다. 파일 속 `clear`는 신뢰하지 않는다.
- 가져올 때와 초안을 열 때는 클라이언트에서 `localAuthoredProfilePrivacyReview`(규칙 기반, 서버 호출 없음)를 실행한다. 경고 개수를 미리보기에 보여주되 차단하지는 않는다. 연수용 "경고, 차단 아님" 정책과 일치한다.

### 5.3 데이터 기여와의 분리

- UI: 로컬 저장 패널의 제목은 "이 브라우저에 보관하기 (서버로 보내지 않음)"로 하고, 기여 패널과 다른 영역에 둔다. 체크박스, 상태, 오류도 공유하지 않는다.
- 코드: `src/components/local-profiles/*`와 `src/lib/storage/profiles/*`는 `src/lib/consent`, `src/lib/supabase`, `fetch`를 import하지 않는다. lint 규칙(`no-restricted-imports`)이나 테스트로 고정한다.
- 로컬 저장을 켜고 끄는 일은 기여 체크박스의 기본값(해제)에 영향을 주지 않는다.

### 5.4 스키마 호환성

| 버전 축                             | 현재값  | 소유자                         | Phase 1 처리                                                                                |
| ----------------------------------- | ------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| `profile.metadata.schemaVersion`    | `"1.0"` | 서버(`PROFILE_SCHEMA_VERSION`) | 변경 없음. 가져오기는 major `1`만 허용하고, 그 밖의 값은 "지원하지 않는 버전"으로 거절한다. |
| `storageSchemaVersion`(레코드 래퍼) | `1`     | 클라이언트                     | 신규                                                                                        |
| `formatVersion`(백업 파일)          | `1`     | 클라이언트                     | 신규                                                                                        |
| IDB DB 버전                         | `1`     | 클라이언트                     | 신규. store·index 구조가 바뀔 때만 올린다.                                                  |
| Markdown `document_format_version`  | `"2.0"` | export                         | 변경 없음                                                                                   |

- canonical 스키마는 수정하지 않는다. 확정본은 `teacherContextProfileSchema`로 검증하므로 서버 API(refine, privacy review, contribution)에 그대로 보낼 수 있다.
- 구형 프로파일(`teachingSubject` 없음)은 현재 스키마로도 유효하다. 테스트 고정 데이터에 포함한다.

### 5.5 마이그레이션

- `migrateLocalProfileRecord(raw)`
  - `storageSchemaVersion`별로 디스패치한다. 현재는 `1 → identity`다.
  - 지원 범위보다 높은 버전이면 `corrupted`가 아니라 `unsupported_version`으로 표시하고 보존한다. 나중에 앱이 업데이트되면 다시 읽을 수 있다.
  - 확정본·초안 프로필의 `schemaVersion`을 엄격 검증 **전에** 먼저 확인한다. 지원하지 않는 버전이면 구조가 달라도 `unsupported_version`으로 보존한다(WU-1a).
  - 업그레이드 함수는 원본의 복사본을 받고, 예외를 던지면 `corrupted`로 처리한다(WU-1a).
- `migrateBackupFile(raw)`
  - wrapper가 없는 순수 `TeacherContextProfile` JSON은 v0으로 보고 `{formatVersion:1, kind:"confirmed", profile}`로 바꾼다.
  - `formatVersion > 1`이면 "더 새로운 TContext에서 만든 파일입니다"라고 안내하고 거절한다.
  - 프로필 `schemaVersion`을 엄격 검증 전에 먼저 확인해, 구조가 바뀐 미래 파일도 "지원하지 않는 버전"으로 안내한다(WU-1a).
- 버전 규칙: 프로필 `schemaVersion`의 major가 바뀌면 `storageSchemaVersion`과 백업 `formatVersion`도 함께 올리고 업그레이드 함수를 추가한다.
- 원칙: 마이그레이션 결과를 반드시 Zod로 검증하고 실패하면 아무것도 쓰지 않는다. 읽기 경로에서는 다시 쓰지 않고, 마이그레이션된 형태는 그 기록의 다음 쓰기 트랜잭션에서 함께 반영한다.

---

## 6. JSON 백업·복원

### 6.1 파일 형식

```json
{
  "format": "tcontext.teacher-profile-backup",
  "formatVersion": 1,
  "exportedAt": "2026-10-25T09:00:00.000Z",
  "kind": "confirmed",
  "recordId": "3f2c…(로컬 저장본에서 내보낸 경우에만)",
  "profile": { "metadata": { "schemaVersion": "1.0", "…": "…" }, "…": "…" },
  "suggestedTags": []
}
```

- `kind`가 `"confirmed"`이면 `profile`은 strict 스키마를, `"draft"`이면 완화 스키마를 따른다.
- 파일 하나에는 프로파일 하나만 담는다. 레코드에 초안이 있으면 /profiles에서 "확정본 백업"과 "편집 중 초안 백업"을 따로 고르게 한다.
- 파일명은 기존 Markdown 규칙과 짝을 맞춰 `tcontext-teacher-profile-{schoolLevel}-{yyyymmdd}.json`으로 한다(9장 결정 1).
- 내용 서술은 결정적으로 생성하고 `JSON.stringify(…, null, 2)`, UTF-8, BOM 없이 쓴다.
- 백업 형식에는 플랫폼별 필드(예: 어느 AI에 등록했는지)를 넣지 않는다. 백업은 플랫폼 중립 원본이며, 플랫폼 산출물은 언제든 이 원본에서 다시 만든다(11장).

### 6.2 내보내기

- /result: 현재 문서를 `kind:"confirmed"`로 내보낸다. **로컬 저장 opt-in과 무관하게 항상 가능**하며 DB를 열지 않는다.
- /profiles: 레코드의 확정본이나 초안을 내보낸다.
- 안내 문구:
  - Markdown은 다른 AI 서비스에 넣는 AI 활용용 파일이다. 화면 문구에 서비스 이름을 예로 들 수는 있지만, 문구는 컴포넌트가 아니라 콘텐츠 상수에 둔다.
  - JSON은 TContext에서 다시 열고 고치기 위한 보관·복원용 파일이다. 다른 AI에 넣을 필요는 없다.
  - 두 파일 모두 개인 기기에 안전하게 보관해야 한다.

### 6.3 가져오기 검증 파이프라인

1. 파일 크기가 `MAX_BACKUP_FILE_BYTES = 1 MiB` 이하인지 확인한다. 확장자는 `.json`이어야 한다. MIME은 브라우저마다 다르므로 참고만 한다.
2. UTF-8로 디코드하고 BOM을 제거한다. `JSON.parse`가 실패하면 "JSON 형식이 아닙니다"를 안내한다.
3. `migrateBackupFile`로 형식을 판별한다(wrapper v1, 순수 프로파일 v0, 미래 버전 거절).
4. Zod strict로 검증한다. 알 수 없는 키가 있으면 거절하며, `__proto__` 같은 키 주입도 이 단계에서 막힌다. `metadata.schemaVersion` major도 확인한다.
5. 정규화한다. `privacyReview`는 PENDING으로 바꾸고, `suggestedTags`는 통제 어휘만 남긴다. claim의 `confirmedByUser`와 `basis`는 그대로 둔다(교사 본인의 파일).
6. 규칙 기반 개인정보 검사로 경고 개수를 계산한다.
7. 미리보기를 보여준다: 제목, 학교급·역할, 모듈별 문장 수, 미확인 문장 수, 개인정보 경고 수, 원본 종류(확정본/초안).
8. 사용자가 저장 방식을 고른다(6.4).

- 1~5단계의 오류는 모두 "무엇이 잘못되었는지 + 복구 방법(다른 파일 선택, 최신 TContext 사용)"으로 안내한다.
- **어떤 단계에서 실패해도 IDB에 쓰지 않는다.**

### 6.4 덮어쓰기 규칙

| 상황                                           | 선택지                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 로컬 저장 꺼짐                                 | "저장하지 않고 열기": 메모리 세션에서만 /review로 연다. "로컬 저장을 켜고 새 항목으로 저장"은 opt-in 안내를 거친다. |
| 켜짐, `recordId`가 없거나 일치하는 레코드 없음 | "새 항목으로 저장"(`origin:"import"`, `confirmed:null`, `draft:파일 내용`), "저장하지 않고 열기"                    |
| 켜짐, `recordId`가 기존 레코드와 일치          | "기존 프로파일의 편집 초안으로 불러오기"(**확정본은 유지**, 기존 초안이 있으면 대체 확인), "새 항목으로 저장", 취소 |
| 레코드 상한 도달                               | 새 항목 저장을 비활성화하고 삭제를 안내한다. "저장하지 않고 열기"는 가능하다.                                       |

- 가져오기는 어떤 경우에도 기존 `confirmed`를 바꾸지 않는다. 확정본은 교사가 /review에서 다시 확정할 때만 바뀐다. 지침서의 "손상된 데이터가 들어와도 기존 프로파일을 덮어쓰지 않는다"를 이렇게 구조적으로 보장한다.

---

## 7. Codex 구현 작업 단위와 완료 조건

실행 방식(2026-10-25 변경): WU-1a부터는 Codex가 [`docs/codex/runbook.md`](codex/runbook.md)에 따라 여러 WU를 이어서 구현한다. Claude는 WU-9 뒤 중간 점검과 WU-12 뒤 최종 리뷰를 맡는다. 자동 관문, 멈춤 조건, 진행 기록 형식, WU별 구체 지침은 runbook이 정한다.

공통 규칙

- 작업 단위 하나가 커밋 하나다. 각 커밋에서 `pnpm lint && pnpm typecheck && pnpm test`가 통과해야 한다.
- WU-4부터는 `pnpm build`도 통과해야 한다. WU-9와 WU-12에서는 `pnpm test:e2e` 전체를 통과해야 한다.
- 순서대로 진행한다. Codex와 Claude가 같은 파일을 동시에 고치지 않는다.
- 각 단위에서 언급하지 않은 파일은 수정하지 않는다. 스타일·포맷 일괄 변경은 금지한다.

### WU-1. 스키마·직렬화·마이그레이션(순수 로직)

- 범위
  - `src/types/profile.ts`에 `PENDING_PRIVACY_REVIEW`와 `isPendingPrivacyReview`를 추가하고, `profile-review.tsx`의 지역 상수를 이것으로 바꾼다(값은 동일).
  - `src/types/profile.ts`의 `teacherContextProfileSchema` 교차 검증 본문을 `refineTeacherContextProfile`로 꺼내 초안 스키마와 공유한다(동작·메시지·경로 동일).
  - `src/lib/storage/profiles/{schema,serialize,migrate}.ts`를 만든다.
  - `src/lib/profile/changes.ts`의 `createTeacherAuthoredClaim`과 `TEACHER_AUTHORED_EVIDENCE_ID`, `src/lib/profile/tags.ts`의 태그 선택 변환 함수를 만든다.
  - `src/lib/export/platform-neutral.test.ts` 아키텍처 가드를 추가한다(11.3).
  - 상세 지시: [`docs/codex/wu-01-schema-serialize-migrate.md`](codex/wu-01-schema-serialize-migrate.md)
- 완료 조건
  - [ ] 가드 테스트가 `src/types`, `src/lib/export`, `src/lib/storage`, `src/lib/profile`에서 플랫폼 이름(ChatGPT, Gemini, Claude, Gem, GPTs)을 찾지 못한다. 일부러 이름을 넣으면 실패하는 것도 확인한다.
  - [ ] 확정본 스키마가 기존 `teacherContextProfileSchema`와 같은 입력을 받아들이고 거절한다(가상 예시 4건 `FICTIONAL_PROFILES`, 구형 프로필, 경고·확인 안 됨 상태 프로필).
  - [ ] 완화 초안 스키마는 빈 텍스트를 허용하지만 구조 위반(모듈 누락, id 중복, 알 수 없는 키, `needs_confirmation`+확인)은 거절한다.
  - [ ] `toDraftSnapshot`의 결과 JSON에 원문 답변·토큰·영수증 문자열이 없다. 세션 객체 전체를 넣어도 allowlist만 나온다.
  - [ ] 마이그레이션: v1 그대로 통과, 순수 프로파일(v0) 변환, 미래 버전 거절, 실패 시 예외 없이 결과 객체 반환.
  - [ ] 기존 테스트 전체 통과, UI 변화 없음.

### WU-1a. 직렬화·버전 판별 보강(WU-1 리뷰 후속)

- 범위: `serialize.ts`, `migrate.ts`와 WU-1 테스트 파일 보강. 상세 지시는 [`docs/codex/wu-01a-serialize-migrate-hardening.md`](codex/wu-01a-serialize-migrate-hardening.md)에 있다.
  - 담당 교과가 없을 때 `teachingSubject` 키를 생략한다.
  - 다시 열 때 확정본과 초안의 태그를 모두 선택지에 합친다.
  - 다른 realm의 일반 객체도 받아들이도록 객체 판별 방식을 바꾼다.
  - 미래 프로필 스키마를 엄격 검증 전에 먼저 판별한다.
  - 업그레이드 함수의 예외와 원본 변경을 막는다.
- 완료 조건
  - [ ] 지시문 4절의 테스트가 모두 있고 lint·typecheck·test가 통과한다.
  - [ ] 공개 함수의 이름과 결과 타입이 그대로다. `migrateLocalProfileRecord`에 테스트용 선택 인자를 추가하는 것만 허용한다.

### WU-2. IndexedDB 저장 계층

- 범위
  - `src/lib/storage/profiles/{database,repository}.ts`를 만든다.
  - devDependency `fake-indexeddb`를 정확한 버전 `6.2.5`로 추가한다. 테스트마다 `new IDBFactory()`를 주입해 격리한다.
  - 상세 지시: [`docs/codex/wu-02-indexeddb-repository.md`](codex/wu-02-indexeddb-repository.md)
- 완료 조건
  - [ ] `getLocalProfileAvailability`와 `listLocalProfiles`를 호출해도 DB가 생성되지 않는다(`databases()`에 없음). `databases()`가 없는 경로도 테스트한다.
  - [ ] 더 새 버전의 DB나 기록은 `unsupported_version`으로 보존되고, 삭제 외의 쓰기가 거절된다.
  - [ ] `enableLocalProfiles` → `createLocalProfile` → `saveDraft` → `saveConfirmed` → `discardDraft` → `deleteLocalProfile`이 왕복한다. revision은 쓰기마다 1씩 증가한다.
  - [ ] revision이 다르면 `conflict`를 반환하고 저장된 값은 변하지 않는다.
  - [ ] 손상 레코드(잘못된 JSON 구조)는 목록에 `corrupted`로 나오고, 어떤 쓰기 연산도 덮어쓰지 않는다.
  - [ ] `QuotaExceededError`는 `quota_exceeded`로 바뀌고 기존 값은 유지된다.
  - [ ] `disableAndDeleteAllLocalProfiles` 후 DB가 존재하지 않는다. 열린 연결이 있으면 `onversionchange`로 닫힌 뒤 삭제된다.
  - [ ] 레코드 상한(10)을 넘으면 `limit_reached`를 반환한다.

### WU-3. JSON 백업 생성·파싱과 결과 화면 다운로드

- 범위
  - `src/lib/storage/profiles/backup.ts`를 만든다. 백업 생성 함수는 `ExportFile`을 반환한다.
  - `src/lib/export/files.ts`에 `ExportFile` 타입을 만든다.
  - `download.ts`에 `downloadTextFile(file: ExportFile)`과 `profileBackupFilename`을 추가한다.
  - `result-actions.tsx`에 "JSON 백업 다운로드" 버튼과 용도 안내를 추가한다.
- 완료 조건
  - [ ] export → parse 왕복 결과가 원본과 같다(`structuredClone` 비교).
  - [ ] 1 MiB 초과, 잘못된 JSON, 다른 `format`, 미래 버전, strict 위반, 지원하지 않는 schemaVersion을 각각 고유한 사용자 메시지로 거절한다.
  - [ ] 파일 속 `privacyReview: clear`는 PENDING으로 바뀐다.
  - [ ] /result의 JSON 다운로드가 opt-in 없이 동작하고 IDB를 열지 않는다(RTL에서 `indexedDB.open` spy 0회).
  - [ ] 기존 Markdown 파일명과 내용은 바뀌지 않는다(기존 export 테스트와 E2E 정규식 통과).
  - [ ] Markdown 다운로드와 JSON 다운로드가 같은 `downloadTextFile` 경로를 쓴다. `downloadMarkdown`의 기존 호출부는 수정하지 않는다.

### WU-4. 세션 연결과 태그 보존

- 범위
  - `interview-session-provider.tsx`에 `localProfileLink`와 `openProfile`을 추가하고, `clearBrowserRecords`에서 link를 초기화한다.
  - `interview-flow.tsx`에서 생성 직후 link를 초기화한다.
  - `profile-review.tsx`에서 `selectedTags`를 `confirmedTags`로 초기화한다.
  - `LocalProfilesProvider`를 만들고 `layout.tsx`에 연결한다.
- 완료 조건
  - [ ] `confirmedTags`가 있는 프로필을 `openProfile(edit)`로 열고 다시 확정하면 `confirmedTags`가 유지된다(RTL 회귀 테스트).
  - [ ] `clearBrowserRecords`는 IDB 레코드를 지우지 않고 link는 `null`로 만든다.
  - [ ] 새 인터뷰에서 생성한 프로필에는 link가 없다.
  - [ ] `openProfile`은 token과 receipt를 비운다. view 모드는 `profileToMarkdown` 결과를 markdown으로 설정한다.
  - [ ] link가 없을 때 `ProfileReview`와 `ResultView`의 기존 RTL·E2E가 수정 없이 통과한다.

### WU-5. 결과 화면 로컬 저장(opt-in)과 메뉴

- 범위
  - `local-save-panel.tsx`를 만든다.
  - `result-view.tsx`에 패널과 "다시 수정하기"를 추가한다.
  - 빈 상태 문구를 바꾼다. `primary-nav.tsx`·`app-shell.tsx`의 "내 프로파일" 링크는 `/profiles`가 생기는 WU-6에서 추가한다(runbook에서 조정).
- 완료 조건
  - [ ] 동의 체크박스의 기본값은 해제다. 체크 전에는 저장 버튼이 비활성화되고, 저장 전까지 DB가 생성되지 않는다.
  - [ ] 패널에 4가지 고지가 보인다: 이 브라우저에만 저장, 서버 전송 없음, 공용 기기 주의, 브라우저 데이터 삭제 시 소실·JSON 백업 권장.
  - [ ] 저장에 성공하면 link가 설정되고 "저장됨 · 시각"이 표시된다. 실패(quota, unavailable)하면 오류와 대안이 표시되고 Markdown·JSON 다운로드는 그대로 동작한다.
  - [ ] 기여 패널의 동작과 기본값은 변하지 않는다(기존 `contribution-panel.test.tsx` 통과).
  - [ ] `public-pages.spec.ts`의 320px 넘침 테스트와 "저장 없이도 완성" 제목 테스트가 통과한다.

### WU-6. 내 프로파일 화면(/profiles)과 가져오기

- 범위
  - `app/profiles/page.tsx`, `profile-library.tsx`, `backup-import.tsx`, `saved-profiles-entry.tsx`, `local-profile-delete-controls.tsx`를 만든다.
  - 홈 화면에 `SavedProfilesEntry`를 삽입한다.
- 완료 조건
  - [ ] 꺼짐 상태에서는 opt-in 안내와 "JSON 불러와 저장하지 않고 열기"만 보인다. 이 상태에서 화면에 들어와도 DB가 생성되지 않는다.
  - [ ] 목록에 제목, 학교급·역할, 확정 시각, 마지막 수정 시각, 배지(편집 중 초안, 개인정보 경고 문서, 가져온 문서·확정 전)가 표시된다.
  - [ ] 보기, 수정하기, 백업(확정본/초안), 초안 버리기, 삭제, 모두 삭제가 동작한다. 파괴적 동작은 모두 AlertDialog로 확인한다.
  - [ ] 메모리에 저장하지 않은 문서가 있을 때 다른 프로파일을 열면 경고한다.
  - [ ] 가져오기는 6.3 파이프라인과 6.4 규칙을 따른다. 실패하면 IDB에 쓰지 않고 기존 확정본은 바뀌지 않는다.
  - [ ] 손상 항목에는 삭제만 제공하고 내용은 렌더링하지 않는다.
  - [ ] 홈 화면은 DB가 없으면 아무것도 렌더링하지 않고, 있으면 "저장한 프로파일 n개 · 열기"를 표시한다.
  - [ ] 키보드만으로 모든 동작이 가능하고, 모바일(Pixel 7)과 320px에서 넘침이 없다.

### WU-7. 검토 화면 편집 강화와 자동 저장

- 범위
  - `use-local-draft-autosave.ts`와 `local-draft-status.tsx`를 만든다.
  - `profile-review.tsx`에 문장 추가, 종합 문장 추가, diff 배지, `finalizeAndShowResult`, 초안 버리기, 충돌 UI를 넣는다.
  - `changes.ts`에 `diffProfiles`를 추가한다.
- 완료 조건
  - [ ] link가 있을 때 편집하면 800ms 안팎에 `saveDraft`가 한 번 호출된다(연속 입력은 한 번으로 합쳐짐). link가 없으면 0회다.
  - [ ] 초안의 privacyReview는 PENDING이고, `refineInstructions`와 경고 확인 상태는 저장되지 않는다.
  - [ ] 문장을 추가하면 basis `direct`, evidence `teacher-authored`, 미확인 상태가 된다. 빈 채로 확정하려 하면 기존 오류가 나온다. 기존 claim의 basis와 evidence는 어떤 동작 뒤에도 그대로다(스냅샷 비교).
  - [ ] 수정한 문장만 미확인으로 바뀌고, 다른 문장의 확인 상태는 유지된다.
  - [ ] diff 배지가 추가·수정·삭제·순서 변경을 정확히 표시한다(순수 함수 단위 테스트 포함).
  - [ ] clear 분기와 경고 확인 분기 모두에서 `saveConfirmed`가 호출되고 초안이 제거된다. 저장에 실패해도 /result로 이동한다.
  - [ ] 초안을 버리면 baseline으로 복원되고 지역 상태가 초기화된다.
  - [ ] 다른 탭에서 수정되면 충돌 안내가 나오고, 선택에 따라 덮어쓰거나 다시 불러온다.
  - [ ] 기존 `profile-review.test.tsx`와 E2E의 늦은 응답 무시 테스트(재작성, 개인정보)가 통과한다.

### WU-8. 개인정보 안내·문서

- 범위
  - `/privacy` 섹션과 삭제 컨트롤, `browser-record-controls.tsx` 문구를 고친다.
  - README, `docs/privacy-design.md`, `docs/data-dictionary.md`(로컬 저장 데이터 사전 절), `docs/product-spec.md`를 고친다.
- 완료 조건
  - [ ] "원문 답변은 IndexedDB에 저장하지 않는다"는 문장은 유지한다. "프로필을 브라우저에 저장하지 않는다"는 식의 사실과 달라진 문장은 모두 "교사가 켠 경우에만"으로 고친다(`grep`으로 확인).
  - [ ] 저장 항목, 저장하지 않는 항목, 삭제 방법, 공용 기기 주의, 소실 가능성, 기여와의 차이가 /privacy에 모두 있다.
  - [ ] AGENTS.md 불변 조건과 충돌하는 문구가 없다.

### WU-9. E2E와 전체 회귀

- 범위: `e2e/local-profiles.spec.ts`를 작성하고 전체 스위트를 실행한다.
- 완료 조건
  - [ ] 8.4의 시나리오를 모두 구현하고 chromium·mobile 두 프로젝트에서 통과한다.
  - [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`가 모두 통과한다.
  - [ ] **Phase 1 최종 완료 기준**: 브라우저 컨텍스트를 닫았다가 새로 열어도 저장에 동의한 프로파일을 /profiles에서 열어 수정하고 다시 확정할 수 있다.

---

## 8. 회귀 위험과 테스트 계획

### 8.1 위험 목록

| #   | 위험                                                            | 영향                                            | 대응                                                         | 검증                             |
| --- | --------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| R1  | `clearBrowserRecords`(새 인터뷰 시작 시 호출)를 IDB 삭제로 확장 | 새 인터뷰를 시작하면 저장본이 모두 소실됨       | IDB 삭제를 별도 동작으로 분리                                | Provider RTL, E2E                |
| R2  | link를 초기화하지 않아 새 문서가 이전 레코드에 저장됨           | 기존 확정본 덮어쓰기                            | `clearBrowserRecords`와 `generateProfile`에서 이중 초기화    | RTL, E2E                         |
| R3  | 복원 문서를 재확정할 때 `confirmedTags` 소실                    | 확정 태그 데이터 손실                           | 4.8 수정                                                     | RTL 회귀 테스트                  |
| R4  | Markdown 템플릿 변경                                            | 기존 기여 문서의 관리자 열람·기여 검증 실패     | Phase 1에서 `profile-to-markdown*` 수정 금지                 | 기존 export·admin 테스트         |
| R5  | 토큰·영수증·경고 확인·지적된 원문이 IDB에 저장                  | 서명 우회 가능성, 개인정보 확대                 | allowlist 직렬화, 초안 privacy PENDING                       | 직렬화 테스트, E2E IDB 덤프 검사 |
| R6  | 미동의 사용자 브라우저에 DB 생성                                | "저장 안 함" 약속 위반                          | `openExisting`, 업그레이드 중단                              | 단위 테스트, E2E #10             |
| R7  | 가져온 파일의 `clear`를 신뢰                                    | 검사 완료 오표시                                | PENDING 강제                                                 | 단위 테스트                      |
| R8  | 자동 저장 때문에 1,700줄 컴포넌트가 키 입력마다 IDB에 씀        | 입력 지연                                       | 디바운스, 저장 로직을 훅으로 분리                            | RTL(호출 횟수)                   |
| R9  | 하이드레이션 불일치(IDB 의존 UI)                                | React 경고, 깜빡임                              | 하이드레이션 이후에만 렌더링                                 | build, E2E 콘솔 오류 검사        |
| R10 | 여러 탭 동시 수정                                               | 마지막 쓰기만 남는 유실                         | revision 검사, 충돌 UI                                       | 단위 테스트, E2E 두 페이지       |
| R11 | `deleteDatabase` blocked                                        | 삭제 실패                                       | `onversionchange`에서 close, blocked 안내                    | 단위 테스트                      |
| R12 | 기존 안내 문구가 사실과 달라짐                                  | 개인정보 고지 위반                              | WU-8 문구 전수 점검                                          | grep 체크리스트                  |
| R13 | 내비게이션 링크 추가로 320px 넘침                               | 기존 E2E 실패                                   | 모바일에서는 짧은 라벨이나 아이콘                            | `public-pages.spec.ts`           |
| R14 | 저장 실패가 다운로드를 막음                                     | AGENTS 불변 조건 위반                           | 저장과 내보내기를 독립 처리                                  | RTL(IDB 오류 주입 후 다운로드)   |
| R15 | 다시 연 문서로 기여 시 토큰 없음(422) 또는 모델 불일치(409)     | 사용자 혼란                                     | 기존 오류 처리 재사용, 안내 문서화                           | 기존 기여 테스트                 |
| R16 | `teacher-authored` evidence가 서버 검증과 충돌                  | 재작성·검사 400                                 | refine·privacy 경로는 strict 스키마만 검사함을 확인          | API 테스트 추가                  |
| R17 | 플랫폼 기능명이 핵심 로직이나 저장 스키마에 스며듦              | Gem→Skill 같은 전환 때 스키마·마이그레이션 필요 | 플랫폼 정보는 콘텐츠 파일에만, 저장에는 불투명한 문자열 id만 | 아키텍처 가드 테스트             |
| R18 | 플랫폼 안내가 낡음(전환 일정·명칭 변경)                         | 잘못된 안내로 교사 혼란                         | 방법마다 `verifiedAt`·공식 링크 표시, 콘텐츠 파일만 수정     | 콘텐츠 스키마 테스트             |
| R19 | 공통 활용 지침을 Markdown 상수와 섞어 수정                      | R4와 같은 Markdown 계약 파손                    | 공통 활용 지침은 별도 파일(`usage-instructions.ts`)          | 기존 export·admin 테스트         |

### 8.2 Vitest(순수 로직)

- `src/lib/storage/profiles/schema.test.ts`: 확정본·초안 스키마의 수용과 거절, 구형 프로필(`teachingSubject` 없음), 가상 예시 4건(`FICTIONAL_PROFILES`).
- `serialize.test.ts`: allowlist, privacy PENDING 정규화, 금지 문자열 부재.
- `migrate.test.ts`: v0, v1, 미래 버전, 손상 입력.
- `repository.test.ts`
  - 생성하지 않는 열기, CRUD, revision 충돌, 손상 레코드 보존, 용량 초과, 상한, 전체 삭제, blocked
  - 저장 중단 시뮬레이션: 트랜잭션 abort 후 이전 값 유지
- `backup.test.ts`: 왕복, 크기·형식·버전·strict 오류 메시지, `clear` 무력화, recordId 일치 판별.
- `src/lib/profile/changes.test.ts`: diff 전 경우, 교사 작성 문장 id 고유성과 정규식.
- `src/app/api/api.test.ts`에 추가: `teacher-authored` evidence가 있는 프로필이 privacy review와 refine 요청 검증을 통과한다.

### 8.3 React Testing Library

- `interview-session-provider.test.tsx`: `openProfile` 두 모드, `clearBrowserRecords`의 link 초기화와 IDB 유지.
- `profile-review.test.tsx`
  - 태그 보존(R3)
  - 문장 추가와 빈 문장 차단
  - 수정한 문장만 미확인으로 전환
  - diff 배지
  - 자동 저장 호출 횟수(fake timers)
  - link가 없을 때 저장 0회
  - 두 확정 분기의 `saveConfirmed`
  - 초안 버리기
  - 충돌 UI
  - 저장 실패 시 결과로 이동
- `local-save-panel.test.tsx`: 기본 해제, 고지 문구, 체크 전 DB 미생성, 성공·실패 상태, 기여 패널 독립.
- `profile-library.test.tsx`, `backup-import.test.tsx`: 목록과 배지, 파괴적 동작 확인, 가져오기 미리보기·선택지·실패 시 무쓰기, 손상 항목.
- `result-actions.test.tsx`: JSON 다운로드가 opt-in 없이 동작하고 IDB를 열지 않음.

### 8.4 Playwright E2E(`e2e/local-profiles.spec.ts`)

- 기존 `tcontext.spec.ts`의 API 모킹 헬퍼(`page.route`)를 재사용한다. 공용 헬퍼를 꺼낼 필요가 있으면 `e2e/helpers.ts`로 옮기되, 기존 테스트 본문은 바꾸지 않는다.
- "브라우저 종료 후 재접속"은 `context.storageState({ indexedDB: true })`로 상태를 저장하고 새 `browser.newContext({ storageState })`로 다시 여는 방식으로 재현한다(Playwright ≥ 1.51, 현재 ^1.62).

| 지침서 11.2 | 시나리오                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| #1, #12     | 기존 `tcontext.spec.ts` 전체가 회귀 없이 통과한다(별도 수정 없음).                                                         |
| #2          | 인터뷰 → 검토 → /result에서 동의 체크 → 저장 → "저장됨" 표시                                                               |
| #3, #4      | 새 컨텍스트로 재접속 → 홈 화면 "저장한 프로파일 1개" → /profiles → 보기 → 제목 일치                                        |
| #5          | 수정하기 → 특정 모듈의 문장 수정, 문장 추가 → "수정됨/새 문장" 배지 → 새로고침 후에도 초안 유지                            |
| #6          | 수정한 문장이 미확인으로 전환 → 확인 → 개인정보 검사(모킹: needs_review → 경고 확인 경로, clear 경로 각각)                 |
| #7          | 결과에서 Markdown 다운로드 → 수정 내용 포함, 원문 답변 미포함, 파일명 정규식 기존과 동일                                   |
| #8          | JSON 백업 다운로드 → 전체 삭제 → 다시 켜기 → 가져오기 → 초안으로 열림 → 재확정 → 내용 일치                                 |
| #9          | 프로파일 삭제, 로컬 저장 끄고 모두 삭제 → `indexedDB.databases()`에 DB 없음                                                |
| #10         | 저장에 동의하지 않은 전체 흐름 뒤 `indexedDB.databases()`에 `tcontext-local-profiles` 없음, Web Storage에 프로필 본문 없음 |
| #11         | AI 플랫폼 가이드는 Phase 2 범위(WU-12, 11.8)                                                                               |
| 추가        | 같은 컨텍스트의 두 페이지에서 동시 수정 → 충돌 안내                                                                        |
| 추가        | 새 인터뷰 시작(`clearBrowserRecords`) 뒤에도 저장본 유지, 새 문서가 기존 레코드에 저장되지 않음(R1, R2)                    |
| 추가        | 저장된 문서 열람 중 "이 탭의 모든 기록 삭제" → 저장본 유지                                                                 |

### 8.5 데이터 안정성(지침서 11.3) 대응

| 상황                                | 테스트 위치                         | 기대 동작                                            |
| ----------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| 잘못된 JSON                         | backup 단위, BackupImport RTL       | 안내 표시, 쓰기 없음                                 |
| 구형 스키마 JSON                    | migrate·backup 단위                 | v0 변환 또는 명확한 거절                             |
| 손상된 로컬 데이터                  | repository 단위, ProfileLibrary RTL | 손상 항목 표시, 다른 레코드 정상, 덮어쓰기 없음      |
| 저장 공간 부족                      | repository 단위(put 오류 주입)      | `quota_exceeded`, 메모리 유지, 백업 안내             |
| 저장 중단                           | repository 단위(트랜잭션 abort)     | 이전 값 유지                                         |
| 여러 탭 동시 수정                   | repository 단위, E2E                | `conflict`와 선택지                                  |
| 새로고침                            | E2E #5                              | 초안 유지(link는 /profiles에서 다시 열어 복원)       |
| 다운로드 실패                       | RTL(`createObjectURL` 예외 주입)    | 오류 표시, 상태 유지                                 |
| 빈 프로파일·일부 모듈 누락          | schema·backup 단위                  | 모듈 누락은 거절, 빈 claims 모듈은 허용              |
| 개인정보 검사 결과가 남은 문서 편집 | ProfileReview RTL                   | 편집 즉시 PENDING, 토큰·Markdown 무효화, 재검사 필요 |

---

## 9. 확정된 결정 사항(2026-10-25)

1. **파일명**: 지침서는 `teacher-context.md` / `.json`을 예로 든다. **확정: 기존 `tcontext-teacher-profile-{level}-{date}.md`를 유지하고 JSON도 같은 패턴을 쓴다.** 기존 사용자의 파일 관리와 E2E 정규식을 보존할 수 있다. 바꾸고 싶다면 Phase 2(가이드 화면)에서 한 번에 바꾸는 편이 낫다.
2. **프로파일 개수**: **확정: 여러 개(상한 10)를 저장할 수 있는 구조.** 학교급·역할이 바뀐 교사를 고려했다. UI는 목록이지만 대부분 1건일 것이다.
3. **첫 저장 시점**: **확정: 확정 후 /result에서만.** 검토 전 AI 초안은 저장하지 않는다(지침서 "교사가 검토한 프로파일 JSON만 저장"). 이후 편집 초안은 자동 저장한다.
4. **종합 확인 체크(`synthesisConfirmed`)**: **확정: 저장하지 않음.** 다시 확정할 때마다 교사가 다시 확인한다.
5. **Markdown 가져오기**: 지침서 3.5의 "후속 지원" 항목으로, Phase 1 범위에서 제외한다. 역변환 정확도 설계가 따로 필요하다.
6. **Gemini 방법 구성(2026-10-25 재확정)**: **확정: `gemini-skill`=`recommended`, `gemini-gem`=`transitioning`, `gemini-chat-attachment`=`available`(fallback).**
   - 처음 확정한 값("Gem 권장, skill은 출시 예정")은 Phase 1 중간 점검에서 공식 일정을 확인한 뒤 바꿨다. 개인 계정의 Gem은 2026-11-17부터 읽기 전용이고 2026-12-17에 제거된다.
   - Workspace 교육용·업무용 계정은 Gem을 더 오래 쓸 수 있으므로 `transitioning` 상태로 남긴다.
   - 근거는 `docs/codex/platform-facts.md` 2절이다.
7. **가이드 경로**: **확정: `/ai-guide`(플랫폼 선택)와 `/ai-guide/[platform]`.** 플랫폼 목록은 콘텐츠 색인에서 `generateStaticParams`로 만든다. 결과 화면과 내 프로파일 화면에서 "AI에서 활용하기"로 들어간다.
8. **Agent Skill zip 패키지를 Phase 2로 앞당김(2026-10-25)**: **확정: WU-10a로 구현한다.**
   - Gemini skill은 업로드로만 파일을 담을 수 있다. 그래서 `teacher-context/SKILL.md`(고정 지침)와 `teacher-context/references/teacher-profile.md`(교사 프로필)를 담은 zip을 만든다. 11.7의 Phase 4 구조를 그대로 앞당긴 것이다.
   - 처음 승인한 단일 파일 `SKILL.md`는 표본 시험에서 프로필이 반영되지 않는 느낌이 있었다. 이후 사용자가 지침과 프로필을 분리하는 zip 구조로 결정했다.
   - zip은 새 의존성 없이 무압축으로 직접 만든다. 설치 자동화와 다른 플랫폼용 변형은 계속 범위 밖이다.
   - Gemini가 참고 파일을 실제로 반영하는지는 사용자 실측(`docs/codex/platform-facts.md` 6절)으로 확인한다. 확인되지 않으면 최종 리뷰에서 대화 첨부(A)를 기본 경로로 둔다.
   - A(대화에 붙이기)는 모든 플랫폼의 대안 경로로 유지한다. 공통 지침을 복사하거나 지침 전용 `SKILL.md`(`teacher-context-guide`, 프로필 없음)를 내려받아 첨부하고, 교사 프로파일 Markdown을 함께 첨부한다.
9. **CI E2E 실행 방식(2026-10-25)**: **확정: CI에서만 프로덕션 서버(`pnpm start`)로 E2E를 실행한다.** 개발 서버의 병렬 부하에서 전체 새로고침으로 인한 간헐적 실패가 재현되었기 때문이다. 로컬은 개발 서버를 유지한다(WU-9a F7).

---

## 10. Phase 1 범위 밖

- AI 플랫폼별 활용 가이드 화면과 공통 실행 지침 복사(Phase 2, 구조는 11장)
- 플랫폼 설치 자동화와 플랫폼별 Skill 변형. 기본 Agent Skill zip 패키지는 Phase 2의 WU-10a로 앞당겼다(9장 결정 8).
- 전체본·핵심본·모듈 선택본과 충실성 검사(Phase 3)
- 확정본 스냅샷 이력, 이전 버전 비교·복원, 외부 AI 내보내기 이력, Agent Skill 패키지(Phase 4)
- Markdown → JSON 가져오기
- `navigator.storage.persist()` 요청, 저장 데이터 암호화(동일 출처 정책 외의 보호)

---

## 11. 플랫폼 독립 구조: Gemini Gem→Skill 전환 대응

### 11.1 전제와 원칙

- 전제(사용자 제공): Google Gemini의 Gem 기능이 2026~2027년에 Skill로 전환될 예정이다. 지침서 4.3의 원칙대로 가이드를 구현하거나 갱신할 때마다 공식 문서를 다시 확인한다.
  - 2026-10-25 공식 문서 확인 결과: 개인 계정은 2026-11-17 읽기 전용, 2026-12-17 제거. Workspace 업무용은 2027-03-01 이후, 교육용은 2027-06-01 이후에 전환된다. skill은 공개 `SKILL.md` 형식을 따른다. 상세 내용은 `docs/codex/platform-facts.md`에 있다.
- 이번 단계에서 하는 일
  - Phase 1: 아래 11.3의 최소 변경만 반영한다(파일 단위 산출물 타입, 아키텍처 가드).
  - Phase 2: 기존 방식대로 Gemini 활용 가이드를 제공하되, Gem과 Skill을 모두 담을 수 있는 데이터 구조로 만든다.
- 이번 단계에서 하지 않는 일: Skill 패키지(zip·references 폴더) 생성, 플랫폼 설치 자동화, 플랫폼 계정 연동.
  - 2026-10-25 변경: 기본 Agent Skill zip 패키지(`SKILL.md` + `references/teacher-profile.md`)는 WU-10a로 앞당겨 Phase 2에서 구현한다(9장 결정 8).
- 원칙
  1. 세 층으로 나눈다: canonical JSON → 플랫폼 중립 산출물(Markdown, JSON 백업, 향후 Skill 패키지) → 플랫폼별 안내(콘텐츠 데이터).
  2. 플랫폼 기능명, 설치 절차, URL은 `src/content/platform-guides/*`에만 둔다.
  3. 플랫폼 안내는 "방법(method)" 단위로 모델링하고 방법마다 상태와 확인 일자를 둔다. 기능 전환은 상태 값만 바꿔 반영한다.
  4. 공통 활용 지침(지침서 4.6)은 한 곳에서 정의한다. 플랫폼 가이드와 향후 `SKILL.md`가 같은 출처를 쓴다.
  5. 산출물은 모두 `ExportFile`(파일 하나) 또는 `ExportFile[]`(파일 묶음)로 표현한다. Markdown 1개, JSON 1개, Skill 패키지 여러 개를 같은 다운로드 경로로 처리할 수 있다.

### 11.2 계층 구조

```text
TeacherContextProfile (canonical JSON, 변경 없음)
   │
   ├─ profileToMarkdown             → 교사 프로파일 .md (기존, 출력 계약 고정)
   ├─ createProfileBackup (Phase 1) → 구조화 백업 .json
   └─ buildSkillPackage  (Phase 4)  → SKILL.md + references/teacher-profile.md
                                         └ references 본문 = profileToMarkdown 결과 그대로
   ▼ ExportFile / ExportFile[]
downloadTextFile (Phase 1) · 묶음 zip 다운로드 (Phase 4)

src/content/usage-instructions.ts      공통 활용 지침(지침서 4.6) 단일 출처
src/content/platform-guides/           플랫폼별 안내 데이터
  chatgpt.ts · gemini.ts · claude.ts · index.ts · schema.ts
   │  각 방법이 필요한 산출물을 artifact id로만 참조
   ▼
범용 가이드 렌더러 (Phase 2, 플랫폼 이름으로 분기하는 코드 없음)
```

### 11.3 Phase 1에 반영하는 최소 변경

| 변경                                 | 내용                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/export/files.ts`            | `ExportFile = { path, mediaType, content }`. `mediaType`은 `text/markdown`, `application/json`, `text/plain` 중 하나다. `path`는 묶음 안의 상대 경로이며 단일 파일이면 파일명이다. WU-10a에서 `content: string                                          | Uint8Array`와 `application/zip`으로 넓힌다. |
| `downloadTextFile(file: ExportFile)` | Markdown과 JSON 다운로드가 함께 쓴다. `downloadMarkdown`은 기존 시그니처를 유지하고 위임만 한다.                                                                                                                                                        |
| 백업 형식                            | 플랫폼 필드를 넣지 않는다(6.1).                                                                                                                                                                                                                         |
| 로컬 레코드                          | 플랫폼 관련 필드를 미리 만들지 않는다. Phase 4의 "최근 외부 AI에 내보낸 버전"은 `storageSchemaVersion 2` 마이그레이션으로 추가하고, 대상은 `gemini-gem` 같은 **불투명한 문자열 id**로만 저장한다. 그래야 플랫폼 이름이 바뀌어도 저장 스키마는 그대로다. |
| 아키텍처 가드 테스트                 | `src/types`, `src/lib/export`, `src/lib/storage`, `src/lib/profile`의 소스에 ChatGPT, Gemini, Claude, Gem(s), GPTs가 단어 단위로 없음을 검사한다. `src/lib/ai`(서버의 OpenAI 호출)와 `src/content`는 대상에서 뺀다.                                     |

이 다섯 가지 외에 Phase 1 작업 단위의 범위는 바뀌지 않는다.

### 11.4 플랫폼 가이드 데이터 모델(Phase 2)

```ts
// src/content/platform-guides/schema.ts — 콘텐츠 전용 타입. 핵심 로직은 import하지 않는다.
type GuideArtifactId =
  "profile-markdown" | "usage-instructions" | "skill-package";

type GuideMethodStatus =
  | "recommended" // 지금 권장하는 경로
  | "available" // 쓸 수 있지만 권장하지 않음
  | "transitioning" // 다른 방법으로 옮겨 가는 중(종료 예정 안내 표시)
  | "announced" // 발표만 됨. 접힌 안내로 표시하고 기본 경로로 쓰지 않음
  | "retired"; // 종료. 기본은 숨기고, 기존 사용자에게만 이전 안내를 표시

type PlatformGuideMethod = {
  id: string; // 예: "gemini-gem", "gemini-skill", "gemini-chat-attachment"
  label: string; // 화면 표기. 기능명은 여기에만 쓴다
  status: GuideMethodStatus;
  requiredArtifacts: GuideArtifactId[];
  steps: Array<{
    title: string;
    body: string;
    image?: { src: string; alt: string };
  }>;
  instructionTarget?: string; // 공통 지침을 붙여 넣을 칸 이름
  availabilityNote?: string; // 요금제·계정 유형·지역 제한
  migrationNote?: string; // 이전 방법 사용자에게 줄 전환 안내
  replaces?: string; // 대체하는 방법 id(예: skill이 gem을 대체)
  officialUrl: string; // 공식 서비스 또는 도움말
  verifiedAt: string; // YYYY-MM-DD, 공식 문서를 확인한 날
};

type PlatformGuide = {
  id: string; // "chatgpt" | "gemini" | "claude" — 콘텐츠 색인에서만 의미를 가짐
  name: string;
  summary: string;
  methods: PlatformGuideMethod[]; // 배열 순서가 곧 권장 순서
  fallbackMethodId: string; // 일반 대화에 파일 첨부·붙여넣기
};
```

- 모든 플랫폼에 공통으로 붙는 고지(외부 서비스로 데이터가 전달됨, 자동 동기화되지 않음, 수정하면 다시 등록해야 함)는 플랫폼 데이터가 아니라 공통 컴포넌트에 둔다.
- 콘텐츠 검증은 Vitest에서 Zod로 한다. 런타임 파싱은 하지 않는다.
  - 플랫폼마다 `retired`가 아닌 방법이 하나 이상 있고, `fallbackMethodId`가 실제 방법을 가리킨다.
  - 방법 id는 전역에서 고유하고, `replaces`는 존재하는 id를 가리킨다.
  - `officialUrl`은 https이고, `verifiedAt`은 유효한 날짜다.
  - `requiredArtifacts`에는 **현재 생성할 수 있는 산출물만** 넣을 수 있다. `AVAILABLE_ARTIFACTS`에 `skill-package`가 없으면 어떤 방법도 그것을 요구할 수 없다. 이 검사가 Skill 패키지를 만들기 전에 다운로드를 약속하는 실수를 막는다.
- `verifiedAt`은 화면에 "YYYY년 M월 기준 안내"로 표시한다. 날짜가 지났다고 CI를 실패시키지는 않는다. 시간이 흐르면 테스트가 깨지는 구조는 피한다.

### 11.5 공통 활용 지침의 단일 출처

- `src/content/usage-instructions.ts`에 지침서 4.6 문안을 `COMMON_USAGE_INSTRUCTIONS`로 둔다.
- 플랫폼 가이드는 이 상수를 artifact `usage-instructions`로 참조하고 복사 버튼으로 제공한다. 플랫폼별 차이는 "어느 칸에 붙여 넣는지"(`instructionTarget`)뿐이고, 지침 본문은 공유한다.
- Phase 4의 `SKILL.md` 본문도 이 상수에 지침서 7.3의 스킬 실행 원칙을 더해 만든다.
- `src/content/profile-document.ts`의 Markdown 상수와는 섞지 않는다(R19). 공통 지침을 고쳐도 Markdown 출력과 기여·관리자 검증은 영향을 받지 않는다.

### 11.6 Gemini 가이드 모델링(Gem과 Skill 공존)

Phase 2 구현 시점의 `gemini.ts` 방법 구성(9장 결정 6·8, 2026-10-25 재확정):

| id                       | status          | requiredArtifacts                        | 안내 요지                                                                                                                                                   |
| ------------------------ | --------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gemini-skill`           | `recommended`   | `skill-package`                          | TContext가 만든 `teacher-context.zip`을 Customize → Skills → Create → Upload로 등록한다(WU-10a).                                                            |
| `gemini-gem`             | `transitioning` | `profile-markdown`, `usage-instructions` | Workspace 교육용·업무용 계정에서만 새로 만들 수 있다. 개인 계정은 2026-11-17부터 읽기 전용이며 기존 Gem은 skill로 자동 전환된다는 `migrationNote`를 붙인다. |
| `gemini-chat-attachment` | `available`     | `profile-markdown`, `usage-instructions` | A 방식: 공통 지침 복사 또는 지침 `SKILL.md` 첨부 + Markdown 첨부(`fallbackMethodId`)                                                                        |

이후 전환 시나리오(어느 경우에도 바꿀 파일은 `gemini.ts`뿐이며, Phase 4 패키지 지원만 생성기가 함께 바뀐다):

| 시점                                   | `gemini-gem`                                 | `gemini-skill`                           | 변경 파일      |
| -------------------------------------- | -------------------------------------------- | ---------------------------------------- | -------------- |
| Phase 2 구현(2026-10-25 확정)          | `transitioning` + `migrationNote`            | `recommended` + `skill-package`          | —              |
| 교육용 계정까지 Gem 종료(2027-06 이후) | `retired`(숨김, 기존 사용자에게만 이전 안내) | `recommended`                            | `gemini.ts`    |
| 표본 업로드가 실패한 경우              | 변동 없음                                    | skill 안내 보류, 대화 첨부(A)를 기본으로 | `gemini.ts`    |
| 플랫폼별 Skill 변형(Phase 4)           | —                                            | 필요 시 flavor 추가                      | Phase 4 생성기 |

- 렌더러는 상태 배지(권장, 전환 중, 출시 예정, 종료)를 상태 값으로만 고른다. 플랫폼 id로 분기하는 코드가 생기면 리뷰에서 반려한다.
- ChatGPT·Claude 가이드도 같은 구조를 쓴다. 다른 플랫폼에 비슷한 전환이 생겨도 같은 절차로 처리한다.

### 11.7 향후 Agent Skill 패키지 내보내기 구조(Phase 4 준비, 이번에 구현하지 않음)

- 2026-10-25 변경: 아래 공통 형식(폴더 `teacher-context/`, `SKILL.md`, `references/teacher-profile.md`)의 zip 패키지를 WU-10a로 앞당긴다. 상세 사양은 `docs/codex/runbook.md` WU-10a에 있다. `SkillFlavor` 어댑터, 모듈 선택본, 다른 플랫폼 설치 안내는 계속 Phase 4다.
- 생성기 시그니처(예정): `buildSkillPackage(profile, { flavor, modules? }): ExportFile[]`. `profile`은 확정본 `TeacherContextProfile`, `modules`는 Phase 3 이후의 모듈 선택이다.
- 공통 형식(지침서 7.2)

```text
teacher-context/
├── SKILL.md                    # YAML 머리말(name, description) + 사용 시점·참조 규칙(지침서 7.3)
└── references/
    └── teacher-profile.md      # profileToMarkdown(확정본) 결과 그대로. Phase 3 이후에는 모듈 선택본도 가능
```

- 플랫폼 차이는 `SkillFlavor` 어댑터로 흡수한다. 어댑터는 `{ id, frontmatter(profile), packaging: "folder" | "zip", constraints }` 형태다.
  - 기본 flavor는 공개된 Agent Skills 형식 하나다. 현재 공개 형식은 `SKILL.md` 머리말의 `name`과 `description`을 필수로 두며, 이름 규칙과 설명 길이 제한은 Phase 4 시점에 공식 사양을 다시 확인한다.
  - Gemini Skill의 사양이 공통 형식과 다르면 `gemini` flavor를 하나 추가한다. 프로파일 로직과 Markdown 생성은 바뀌지 않는다.
- 생성 조건은 기존 내보내기 정책과 같다.
  - 확정본에서만 만든다.
  - 미확인 문장과 개인정보 경고 상태는 `references/teacher-profile.md`에 그대로 표시된다(Markdown 재사용).
  - 외부 서비스로 전달된다는 고지를 붙인다.
- Phase 1 결정이 이 구조를 막지 않는지 점검했다.
  - Markdown 출력 계약이 고정되어 있으므로 references 본문으로 재사용할 수 있다.
  - `ExportFile`이 있으므로 여러 파일 묶음을 같은 경로로 다룰 수 있다.
  - 로컬 레코드는 산출물을 저장하지 않고 확정본만 저장한다. 산출물은 언제든 다시 만든다.
  - 저장 스키마에는 플랫폼 정보가 없으므로 내보내기 이력은 마이그레이션으로 추가할 수 있다.

### 11.8 Phase 2 작업 단위 초안(P0 과제 B)

Phase 1(WU-1~9)이 끝난 뒤 진행한다. Phase 1과 같은 파일을 동시에 수정하지 않는다.

- **WU-10. 콘텐츠 스키마와 데이터**
  - 범위: `src/content/usage-instructions.ts`, `src/content/platform-guides/{schema,chatgpt,gemini,claude,index}.ts`, 콘텐츠 검증 테스트. UI는 만들지 않는다.
  - 완료 조건
    - [ ] 11.4의 검증 규칙이 모두 테스트로 고정되어 있다.
    - [ ] Gemini에 11.6 표의 세 방법이 있다.
    - [ ] 모든 방법에 `officialUrl`과 `verifiedAt`이 있고, 구현할 때 공식 문서로 확인한 날짜다.
    - [ ] 아키텍처 가드 테스트가 통과한다.
- **WU-10a. Agent Skill zip 패키지 내보내기**(2026-10-25 추가)
  - 범위: `src/lib/export/{zip,skill}.ts`, `ExportFile` 바이너리 확장, 사용 원칙 상수, artifact `skill-package`. 상세 사양과 테스트는 runbook WU-10a에 있다.
  - 완료 조건: 확정본에서만 만들고, zip에 파일 2개만 들어가며, 참고 파일이 `profileToMarkdown` 결과와 같다. 새 런타임 의존성이 없고 아키텍처 가드가 통과한다.
- **WU-11. 범용 가이드 화면**
  - 범위: `/ai-guide`, `/ai-guide/[platform]`(`generateStaticParams`, `dynamicParams = false`), `src/components/ai-guide/*`, /result와 /profiles의 "AI에서 활용하기" 진입점.
  - 완료 조건
    - [ ] 렌더러 코드에 플랫폼 id 문자열 비교가 없다(리뷰와 grep으로 확인).
    - [ ] 메모리에 문서가 없으면 Markdown 다운로드 버튼을 비활성화하고 "문서를 만들거나 내 프로파일에서 여세요"라고 안내한다. 공통 지침 복사는 문서 없이도 가능하다.
    - [ ] 외부 전송 고지, 자동 동기화 안 됨 고지, 수정 후 재등록 안내가 모든 플랫폼에 표시된다.
    - [ ] 외부 링크는 새 탭으로 열리고 `rel="noopener noreferrer"`를 쓴다. 업로드는 자동으로 하지 않는다.
    - [ ] 모바일과 320px에서 넘침이 없다.
- **WU-12. 가이드 E2E와 전환 시뮬레이션**
  - 범위: 지침서 11.2의 #11 시나리오, 콘텐츠 교체 테스트.
  - 완료 조건
    - [ ] 세 플랫폼 화면에서 다운로드와 지침 복사가 동작한다.
    - [ ] RTL에서 Gemini 데이터의 상태만 바꾼 고정 데이터(Gem `retired`, Skill `recommended`)를 주입하면, 렌더러 코드 변경 없이 화면의 권장 경로와 배지가 바뀐다.
