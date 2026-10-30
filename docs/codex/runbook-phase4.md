# Codex 연속 실행 지침: Phase 4 (WU-19 ~ WU-23)

- 설계 근거: `docs/version-and-skill-design.md` (9장 결정 확정, 2026-10-30)
- 플랫폼 사실: `docs/codex/platform-facts.md` 7절(2026-10-30). 이 절에 없는 플랫폼 사실은 쓰지 않는다.
- 기준 코드: `main` @ `07bd62c` (Phase 3.1 병합 후)
- 브랜치: `feat/version-history`. Claude가 만들고 설계·지침 문서를 먼저 커밋한다. 이 브랜치에서 시작한다.
- 방식: WU-19부터 WU-23까지 멈추지 않고 이어서 구현한다. WU-23을 커밋한 뒤 멈추면 Claude가 최종 리뷰를 한다.

## 1. 실행 순서

```text
WU-19 저장 형식 v2와 저장소 API
  → WU-20 버전 기록 화면
  → WU-21 내보내기 기록과 교체 안내
  → WU-22 skill 패키지 2.0과 호환성 검사
  → WU-23 E2E와 문서
     ▶ 최종 정지: Claude 최종 리뷰
```

- WU-20과 WU-21은 WU-19의 저장소 API를 쓴다. WU-22는 독립적이지만 순서대로 진행한다.
- 중간 정지 지점은 없다. 4절의 멈춤 조건은 계속 적용된다.

## 2. 입력 문서와 우선순위

충돌하면 위의 문서가 우선한다.

1. `AGENTS.md`
2. 이 문서 5절의 WU별 사양
3. `docs/version-and-skill-design.md`
4. `docs/codex/runbook.md` 3절(공통 규칙). 이 문서에서 따로 정하지 않은 부분에 적용한다.
5. `docs/local-profile-design.md`(저장 구조 배경)

## 3. 공통 규칙

### 3.1 브랜치와 커밋

- WU 하나당 커밋 하나다. 메시지는 영어 명령문 요약 뒤에 WU 번호를 붙인다(예: `Add confirmed version history to local profiles (WU-19)`).
- 이전 커밋을 amend하거나 rebase하지 않는다.

### 3.2 자동 관문

| 시점    | 반드시 통과                                                    |
| ------- | -------------------------------------------------------------- |
| 모든 WU | `lint`, `typecheck`, `test`, `build`                           |
| WU-23   | 위 항목 + `test:e2e`(chromium·mobile, 재시도 0, 프로덕션 서버) |

- 모든 명령은 `corepack pnpm <명령>`으로 실행한다.
- 외부 키는 가짜 값으로 덮어쓴다: `OPENAI_API_KEY=test-key-not-used`, `SUPABASE_URL=https://example.supabase.co`, `SUPABASE_SECRET_KEY=test-secret-not-used`
- E2E 실행 순서(이 PC는 `pnpm`이 PATH에 없어 `CI=1`의 webServer가 뜨지 않는다)
  1. `corepack pnpm build`
  2. `corepack pnpm start --port 3100`을 따로 띄운다. 포트가 이미 쓰이고 있으면 다른 포트를 쓰고 진행 기록에 적는다.
  3. `PLAYWRIGHT_BASE_URL=http://localhost:<포트>`로 `corepack pnpm test:e2e --retries=0`
  4. 끝나면 **서버 프로세스를 끄고 포트가 비었는지 확인한다.** 셸만 끄면 `next start` 자식 프로세스가 남을 수 있다.
- 관문이 실패한 채로 커밋하지 않는다. 테스트를 건너뛰게 바꾸거나, 기대값을 구현에 맞춰 느슨하게 고치거나, lint 규칙을 끄지 않는다.
- **고정 해시와 출력 계약**: `profile-variants-module-golden.test.ts`(모듈 선택본)와 핵심본·전체본 테스트는 바꾸지 않고 통과해야 한다.

### 3.3 변경 금지 영역과 승인된 예외

#### 변경 금지

- **출력 생성기**: `src/lib/export/profile-to-markdown.ts`, `profile-to-markdown-v1.ts`, `profile-to-text.ts`, `profile-variants.ts`, `profile-variants-fidelity.ts`, `src/content/profile-document.ts`, `src/content/export-variants.ts`
- **백업 형식**: `src/lib/storage/profiles/backup.ts`와 백업 스키마(`profileBackupFileSchema`). 백업에는 지금처럼 현재 버전 하나만 담는다(결정 5).
- **zip 작성기**: `src/lib/export/zip.ts`
- **공통 지침 문구**: `src/content/usage-instructions.ts`
- **서버·검사·기여**: `src/app/api/**`, `src/lib/ai/**`, `src/lib/consent/**`, `src/lib/supabase/**`, `supabase/**`
- **세션과 검토 화면**: `src/components/layout/interview-session-provider.tsx`, `src/components/profile/**`
- **의존성**: 새 런타임·개발 의존성을 추가하지 않는다.

#### 기존 테스트

- 원칙: `07bd62c` 시점에 있던 테스트의 기대값은 바꾸지 않는다.
- **승인된 예외는 아래 표의 항목뿐이다.** 표에 없는 변경이 필요하면 멈춘다(4절).

| #   | 파일                                                                                                                              | 허용하는 변경                                                                                                                                                                                                                                                                                                                                                                      | WU    |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| E1  | `src/lib/storage/profiles/schema.test.ts`, `serialize.test.ts`, `src/components/local-profiles/use-local-draft-autosave.test.tsx` | **현재 형식의 기록**을 나타내는 고정 데이터만: `storageSchemaVersion: 1` → `2`, `history: []`와 `exports: []` 추가. 그 밖의 값과 기대값은 그대로                                                                                                                                                                                                                                   | WU-19 |
| E2  | `src/lib/storage/profiles/migrate.test.ts`                                                                                        | (a) "미래 버전" 값 `2` → `3`. (b) 현재 형식 고정 데이터는 E1과 같게. (c) 사용자 지정 업그레이드 연쇄를 검사하는 테스트는 새 현재 버전(2)에 맞게 업그레이드 표와 기대 버전만 고친다. 실패 사례 5종(예외, 그대로 반환, 현재보다 높은 버전으로 올리기, `null`, 배열)은 모두 남긴다. "현재보다 높은 버전" 사례의 값은 `2` → `3`이다. (d) 결과 기대값의 `storageSchemaVersion: 1` → `2` | WU-19 |
| E3  | `src/lib/storage/profiles/repository.test.ts`                                                                                     | "미래 버전" 값 `2` → `3`. 현재 형식 고정 데이터는 E1과 같게                                                                                                                                                                                                                                                                                                                        | WU-19 |
| E4  | `e2e/context-export.spec.ts`                                                                                                      | 저장소에 직접 넣는 기록을 v2 형식(E1과 같은 변경)으로                                                                                                                                                                                                                                                                                                                              | WU-19 |
| E5  | `src/lib/export/skill.test.ts` "exports exactly two files…"                                                                       | `not.toContain(profile.profileTitle)`를 "핵심 맥락이 들어 있다"는 기대로 바꾸고, 도입 문단 기대값을 새 문구로 바꾼다. 기존 도입 문단 기대값은 지우지 말고 **한도 초과(대체) 테스트로 옮긴다.** 나머지 기대값은 그대로                                                                                                                                                              | WU-22 |
| E6  | `src/content/platform-guides/schema.test.ts` "validates approved platform methods…"                                               | 방법 목록 기대값에 `chatgpt-skill`, `claude-skill` 두 줄 추가(5절 WU-22의 순서)                                                                                                                                                                                                                                                                                                    | WU-22 |

- Phase 3·3.1에서 만든 테스트도 같은 원칙을 따른다. 위 표 밖에서 기대값을 바꿔야 하면 멈춘다.
- 새 기능에 대한 테스트는 새 파일이나 새 `it`으로 추가한다.

### 3.4 진행 기록

- `docs/codex/progress-phase4.md`를 만들고 각 WU 커밋에 함께 넣는다.
- 형식은 `docs/codex/runbook.md` 3.4와 같다: 상태, 변경 파일, 관문, 다르게 구현한 부분과 이유, 이전 WU 수정, 확인하지 못한 것, 리뷰어에게 묻고 싶은 것.
- 3.3의 예외 E1~E6을 쓴 경우, 파일과 바꾼 줄을 진행 기록에 적는다.
- WU-23 뒤에 "Phase 4 요약"을 적는다.

## 4. 멈추고 물어봐야 하는 경우

다음 중 하나라도 해당하면 그 WU를 커밋하지 말고 진행 기록에 상황을 적은 뒤 멈춘다.

1. 3.3의 변경 금지 영역을 고쳐야만 진행할 수 있다.
2. 3.3 표에 없는 기존 테스트 기대값을 바꿔야 한다.
3. v1 기록이 마이그레이션 뒤 읽히지 않거나, 손상·미래 버전 기록의 처리 결과가 바뀐다.
4. 백업 형식이나 기여 데이터가 바뀐다.
5. 개인정보 불변 조건과 충돌한다. 예: 내보낸 내용, 모듈 선택, 외부 계정 정보를 저장해야 하는 경우
6. `platform-facts.md` 7절에 없는 플랫폼 사실이 필요하다.
7. 정상 고정 데이터에서 skill 호환성 검사가 실패한다.
8. 같은 WU에서 관문을 세 번 고쳐도 통과하지 못한다.
9. 새 의존성이 필요하다.

"작은 설계 판단"(내부 함수 분리, 컴포넌트 이름, 스타일)은 멈추지 말고 결정한 뒤 진행 기록에 남긴다.

## 5. WU별 사양

### WU-19. 저장 형식 v2와 저장소 API

#### 파일

- `src/lib/storage/profiles/{schema,migrate,repository}.ts`
- `src/lib/profile/versions.ts`(신규)
- `src/components/local-profiles/local-save-panel.tsx`: `LOCAL_PROFILE_ERROR_MESSAGES`에 `draft_exists` 문구 한 줄만 추가한다(오류 코드 타입이 바뀌어 이 WU에서 필요하다). 문구: "편집 중인 초안을 확정하거나 버린 뒤 복원할 수 있습니다."
- 각 테스트(신규 `it` 추가 + 3.3의 E1~E4)

#### 상수와 스키마 (`schema.ts`)

```ts
export const LOCAL_PROFILE_STORAGE_SCHEMA_VERSION = 2; // 기록 형식
export const LOCAL_PROFILE_SETTINGS_VERSION = 1; // 설정 레코드 형식(바뀌지 않음)
export const MAX_PROFILE_HISTORY = 5;
export const MAX_PROFILE_EXPORTS = 10;
export const profileExportFormatSchema = z.enum([
  "full",
  "core",
  "modules",
  "skill-package",
]);
export const exportTargetSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
```

- 설정 스키마와 `enableLocalProfiles`가 쓰는 설정 값은 `LOCAL_PROFILE_SETTINGS_VERSION`(1)을 쓴다. 설정 형식은 바꾸지 않는다.
- 기록 스키마: v1 필드는 그대로 두고 다음을 바꾸거나 더한다.

```ts
storageSchemaVersion: z.literal(2),
history: z.array(z.object({
  profile: teacherContextProfileSchema,
  confirmedAt: z.iso.datetime(),
  replacedAt: z.iso.datetime(),
}).strict()).max(MAX_PROFILE_HISTORY),
exports: z.array(z.object({
  target: exportTargetSchema,
  format: profileExportFormatSchema,
  confirmedAt: z.iso.datetime(),
  exportedAt: z.iso.datetime(),
}).strict()).max(MAX_PROFILE_EXPORTS),
```

- `superRefine`에 더할 규칙
  - `history`가 비어 있지 않으면 `confirmed`가 있어야 한다.
  - 이력 항목도 확정본 규칙을 따른다: 검사 대기 상태 불가, 지원하는 프로필 버전
  - `confirmedAt`은 현재 확정본과 이력 전체에서 겹치지 않는다.
  - `history`는 `replacedAt` 내림차순(같거나 작아지는 순서)이다.
  - `exports`의 `target`은 겹치지 않는다.
  - `exports.confirmedAt`과 이력 사이의 관계는 검사하지 않는다(보관 범위를 벗어난 버전의 기록도 남는다).

#### 마이그레이션 (`migrate.ts`)

- `RECORD_UPGRADES = { 1: (raw) => ({ ...raw, storageSchemaVersion: 2, history: [], exports: [] }) }`
- 지원하지 않는 프로필 버전 검사(`hasUnsupportedProfileVersion`)에 이력 항목의 `profile`도 넣는다.
- 읽을 때 변환하고 다음 쓰기에서 v2로 저장되는 현행 방식은 그대로다. 읽기만으로 DB를 고치지 않는다.

#### 같은 내용 판정 (`src/lib/profile/versions.ts`)

```ts
export function sameProfileContent(
  a: TeacherContextProfile,
  b: TeacherContextProfile,
): boolean;
// profileToMarkdown(a) === profileToMarkdown(b)

export type ChangedArea =
  | { kind: "profile"; field: "profileTitle" | "shortSummary" }
  | { kind: "module"; id: ProfileModuleId }
  | {
      kind: "synthesis";
      id:
        | "teachingDesignPrinciples"
        | "classSupportConsiderations"
        | "realisticConstraints"
        | "aiCollaborationInstructions";
    };
export function changedAreas(
  before: TeacherContextProfile,
  after: TeacherContextProfile,
): ChangedArea[];
// diffProfiles(before, after)에서 바뀐 곳만 고른다. 순서: profile 필드 → 모듈(PROFILE_MODULE_IDS 순) → 종합 섹션
```

- `src/lib/profile/*`는 아키텍처 가드 대상이다. 플랫폼 이름을 쓰지 않는다.

#### 저장소 API (`repository.ts`)

- **새 기록 만들기**(`createLocalProfile`): v2로 쓰고 `history: []`, `exports: []`를 넣는다.
- **`saveConfirmed`**(시그니처 그대로). 기존 `update` 안에서 다음 순서로 처리한다.
  1. `record.confirmed`가 없으면(가져온 초안의 첫 확정) 지금처럼 확정본을 둔다.
  2. 있고 `sameProfileContent(record.confirmed.profile, input.confirmed.profile)`이면
     - `record.confirmed = { profile: input.confirmed.profile, confirmedAt: record.confirmed.confirmedAt }`
     - 이력을 만들지 않는다. 분석 태그 같은 Markdown 밖 수정은 보존하고 버전 시각만 유지한다.
  3. 다르면 `{ profile: record.confirmed.profile, confirmedAt: record.confirmed.confirmedAt, replacedAt: now }`를 `history` 맨 앞에 넣고, `record.confirmed = input.confirmed`로 둔다.
  4. `history`가 5개를 넘으면 뒤에서부터(가장 오래된 것) 지운다.
  5. 초안 비우기, 태그 병합, `revision`·`updatedAt` 갱신은 지금과 같다.
- **`restoreVersion(id, { confirmedAt, expectedRevision })`** → `{ revision, savedAt }`
  - 기존 `update`(revision 확인)를 쓴다.
  - `record.draft`가 있으면 새 오류 코드 `draft_exists`로 거절한다.
  - `history`에서 `confirmedAt`이 같은 항목을 찾는다. 없으면 `not_found`
  - 현재 확정본을 이력 맨 앞으로 내리고(`replacedAt: now`), 찾은 항목을 이력에서 빼서 현재 확정본으로 올린다. **`confirmedAt`은 그 항목의 원래 값을 유지한다.**
  - `revision`·`updatedAt`을 올린다.
- **`deleteVersion(id, { confirmedAt })`** → `{ deleted: boolean }`
  - **부가 정보 쓰기**: `revision`·`updatedAt`을 바꾸지 않는다. `expectedRevision`을 받지 않는다.
  - 트랜잭션 안에서 최신 기록을 읽고 이력 항목 하나만 지운 뒤 다시 쓴다. 현재 확정본은 지울 수 없다(이력에 없으면 `deleted: false`).
- **`recordExport(id, { target, format, confirmedAt })`** → `{ recorded: boolean }`
  - **부가 정보 쓰기**(위와 같음).
  - 쓰는 시점의 `record.confirmed?.confirmedAt`이 입력과 다르면 기록하지 않는다(`recorded: false`). 그 사이 다른 탭에서 확정본이 바뀐 경우다.
  - 같은 `target`이 있으면 바꾸고, 없으면 더한다. `exportedAt`은 저장소의 `now`다. 10건을 넘으면 `exportedAt`이 가장 이른 것부터 지운다.
- 부가 정보 쓰기도 다른 탭에 알린다(`context.done(value, true)`).
- 기존 쓰기(`saveDraft`, `discardDraft` 등)는 트랜잭션 안에서 읽은 기록을 고쳐 쓰므로 `history`·`exports`를 보존한다. 이를 테스트로 고정한다.
- `discardDraft`가 확정본 없는 기록을 지우는 기존 동작은 그대로다(이 경우 이력도 없다).
- `LocalProfileErrorCode`에 `draft_exists`를 더한다. 화면 문구는 위 파일 목록대로 이 WU에서 더한다.
- **목록 항목**(`LocalProfileListItem`)에 더할 필드
  - `versionCount`: 확정본이 있으면 `1 + history.length`, 없으면 0
  - `lastExport`: `exportedAt`이 가장 늦은 기록 `{ target, format, exportedAt }` 또는 `null`
  - `outdatedExportTargets`: `confirmedAt`이 현재 확정본과 다른 기록의 `target` 목록(`exportedAt` 내림차순)

#### 테스트(신규)

- v1 기록(이력 필드 없음)을 넣은 DB → 읽기 성공(`history: []`, `exports: []`), 다음 쓰기 뒤 원시 값이 v2
- 확정 저장
  - 내용이 다르면 이력 1건 증가, 이전 확정본과 `confirmedAt` 보존
  - 같은 내용이면 이력 0건, `confirmedAt` 유지, `confirmedTags` 변경은 반영
  - 6번 다른 내용으로 확정하면 이력은 5건이고 가장 오래된 것이 사라짐
- 복원
  - 성공 시 현재·이력이 바뀌고 이력 수 유지, 복원본의 `confirmedAt`은 원래 값
  - 초안이 있으면 `draft_exists`, 없는 버전이면 `not_found`, 오래된 revision이면 `conflict`
- `deleteVersion`·`recordExport` 뒤 `revision`·`updatedAt`이 그대로이고, 다른 탭의 `saveDraft`(같은 `expectedRevision`)가 성공한다.
- `recordExport`: 대상별 1건 갱신, 10건 상한, 확정본이 바뀐 뒤에는 `recorded: false`
- 모든 기존 쓰기 함수 뒤에 `history`·`exports`가 보존됨
- 스키마: 이력 규칙 위반 각각 거절(확정본 없음, 검사 대기, `confirmedAt` 중복, 순서, 5개 초과, 대상 중복, 대상 id 형식)
- `sameProfileContent`, `changedAreas` 단위 테스트
- 기존 손상·미래 버전 처리(E2·E3의 3으로 바꾼 값 포함)가 그대로 통과

### WU-20. 버전 기록 화면

#### 파일

- `src/app/profiles/versions/page.tsx`(신규, 서버 컴포넌트): `metadata`(title "버전 기록", `robots: { index: false, follow: false }`), `<Suspense>`로 감싼 클라이언트 컴포넌트를 렌더링한다(`useSearchParams` 사용).
- `src/components/local-profiles/profile-versions.tsx`(신규)
- `src/components/local-profiles/version-compare.tsx`(신규)
- `src/components/local-profiles/profile-library.tsx`(목록 표시 추가, 보기 열기 함수 분리)
- RTL 테스트(신규 파일)

#### 내 프로파일 목록

- 기록마다 다음을 추가한다(기존 버튼과 문구는 그대로).
  - "처음 저장 {createdAt}"
  - "버전 {versionCount}개"와 **버전 기록** 링크(`/profiles/versions?record={id}`). 확정본이 없는 기록에는 링크를 두지 않는다.
  - `lastExport`가 있으면 "최근 내보낸 기록: {대상 이름} · {형식 이름} · {날짜}"
  - `outdatedExportTargets`가 있으면 "이전 버전을 내보낸 곳 {n}곳" 표시
- 대상 이름: `PLATFORM_GUIDES`에서 id로 찾은 `name`. `result`는 "결과 화면", 찾지 못한 id는 id 그대로
- 형식 이름: `full` 전체본, `core` 핵심본, `modules` 모듈 선택본, `skill-package` skill 패키지
- 날짜 표시는 기존 목록과 같은 방식(`toLocaleString("ko-KR")`)을 쓴다.
- **보기 열기 함수 분리**: 목록의 "보기"가 만드는 `openProfile` 입력(확정본, 병합 태그, `mode: "view"`, link)을 `toViewSession(record, id)` 같은 함수로 뽑아 목록과 버전 화면이 함께 쓴다. 목록 동작은 바뀌지 않아야 한다(기존 테스트 통과).

#### 버전 기록 화면 (`/profiles/versions?record={id}`)

- 시작 조건
  - 로컬 저장이 `enabled`가 아니거나, `record`가 UUID가 아니거나, 기록을 찾지 못하면 "기록을 찾을 수 없습니다"와 내 프로파일 링크를 보여 준다.
  - DB를 새로 만들지 않는다. 기존 저장소 함수만 쓴다.
- 제목: 문서 제목. 그 아래 "처음 저장 {createdAt}"
- 목록(위에서부터)
  1. **현재 확정본**: "{confirmedAt}에 확정", 바뀐 영역(직전 이력 대비, 이력이 없으면 생략), **보기** 버튼(목록의 보기와 같은 동작 → `/result`)
  2. **이전 버전**(이력 순서): "{confirmedAt}에 확정 · {replacedAt}까지 사용", 바뀐 영역(바로 다음으로 새로운 버전 대비)
     - 버튼: **현재와 비교**, **이 버전으로 복원**, **삭제**
- 바뀐 영역 문구: `changedAreas` 결과를 이름으로 바꿔 "·"로 잇는다.
  - 프로필 제목 → "문서 제목", 전체 요약 → "전체 요약", 모듈 → `PROFILE_MODULE_TITLES`, 종합 → 핵심본과 같은 섹션 제목(`VARIANT_SECTION_TITLES`, import만)
  - 없으면 "내용 변화 없음(분석 태그만 바뀜)"을 쓴다. 이 경우는 생기지 않아야 하지만 표시는 안전하게 둔다.
- **비교**(`version-compare.tsx`): 버튼을 누르면 그 항목 아래에 펼친다.
  - 바뀐 영역마다 제목, 그리고 "이전 버전"과 "현재 확정본" 두 칸. 640px 미만에서는 위아래로 쌓는다.
  - 모듈: 제목, 요약, 문장 목록. 문장마다 "추가"·"수정"·"삭제" 글자 배지(색만으로 구분하지 않음)
  - 종합 섹션: 두 목록을 그대로
  - 개인정보 상태가 다르면 두 상태를 함께 표시
  - 바뀐 곳이 없으면 "현재 확정본과 내용이 같습니다"
- **복원**: `ConfirmLocalAction`(confirmLabel "복원")
  - 설명: "이 버전을 현재 확정본으로 되돌립니다. 지금 확정본은 버전 기록에 남습니다."
  - 초안이 있으면 버튼을 비활성화하고 "편집 중인 초안을 확정하거나 버린 뒤 복원할 수 있습니다"를 보여 준다.
  - 성공하면 기록을 다시 읽어 화면을 갱신한다. 세션이 같은 기록에 연결되어 있으면(`localProfileLink.recordId === id`) `toViewSession`으로 복원본을 다시 연다(화면 이동은 하지 않음).
  - 실패하면 `LOCAL_PROFILE_ERROR_MESSAGES` 문구를 보여 준다. `draft_exists` 문구는 위의 비활성화 사유와 같다.
- **삭제**: `ConfirmLocalAction`(confirmLabel "삭제", destructive)
  - 설명: "이 이전 버전을 지웁니다. 되돌릴 수 없습니다."
- **내보내기 기록** 칸은 WU-21에서 추가한다. WU-20에서는 만들지 않는다.
- 상태는 저장소에서만 읽는다. 화면 선택 상태(펼친 비교 등)는 저장하지 않는다.

#### 테스트(RTL)

- 저장 꺼짐·잘못된 id·없는 기록 → 안내, DB를 만들지 않음
- 이력 2건 기록 → 목록 순서, 날짜, 바뀐 영역 문구
- 비교: 바뀐 영역만 표시, 배지 글자, 같은 내용 안내
- 복원: 확인 → 저장소 호출, 갱신, 연결된 세션 다시 열기. 초안 있으면 비활성화
- 삭제: 확인 → 해당 항목만 사라짐
- 목록: 처음 저장, 버전 수, 링크(확정본 없는 기록은 링크 없음)

### WU-21. 내보내기 기록과 교체 안내

#### 파일

- `src/components/export/use-context-as-of.ts`: 같은 내용 판정을 `sameProfileContent`로 바꾼다. 동작은 그대로다(기존 테스트 통과).
- `src/components/export/use-record-export.ts`(신규)
- `src/components/export/export-refresh-notice.tsx`(신규)
- 기록 호출 추가: `result-actions.tsx`, `export-variant-panel.tsx`(선택 prop), `src/components/ai-guide/guide-artifacts.tsx`, `src/components/ai-guide/platform-guide-view.tsx`(대상 id 전달)
- `src/components/export/result-view.tsx`(기록 함수 전달, 안내 배치)
- `src/content/platform-guides/{schema,chatgpt,gemini,claude}.ts`(`updateNote`)
- 버전 기록 화면의 내보내기 기록 칸(WU-20 파일)

#### 기록 훅 (`use-record-export.ts`)

```ts
export function useRecordExport(): (
  target: string,
  format: ProfileExportFormat,
) => void;
```

- 세션의 `profile`·`localProfileLink`와 로컬 저장 상태를 쓴다.
- 다음을 모두 만족할 때만 `recordExport`를 호출한다(설계 3.2).
  1. 로컬 저장 `enabled`, 세션이 기록에 연결됨
  2. `getLocalProfile`로 읽은 확정본이 있고 `sameProfileContent(확정본.profile, 세션 profile)`
- 호출에 넘기는 `confirmedAt`은 읽은 확정본의 값이다.
- 결과를 기다리지 않는다. 오류는 삼키고 화면에 보이지 않는다. 내보내기 동작을 막지 않는다.
- 복사·다운로드가 **성공한 뒤에만** 호출한다.

#### 호출 위치

| 위치                 | 동작                                              | target         | format                               |
| -------------------- | ------------------------------------------------- | -------------- | ------------------------------------ |
| `ResultActions`      | 수업 설계용 Markdown 다운로드, 전체 컨텍스트 복사 | `result`       | `full`                               |
| `ResultActions`      | 핵심본 복사                                       | `result`       | `core`                               |
| `ExportVariantPanel` | 복사, Markdown 다운로드                           | `result`       | 선택한 형식(`full`·`core`·`modules`) |
| `GuideArtifacts`     | 교사 Markdown 다운로드                            | `exportTarget` | 선택한 형식                          |
| `GuideArtifacts`     | ZIP 패키지 다운로드                               | `exportTarget` | `skill-package`                      |

- 기록하지 않는 것: 일반 텍스트 복사, JSON 백업, 인쇄, 지침 SKILL.md, 공통 지침 복사
- **훅을 부르는 위치에 주의한다.** `useInterviewSession`은 provider 밖에서 오류를 던진다. `ResultActions`와 `ExportVariantPanel`의 기존 테스트는 provider 없이 렌더링하므로, 두 컴포넌트 안에서 훅을 부르면 기존 테스트가 깨진다.
  - `ResultActions`와 `ExportVariantPanel`에는 선택 prop `onExported?: (format: ProfileExportFormat) => void`를 더한다. 표의 동작이 성공한 뒤에만 부른다. prop이 없으면 아무것도 하지 않는다.
  - `result-view.tsx`(provider 안)가 `useRecordExport()`를 부르고 `onExported={(format) => record("result", format)}`를 두 컴포넌트에 넘긴다.
  - `GuideArtifacts`는 이미 provider 안에서 쓰이고 테스트도 provider로 감싸므로 훅을 직접 부른다. 선택 prop `exportTarget?: string`을 더하고, 없으면 기록하지 않는다. `platform-guide-view.tsx`가 가이드 id를 그대로 넘긴다. **플랫폼 id로 분기하지 않는다.**
  - 이렇게 하면 기존 테스트의 렌더링 코드와 기대값을 바꾸지 않아도 된다.

#### 교체 안내 (`export-refresh-notice.tsx`)

- 입력: 기록 id. 로컬 저장 `enabled`이고 기록을 읽을 수 있을 때만 그린다.
- `exports` 중 `confirmedAt`이 현재 확정본과 다른 것이 있으면 다음을 보여 준다.
  - 제목: "이전 버전을 내보낸 곳이 있습니다"
  - 설명: "프로파일을 고친 뒤에는 외부 AI에 등록한 문서도 새 문서로 바꿔 주세요. TContext는 내보낸 기록만 알고, 실제로 등록했는지는 알 수 없습니다."
  - 대상별 줄: 대상 이름 · 형식 이름 · 내보낸 날짜. 대상이 가이드 id이면 "바꾸는 방법 보기" 링크(`/ai-guide/{target}`)
- 교체가 필요한 기록이 없으면 아무것도 그리지 않는다.
- 배치
  - 결과 화면: `LocalSavePanel` 바로 위. 세션이 기록에 연결된 경우에만
  - 버전 기록 화면: "내보내기 기록" 칸. 이 화면에서는 교체가 필요 없는 기록도 "최신 버전" 표시와 함께 모두 보여 준다(같은 컴포넌트에 표시 모드 prop).
- 저장소가 바뀌면(다른 탭 알림 포함) 다시 읽는다. 기존 `useLocalProfiles`의 갱신 신호를 쓴다.

#### 가이드 콘텐츠 `updateNote`

- `platformGuideMethodSchema`에 `updateNote: text.optional()`를 더한다.
- 렌더러: 방법 카드에 "문서를 바꿀 때: {updateNote}"를 보여 준다(있을 때만, 플랫폼 분기 없음).
- 값(그대로 쓴다. 새 플랫폼 사실이 아니라 각 방법의 기존 단계를 다시 하는 안내다)

| 방법                      | `updateNote`                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `chatgpt-project`         | 프로젝트 소스 목록에서 이전 교사 문서를 삭제하고 새로 내려받은 문서를 올립니다.                                                               |
| `chatgpt-chat-attachment` | 새 대화를 시작할 때 새로 내려받은 문서를 첨부합니다.                                                                                          |
| `gemini-chat-attachment`  | 새 대화를 시작할 때 새로 내려받은 문서를 첨부합니다.                                                                                          |
| `gemini-skill`            | Skills 화면에서 Replace skill을 눌러 새 teacher-context.zip을 다시 올립니다.                                                                  |
| `gemini-gem`              | Gem을 고칠 수 있는 계정이면 지식 파일을 새 문서로 바꿉니다. 개인 계정은 2026-11-17부터 Gem을 고칠 수 없으므로 skill이나 대화 첨부로 옮깁니다. |
| `claude-project`          | 프로젝트 지식에서 이전 교사 문서를 지우고 새로 내려받은 문서를 올립니다.                                                                      |
| `claude-chat-attachment`  | 새 대화를 시작할 때 새로 내려받은 문서를 첨부합니다.                                                                                          |

- `verifiedAt`과 다른 필드는 바꾸지 않는다. 기존 콘텐츠 테스트는 그대로 통과해야 한다.

#### 테스트

- RTL
  - 연결·같은 내용일 때만 `recordExport` 호출(각 호출 위치별 target·format)
  - 저장 꺼짐, 연결 없음, 내용 다름, 복사·다운로드 실패 → 호출 없음
  - 기록 실패가 화면에 보이지 않고 내보내기 결과 문구가 그대로
  - 일반 텍스트 복사·JSON 백업은 기록하지 않음
  - 교체 안내: 대상 이름·형식·날짜·링크, 교체 불필요 시 렌더링 없음, 버전 화면 모드
  - `updateNote` 표시
- 콘텐츠: 모든 방법에 `updateNote`가 있고, 스키마 검증 통과

### WU-22. skill 패키지 2.0과 호환성 검사

#### 파일

- `src/lib/export/skill.ts`
- `src/lib/export/skill-check.ts`(신규)
- `src/content/skill-format.ts`(신규)
- `src/components/ai-guide/guide-artifacts.tsx`(검사 결과·대체 안내 표시, 기준 시점 전달)
- `src/content/platform-guides/{chatgpt,claude}.ts`(방법 추가)
- 테스트(신규 + 3.3의 E5·E6)

#### `createSkillPackageFile`

```ts
export function createSkillPackageFile(input: {
  profile: unknown;
  now: string;
  asOf?: ContextAsOf; // 없으면 contextAsOf(profile)
}): SkillFileResult;

export type SkillFileResult =
  | { ok: true; value: ExportFile<Uint8Array>; embeddedCore: boolean }
  | {
      ok: false;
      error: "invalid" | "pending_review" | "incompatible";
      issues?: SkillCheckIssue[];
    };
```

- 파일 구성, 경로, `name`, `description`, 참고 파일(전체본 바이트)은 바꾸지 않는다.
- `SKILL.md`
  - **핵심본을 넣는 경우**(기본)
    - 도입 문단(그대로 쓴다): "이 skill에는 교사가 검토한 핵심 맥락이 들어 있습니다. 이 파일의 사용 원칙 다음에 나오는 교사 프로파일이 교사 핵심 맥락이며, 교육 관련 요청에는 먼저 이 내용을 적용하세요. 교사가 직접 말한 근거 문장, 모듈별 세부 내용, 수업 작업 양식이 필요하면 참고 파일 `references/teacher-profile.md`를 읽으세요. 그 파일을 읽지 못했다면 사용자에게 알리고, 핵심 맥락만으로 답했다고 밝히세요."
    - 본문 = 기존 `instructionDocument(…)` 결과(새 도입 문단) + `profileToCoreMarkdown(profile, { asOf })` 결과에서 머리말을 뺀 나머지
      - "머리말을 뺀 나머지" = 두 번째 `---` 줄 바로 다음 글자부터 끝까지. 그대로 붙이면 사이에 빈 줄 하나가 생긴다.
      - 핵심본 문자열을 고치거나 다시 만들지 않는다.
  - **한도를 넘는 경우**: 머리말 아래 본문이 500줄 또는 8,000자를 넘으면 핵심본을 넣지 않고 **지금의 `SKILL.md`와 글자 단위로 같은 파일**을 만든다(`embeddedCore: false`).
- 만든 파일 목록을 `checkSkillPackage`로 검사한다. 문제가 있으면 `{ ok: false, error: "incompatible", issues }`를 돌려준다.
- `createUsageInstructionsFile`(지침 전용 `SKILL.md`)은 바꾸지 않는다.

#### 호환성 검사 (`skill-check.ts`, `skill-format.ts`)

- `src/content/skill-format.ts`: 공개 사양 값과 출처를 둔다(`platform-facts.md` 7.1).

```ts
export const SKILL_FORMAT = {
  source: "https://agentskills.io/specification",
  verifiedAt: "2026-10-30",
  namePattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
  nameMaxLength: 64,
  descriptionMaxLength: 1024,
  allowedFrontmatterKeys: [
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
  ],
  bodyMaxLines: 500,
  bodyMaxCharacters: 8000, // 5,000토큰 권장을 보수적으로 바꾼 TContext 한도
} as const;
```

- `checkSkillPackage(entries: readonly { path: string; content: string }[]): SkillCheckIssue[]`
  - `SkillCheckIssue = { rule: "structure" | "name" | "description" | "frontmatter" | "body_size" | "reference"; detail: string }`
  - 규칙
    - `structure`: 최상위 폴더가 하나이고 모든 경로가 `{폴더}/`로 시작한다. `{폴더}/SKILL.md`가 있다.
    - `frontmatter`: 첫 줄이 `---`이고 닫는 `---`가 있다. 키는 허용 목록 안에 있다. 키 중복이 없다.
    - `name`: 형식·길이, 폴더 이름과 같음
    - `description`: 1~1024자(따옴표 문자열이면 `JSON.parse`로 풀어서 잰다)
    - `body_size`: 머리말 아래 본문이 줄·글자 한도 이내
    - `reference`: 본문에 적힌 `references/…` 경로가 모두 패키지에 있고, `references/` 바로 아래 파일이다.
- `src/lib/export/*`는 아키텍처 가드 대상이다. 플랫폼 이름을 쓰지 않는다.

#### 가이드 화면

- `GuideArtifacts`가 skill 패키지를 만들 때 `useContextAsOf` 결과를 `asOf`로 넘긴다.
- ZIP 다운로드 버튼 근처
  - 성공하면 "공개 Agent Skills 형식 검사 통과"를 보여 준다.
  - `embeddedCore: false`이면 "문서가 길어 핵심 맥락을 skill 본문에 넣지 못했습니다. 대화 첨부 방식을 권장합니다."를 보여 준다.
  - `incompatible`이면 다운로드하지 않고 "skill 형식 검사를 통과하지 못했습니다. 대화 첨부 방식을 쓰세요."와 문제 수를 보여 준다.

#### 플랫폼 방법 추가

- 순서: 각 가이드의 기존 방법 **뒤**에 둔다. 전체 방법 목록(E6 기대값)은 다음 순서가 된다.

```text
chatgpt-project, chatgpt-chat-attachment, chatgpt-skill,
gemini-chat-attachment, gemini-skill, gemini-gem,
claude-project, claude-chat-attachment, claude-skill
```

- 공통: `status: "available"`, `requiredArtifacts: ["skill-package"]`, `verifiedAt: "2026-10-30"`
- `claude-skill`
  - `label`: "skill로 등록(고급)"
  - `officialUrl`: `https://support.claude.com/en/articles/12512180-using-skills-in-claude`
  - `availabilityNote`: "Free·Pro·Max·Team·Enterprise에서 쓸 수 있으며 코드 실행이 켜져 있어야 합니다. Team·Enterprise는 관리자가 사용자 skill을 막을 수 있습니다."
  - `steps`
    1. "skill 패키지 내려받기" / "아래에서 ZIP 패키지를 내려받습니다. 압축은 풀지 않습니다."
    2. "skill 올리기" / "Claude에서 Customize → Skills로 이동해 + → Create skill → Upload a skill을 고르고 teacher-context.zip을 올립니다."
    3. "켜고 확인하기" / "올린 skill을 켭니다. 수업 설계를 요청해 교사 맥락이 반영되는지 확인합니다."
  - `updateNote`: "Customize → Skills에서 기존 teacher-context skill을 지우고 새 teacher-context.zip을 다시 올립니다."
- `chatgpt-skill`
  - `label`: "skill로 등록(고급)"
  - `officialUrl`: `https://help.openai.com/en/articles/20001066-skills-in-chatgpt`
  - `availabilityNote`: "Business·Enterprise·Healthcare·Edu 요금제에서 워크스페이스 설정에 따라 쓸 수 있습니다. 업로드 파일 형식은 공식 문서에 적혀 있지 않습니다."
  - `steps`
    1. "skill 패키지 내려받기" / "아래에서 ZIP 패키지를 내려받습니다. 압축은 풀지 않습니다."
    2. "skill 올리기" / "ChatGPT 사이드바에서 Plugins → Skills 탭 → Create → Upload from your computer를 고르고 teacher-context.zip을 올립니다. 올린 뒤 검사가 끝나면 쓸 수 있습니다."
    3. "확인하기" / "수업 설계를 요청해 교사 맥락이 반영되는지 확인합니다. 업로드가 되지 않으면 대화 첨부 방식을 쓰세요."
  - `updateNote`: "Skills 화면에서 기존 teacher-context skill을 지우고 새 teacher-context.zip을 다시 올립니다."
- 두 `officialUrl`은 `platform-facts.md` 7절에 이미 있다(콘텐츠 테스트의 출처 확인 통과).

#### 테스트

- `SKILL.md`(핵심본 포함)
  - 머리말은 지금과 같다(`name`, `description`만, `---` 두 줄).
  - 새 도입 문단이 있다.
  - 본문 끝이 `profileToCoreMarkdown` 결과에서 머리말을 뺀 문자열과 **글자 단위로 같다.**
  - 참고 파일은 `profileToMarkdown` 결과와 바이트 단위로 같다.
  - `asOf`를 넘기면 그 날짜가, 넘기지 않으면 `contextAsOf(profile)` 날짜가 본문의 기준 시점 문단에 쓰인다.
- 한도 초과: 아주 긴 종합 항목을 가진 합성 프로필 → `embeddedCore: false`, `SKILL.md`가 지금의 파일과 같다(E5에서 옮긴 기존 도입 문단 기대 포함).
- 결정적 출력, 입력을 바꾸지 않음(기존 테스트 유지)
- `checkSkillPackage`: 정상 패키지(가상 4건, 최대 크기, 개인정보 경고 상태) 통과. 규칙별 실패 사례: 대문자·연속 하이픈·65자 이름, 폴더 불일치, 루트의 `SKILL.md`, 1025자 설명, 허용되지 않은 키, 501줄·8,001자 본문, 없는 참고 파일, 깊은 참고 경로
- 지침 전용 `SKILL.md`도 `name`·`description`·본문 규칙을 통과한다(구조 규칙 제외).
- 가이드 RTL: 검사 통과 문구, 대체 안내, `incompatible` 시 다운로드 없음, 새 방법 렌더링, 기준 시점 전달
- 아키텍처 가드(기존)가 새 파일에서도 통과

### WU-23. E2E와 문서

#### E2E (`e2e/version-history.spec.ts` 신규, chromium·mobile, 기존 `e2e/helpers.ts` 흐름 재사용)

1. 로컬 저장을 켜고 인터뷰 결과를 저장 → 다시 수정해 한 문장을 고친 뒤 확정 → 버전 기록 화면에 버전 2개, 바뀐 영역 표시 → "현재와 비교"에 이전·현재 문장이 보인다.
2. 이전 버전 복원 → 현재 확정본이 바뀌고 버전 수 유지 → 보기로 연 결과 화면 핵심본의 기준 시점이 원래 확정일
3. 초안이 있는 기록에서는 복원 버튼이 비활성화되고 이유가 보인다.
4. 결과 화면에서 핵심본 복사 → 목록에 "최근 내보낸 기록" → 다시 수정·확정 → 결과 화면에 교체 안내와 대상 표시
5. 가이드에서 skill ZIP 다운로드 → `SKILL.md`에 핵심 맥락, 참고 파일은 전체본, "형식 검사 통과" 표시
6. v1 기록을 직접 넣은 DB로 열어도 목록·보기·수정·확정이 동작하고, 확정 뒤 원시 기록이 v2이며 이력이 1건
7. 저장에 동의하지 않은 흐름에서는 DB가 생기지 않는다(기존 검사 재사용).
8. 320px에서 버전 기록 화면과 비교에 가로 넘침이 없다. 키보드로 비교 펼치기와 복원 대화상자를 조작할 수 있다.

- 기존 E2E 기대값은 3.3의 E4 외에 바꾸지 않는다.

#### 문서

- `README.md`: 로컬 저장 절에 버전 기록(이전 확정본 5개, 비교, 복원), 내보내기 기록, skill 패키지 변경(`SKILL.md`에 핵심 맥락 포함)
- `docs/privacy-design.md`, `docs/data-dictionary.md`: 기록 v2 필드(`history`, `exports`), 저장하는 것과 저장하지 않는 것(내보낸 내용·모듈 선택·외부 계정 정보는 저장하지 않음)
- `docs/product-spec.md`: 버전 관리와 skill 항목
- 개인정보 안내 화면(`src/app/privacy/page.tsx`): 로컬 저장 설명에 "이전 확정본 최대 5개와 내보내기 기록(형식·날짜·대상)도 이 브라우저에 함께 보관되며, 기록을 지우면 함께 지워집니다"를 **새 문장으로 추가**한다. 기존 문장은 바꾸지 않는다.
- 설계 문서는 고치지 않는다. 구현 중 바뀐 점은 진행 기록에만 적는다.
- 전체 관문(3.2) 통과 후 커밋하고, 진행 기록에 Phase 4 요약을 쓰고 멈춘다.

## 6. 완료 판단 (Phase 4)

- [ ] 확정할 때마다 이전 확정본이 최대 5개까지 남고, 버전 기록 화면에서 비교·복원·삭제할 수 있다.
- [ ] 버전마다 바뀐 영역이 보인다. 처음 저장·최종 수정 날짜가 보인다.
- [ ] 내보낸 기록이 남고, 확정본을 바꾼 뒤 이전 버전을 내보낸 곳이 안내된다.
- [ ] skill 패키지의 `SKILL.md`에 핵심 맥락이 들어 있고, 공개 사양 검사를 통과한다. ChatGPT·Claude 안내가 있다.
- [ ] v1 기록이 손실 없이 v2로 옮겨진다. 백업 형식, 출력 생성기, 기여, 서버가 바뀌지 않았다.
- [ ] 3.3의 E1~E6 외에 기존 테스트 기대값이 바뀌지 않았다.
- [ ] 모든 관문이 통과했다(E2E 재시도 0).

## 7. 병합 뒤 사용자 확인 (Codex 범위 밖)

- Gemini: 새 ZIP을 Replace skill로 올리고, 참고 파일을 읽지 않아도 핵심 맥락이 반영되는지 확인한다. 결과를 `platform-facts.md` 6절에 기록하고 Gemini 권장 경로를 다시 정한다.
- Claude(가능하면): 새 ZIP 업로드와 반영 확인
