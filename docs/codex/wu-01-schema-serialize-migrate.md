# Codex 작업 지시: WU-1 스키마·직렬화·마이그레이션

- 설계 근거: `docs/local-profile-design.md` (결정 사항은 9장에서 2026-10-25 확정)
- 먼저 읽을 절: 1.4, 3.4, 3.5, 4.6, 4.8, 5.4, 5.5, 6.1, 11.3
- 기준 커밋: `main` @ `bd81a2e`
- 산출물: 커밋 1개

## 1. 목표

로컬 프로파일 저장(Phase 1)에 필요한 **순수 로직만** 만든다.

- 레코드·초안·백업 파일의 Zod 스키마
- allowlist 직렬화
- 버전 마이그레이션
- 교사가 직접 추가하는 문장을 만드는 함수
- 태그 선택 변환 함수
- 핵심 로직에 플랫폼 이름이 들어가지 않게 막는 아키텍처 가드 테스트

IndexedDB 접근, React 컴포넌트, 화면 변경은 이번 작업에 포함하지 않는다. 사용자가 보는 동작은 하나도 바뀌지 않아야 한다.

## 2. 반드시 지킬 제약

1. 아래 4절에 적힌 파일만 만들거나 수정한다. 그 밖의 파일은 포맷만 바꾸는 것도 금지한다.
2. 다음은 수정하지 않는다.
   - `src/lib/export/profile-to-markdown*.ts`, `src/lib/export/profile-to-text.ts`, `src/content/profile-document.ts`: Markdown 출력은 기여·관리자 검증 계약이다.
   - `src/lib/ai/**`, `src/app/api/**`, `src/lib/consent/**`, `src/lib/supabase/**`
   - `src/lib/storage/{index,local,session,schema,restore}.ts`. 특히 `src/lib/storage/index.ts`에서 새 `profiles/*`를 다시 내보내지 않는다. `e2e/progress-resume.spec.ts`가 Node 환경에서 이 index를 import한다.
   - 기존 테스트 파일의 기존 케이스. 새 케이스를 덧붙이는 것은 허용한다.
3. 새 런타임 의존성이나 devDependency를 추가하지 않는다(`fake-indexeddb`는 WU-2에서 추가한다).
4. 새 모듈은 브라우저와 Node 양쪽에서 import할 수 있어야 한다. `server-only`, `window`·`document`·`indexedDB` 같은 전역을 모듈 최상위에서 참조하지 않는다.
5. `console.*`로 프로필 본문이나 입력값을 출력하지 않는다(AGENTS.md).
6. 공개 함수는 예상 가능한 실패에 대해 예외를 던지지 않고 결과 객체(`{ ok: true, … } | { ok: false, error }`)를 반환한다. 프로그래밍 오류(불가능한 상태)에서만 예외를 허용한다.
7. `src/types`, `src/lib/storage`, `src/lib/profile`, `src/lib/export` 안의 파일에는 AI 서비스 이름(ChatGPT, Gemini, Claude, Gem, GPTs)을 주석까지 포함해 쓰지 않는다. 예외는 가드 테스트 파일(4.8) 하나뿐이다.

## 3. 현재 코드에서 알아둘 점

- `teacherContextProfileSchema`(`src/types/profile.ts:373`)
  - strict 객체이고 `.superRefine`으로 교차 검증을 한다: 태그 중복, privacyReview 상태와 항목 일치, `needs_confirmation`+확인 금지, 모듈 7개 각 1회, claim id 전역 고유.
  - 리파인이 붙은 스키마는 `.extend()`할 수 없다(zod 4.4.3). 그래서 초안 스키마는 아래처럼 기본 조각으로 새로 조립한다.
  - 공개된 조각: `teacherContextProfileOutputSchema.shape.metadata`, `machineIdentifierSchema`, `evidenceBasisSchema`, `profileModuleIdSchema`, `confirmedTagsInputSchema`, `privacyReviewOutputSchema`, `PROFILE_MODULE_IDS`, `CONTROLLED_TAGS`.
- `nonBlankText`는 `.trim()`을 포함하므로 파싱 결과가 공백 제거된 값이 된다. 확정본은 이 정규화를 그대로 따른다. **초안은 trim하지 않는다**(입력 중인 공백 보존).
- `PENDING_PRIVACY_REVIEW`는 현재 `src/components/profile/profile-review.tsx:147-156`의 지역 상수다.
- 태그 키 형식은 `${category}:${tag}`이다(`profile-review.tsx:648`, `:1542`). 새 헬퍼도 반드시 같은 형식을 쓴다.
- `SuggestedTag` 타입과 `suggestedTagSchema`는 `@/lib/ai/schemas/profile`에 있다. 이 모듈은 zod와 `@/types/profile`만 import하므로 클라이언트에서도 써도 된다.
- 테스트 고정 데이터로는 `FICTIONAL_PROFILES`(`@/content/examples`, 4건, 모두 확인 완료·`clear` 상태)를 쓴다. `src/types/profile.test.ts`의 `fictionalProfile()` 패턴을 참고한다.

## 4. 작업 내용

### 4.1 `src/types/profile.ts` (수정)

1. **교차 검증 추출**
   - `teacherContextProfileSchema`의 `.superRefine` 본문을 `export function refineTeacherContextProfile(profile, context: z.RefinementCtx): void`로 옮긴다.
   - `teacherContextProfileSchema`는 `.superRefine(refineTeacherContextProfile)`로 바꾼다.
   - 인자 타입은 이 함수가 실제로 읽는 필드만 담은 구조적 타입으로 정의한다(`confirmedTags`, `privacyReview.status/items`, `modules[].id`, `modules[].claims[].id/basis/confirmedByUser`). 그래야 초안 스키마도 같은 함수를 쓸 수 있다.
   - **검사 순서, 메시지 문자열, `path`는 한 글자도 바꾸지 않는다.**
2. **검사 대기 상태 상수 이동**
   - `profile-review.tsx`의 `PENDING_PRIVACY_REVIEW`를 값 그대로 옮겨 `export const PENDING_PRIVACY_REVIEW: PrivacyReview`로 둔다. 위치는 `UNVERIFIED_PRIVACY_REVIEW` 바로 아래다.
   - `export function isPendingPrivacyReview(review: PrivacyReview): boolean`을 추가한다. 구현은 `isUnverifiedPrivacyReview`와 같은 방식으로 status와 단일 항목의 세 문자열을 모두 비교한다.
   - JSDoc 한 줄: 편집 직후 최종 검사를 다시 받아야 하는 초안 상태이며 내보내기·기여 차단이 그대로 적용된다.

### 4.2 `src/components/profile/profile-review.tsx` (수정, 최소)

- 147-156행의 지역 상수를 지우고 `@/types/profile`에서 `PENDING_PRIVACY_REVIEW`를 import한다.
- `markPrivacyReviewPending`과 그 밖의 코드는 그대로 둔다. 이 파일의 다른 변경은 금지한다.

### 4.3 `src/lib/storage/profiles/schema.ts` (신규)

상수:

```ts
export const LOCAL_PROFILE_DB_NAME = "tcontext-local-profiles";
export const LOCAL_PROFILE_DB_VERSION = 1;
export const LOCAL_PROFILE_STORAGE_SCHEMA_VERSION = 1;
export const MAX_LOCAL_PROFILES = 10;
export const MAX_DRAFT_TEXT_LENGTH = 20_000;
// 통제 어휘 전체 개수. CONTROLLED_TAGS에서 계산한다(현재 41). 하드코딩하지 않는다.
export const MAX_SUGGESTED_TAGS: number;
export const PROFILE_BACKUP_FORMAT = "tcontext.teacher-profile-backup";
export const PROFILE_BACKUP_FORMAT_VERSION = 1;
```

함수:

- `export function isSupportedProfileSchemaVersion(version: string): boolean`: `/^1(?:\.\d+)*$/u`이면 true다. 현재 서버 값은 `"1.0"`이다.

스키마(모두 `.strict()`):

1. **`localDraftProfileSchema`**: canonical과 같은 구조이고 텍스트 제약만 완화한다.
   - 텍스트(`profileTitle`, `shortSummary`, 모듈 `title`·`summary`, claim `text`, 종합 목록 4종의 각 항목): `z.string().max(MAX_DRAFT_TEXT_LENGTH)`. trim도 min도 걸지 않는다.
   - `metadata`: `teacherContextProfileOutputSchema.shape.metadata`(엄격 그대로)
   - claim: `id`(`machineIdentifierSchema`), `text`, `basis`(`evidenceBasisSchema`), `evidenceQuestionIds`(`z.array(machineIdentifierSchema).min(1)`), `confirmedByUser`(`z.boolean()`)
   - `modules`: 길이는 `PROFILE_MODULE_IDS.length`
   - `confirmedTags`: `confirmedTagsInputSchema`, `privacyReview`: `privacyReviewOutputSchema`
   - 마지막에 `.superRefine(refineTeacherContextProfile)`
   - `export type LocalDraftProfile = z.output<typeof localDraftProfileSchema>`
2. **`localProfileSettingsSchema`**: `{ key: z.literal("settings"), enabledAt: z.iso.datetime(), storageSchemaVersion: z.literal(1) }`. WU-2에서 쓴다.
3. **`localProfileRecordSchema`**

   ```ts
   {
     id: z.uuid(),
     storageSchemaVersion: z.literal(1),
     createdAt: z.iso.datetime(),
     updatedAt: z.iso.datetime(),
     revision: z.number().int().min(1),
     origin: z.enum(["interview", "import"]),
     suggestedTags: z.array(suggestedTagSchema).max(MAX_SUGGESTED_TAGS),
     confirmed: z.object({ profile: teacherContextProfileSchema, confirmedAt: z.iso.datetime() }).strict().nullable(),
     draft: z.object({
       profile: localDraftProfileSchema,
       baseConfirmedAt: z.iso.datetime().nullable(),
       updatedAt: z.iso.datetime(),
     }).strict().nullable(),
   }
   ```

   `.superRefine` 교차 검증:
   - `confirmed`와 `draft`가 둘 다 `null`이면 오류
   - `confirmed.profile.privacyReview`가 검사 대기 상태(`isPendingPrivacyReview`)이면 오류: 확정본은 검사 결과를 가진다.
   - `draft.profile.privacyReview`가 검사 대기 상태가 아니면 오류: 초안에는 이전 검사 항목(지적된 원문 사본)을 남기지 않는다.
   - `suggestedTags`에 같은 `tagKey`가 두 번 있으면 오류
   - `confirmed`와 `draft.profile`의 `metadata.schemaVersion`이 `isSupportedProfileSchemaVersion`을 통과하지 않으면 오류

   `export type LocalProfileRecord = z.output<typeof localProfileRecordSchema>`

4. **`profileBackupFileSchema`**: `z.discriminatedUnion("kind", [...])`
   - 공통 필드: `format: z.literal(PROFILE_BACKUP_FORMAT)`, `formatVersion: z.literal(PROFILE_BACKUP_FORMAT_VERSION)`, `exportedAt: z.iso.datetime()`, `recordId: z.uuid().optional()`, `suggestedTags`(레코드와 같은 규칙)
   - `kind: "confirmed"` → `profile: teacherContextProfileSchema`
   - `kind: "draft"` → `profile: localDraftProfileSchema`
   - 백업 형식에는 플랫폼 관련 필드를 넣지 않는다(설계 6.1, 11.3).
   - `export type ProfileBackupFile = z.output<typeof profileBackupFileSchema>`

### 4.4 `src/lib/profile/tags.ts` (신규)

```ts
export function tagKey(tag: {
  category: ControlledTagCategory;
  tag: string;
}): string;
// CONTROLLED_TAGS의 카테고리 순서, 배열 순서를 그대로 따른다.
export function suggestedTagsFromConfirmedTags(
  tags: ConfirmedTags,
): SuggestedTag[];
// tagKey 기준으로 중복을 제거하고 처음 나온 순서를 유지한다.
export function mergeSuggestedTags(
  ...lists: ReadonlyArray<readonly SuggestedTag[]>
): SuggestedTag[];
export function selectedTagKeysFromConfirmedTags(
  tags: ConfirmedTags,
): Set<string>;
// = confirmedTagsFromCandidates(mergeSuggestedTags(suggested) × selectedKeys).
// suggested에 없는 키는 무시한다(현재 completeReview와 같은 의미).
export function confirmedTagsFromSelection(
  suggested: readonly SuggestedTag[],
  selectedKeys: Iterable<string>,
): ConfirmedTags;
```

- 이번 WU에서는 `profile-review.tsx`의 태그 로직을 바꾸지 않는다(WU-4에서 교체한다).
- 대신 테스트로 "현재 `completeReview`(645-650행)의 인라인 계산 결과와 `confirmedTagsFromSelection` 결과가 같다"는 동치성을 고정한다.

### 4.5 `src/lib/profile/changes.ts` (신규)

```ts
export const TEACHER_AUTHORED_EVIDENCE_ID = "teacher-authored";

export function createTeacherAuthoredClaim(
  moduleId: ProfileModuleId,
  existingClaimIds: Iterable<string>,
  randomId: () => string = () => crypto.randomUUID(),
): ProfileClaim;

export function isTeacherAuthoredClaim(
  claim: Pick<ProfileClaim, "evidenceQuestionIds">,
): boolean;
```

`createTeacherAuthoredClaim`:

- id: `${moduleId}:teacher:${randomId()에서 하이픈을 지운 앞 8자}`
  - 기존 id와 겹치면 최대 10번 다시 만든다. 그래도 겹치면 `Error`를 던진다(프로그래밍 오류).
  - 결과 id는 `machineIdentifierSchema`를 통과해야 한다.
- 나머지 값: `text: ""`, `basis: "direct"`, `evidenceQuestionIds: [TEACHER_AUTHORED_EVIDENCE_ID]`, `confirmedByUser: false`
- 인터뷰 질문 id를 지어내지 않는다. 기존 claim의 `basis`와 `evidenceQuestionIds`를 바꾸는 함수는 만들지 않는다.
- `diffProfiles`는 WU-7 범위이므로 이번에 만들지 않는다.

### 4.6 `src/lib/storage/profiles/serialize.ts` (신규)

모든 함수는 입력 객체를 펼쳐(`...`) 복사하지 않는다. **필드를 하나씩 명시해 새 객체를 만든 뒤 스키마로 검증한다.** 입력에 `answers`, `privacyReviewToken`, `contributionReceipt` 같은 필드가 섞여 들어와도 결과에 나타날 수 없게 하기 위해서다. 참고 패턴: `src/lib/storage/schema.ts`의 `toStoredInterviewProgress`.

```ts
export type ConfirmedSnapshot = NonNullable<LocalProfileRecord["confirmed"]>;
export type DraftSnapshot = NonNullable<LocalProfileRecord["draft"]>;
export type SerializeError =
  "invalid_profile" | "not_finalized" | "invalid_draft";

export function toConfirmedSnapshot(
  profile: TeacherContextProfile,
  now: string,
):
  | { ok: true; snapshot: ConfirmedSnapshot }
  | { ok: false; error: SerializeError };
```

- 명시적으로 재구성한 뒤 `teacherContextProfileSchema`로 파싱한다. 결과는 trim된 canonical 값이다.
- privacyReview가 검사 대기 상태이면 `not_finalized`, 스키마 실패면 `invalid_profile`을 반환한다.
- privacyReview는 확정 시점의 값(`clear`, 실제 경고, 확인 안 됨)을 그대로 보존한다.

```ts
export function toDraftSnapshot(input: {
  profile: TeacherContextProfile;
  suggestedTags: readonly SuggestedTag[];
  selectedTagKeys: Iterable<string>;
  baseConfirmedAt: string | null;
  now: string;
}):
  { ok: true; snapshot: DraftSnapshot } | { ok: false; error: SerializeError };
```

- `privacyReview`는 항상 `PENDING_PRIVACY_REVIEW`의 **새 복사본**으로 바꾼다.
- `confirmedTags`는 `confirmedTagsFromSelection(mergeSuggestedTags(suggestedTags, suggestedTagsFromConfirmedTags(profile.confirmedTags)), selectedTagKeys)`로 만든다.
- 결과는 `localDraftProfileSchema`로 검증하고, 실패하면 `invalid_draft`를 반환한다.

```ts
export type EditableLocalProfileSession = {
  recordId: string;
  revision: number;
  profile: TeacherContextProfile; // draft?.profile ?? confirmed.profile 의 structuredClone
  baseline: TeacherContextProfile | null; // confirmed?.profile 의 structuredClone
  suggestedTags: SuggestedTag[]; // mergeSuggestedTags(record.suggestedTags, suggestedTagsFromConfirmedTags(profile.confirmedTags))
  source: "draft" | "confirmed";
};
export function toEditableSession(
  record: LocalProfileRecord,
): EditableLocalProfileSession;
```

- 결과 객체가 `record` 내부 객체와 참조를 공유하지 않아야 한다(테스트로 확인).

### 4.7 `src/lib/storage/profiles/migrate.ts` (신규)

```ts
export type RecordMigrationResult =
  | { ok: true; record: LocalProfileRecord; migrated: boolean }
  | {
      ok: false;
      error: "corrupted" | "unsupported_version";
      id: string | null;
    };

export function migrateLocalProfileRecord(raw: unknown): RecordMigrationResult;
```

- `raw`가 객체이고 `id`가 문자열이면 실패 결과에도 그 id를 돌려준다. WU-2와 WU-6이 손상 항목을 목록에 표시하고 삭제할 때 쓴다.
- `storageSchemaVersion`이 숫자이고 현재보다 크면 `unsupported_version`을 반환한다. 미래 앱이 쓴 레코드이므로 보존 대상이다.
- 버전별 업그레이드 함수 표(`Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>`)와 반복 적용 구조를 둔다. 현재는 비어 있으며 v1을 그대로 검증한다.
- 최종 결과는 반드시 `localProfileRecordSchema`로 검증한다. 실패하면 `corrupted`를 반환한다.

```ts
export type BackupMigrationError =
  | "not_object"
  | "unknown_format"
  | "unsupported_format_version"
  | "invalid_backup"
  | "unsupported_profile_schema";

export function migrateBackupFile(
  raw: unknown,
  now: string,
):
  | {
      ok: true;
      backup: ProfileBackupFile;
      source: "backup_v1" | "bare_profile";
    }
  | { ok: false; error: BackupMigrationError };
```

판정 순서:

1. 일반 객체가 아니면 `not_object`
2. `format === PROFILE_BACKUP_FORMAT`인 경우
   - `formatVersion`이 숫자이고 지원 버전보다 크면 `unsupported_format_version`
   - 그 밖에는 `profileBackupFileSchema`로 검증하고 실패하면 `invalid_backup`
3. `format` 키가 없고 `teacherContextProfileSchema`를 통과하면 순수 프로파일 JSON(v0)으로 보고 `{ format, formatVersion: 1, exportedAt: now, kind: "confirmed", profile, suggestedTags: [] }`로 감싼다(`source: "bare_profile"`).
4. 그 밖에는 `unknown_format`
5. 성공 후보의 `profile.metadata.schemaVersion`이 `isSupportedProfileSchemaVersion`을 통과하지 않으면 `unsupported_profile_schema`

- 파일 크기 검사, `JSON.parse`, privacyReview를 검사 대기로 바꾸는 정규화는 WU-3(`backup.ts`) 범위다. 여기서 하지 않는다.

### 4.8 `src/lib/export/platform-neutral.test.ts` (신규, 아키텍처 가드)

- 첫 줄에 `// @vitest-environment node`를 둔다.
- 저장소 루트를 `import.meta.url` 기준으로 계산한다(cwd에 의존하지 않음).
- 검사 대상: `src/types`, `src/lib/export`, `src/lib/storage`, `src/lib/profile` 아래의 모든 `.ts`·`.tsx` 파일. 이 테스트 파일 자신은 제외한다. 존재하지 않는 폴더는 건너뛴다.
- 패턴: `/\b(?:ChatGPT|Gemini|Claude|Gems?|GPTs)\b/i`
- 케이스
  1. 대상 파일 어디에도 패턴이 없다. 실패하면 파일 경로와 줄 번호를 메시지에 담는다.
  2. 패턴 자체의 자기 검증: `"ChatGPT에 등록"`, `"gemini"`, `"Claude 프로젝트"`, `"새 Gem"`, `"GPTs"`는 걸리고, `"generate"`, `"agent"`, `"engine"`, `"gemstone"`은 걸리지 않는다.
- 현재 저장소에서는 대상 폴더에 일치하는 문자열이 없음을 확인했다(`src/lib/ai`와 `src/content`, `src/app`은 대상이 아니다).

## 5. 테스트

새 테스트 파일:

| 파일                                         | 반드시 포함할 케이스                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/storage/profiles/schema.test.ts`    | ① `FICTIONAL_PROFILES` 4건, `teachingSubject`를 지운 구형 프로필, `UNVERIFIED_PRIVACY_REVIEW`나 실제 경고를 가진 프로필이 확정본 레코드로 통과한다. ② 초안 스키마가 빈 claim·제목·요약·목록 항목을 허용하고 공백을 보존한다. ③ 초안 스키마가 모듈 누락·중복, claim id 중복, 알 수 없는 키, `needs_confirmation`+확인, 빈 `evidenceQuestionIds`, 20,001자 텍스트를 거절한다. ④ 레코드: 둘 다 null, 확정본이 검사 대기, 초안이 검사 대기가 아님, 태그 중복, 지원하지 않는 schemaVersion(`"2.0"`), 잘못된 uuid를 거절한다. ⑤ 백업 파일 두 kind가 통과하고 알 수 없는 키를 거절한다. ⑥ 타입 검사: `expectTypeOf<LocalDraftProfile>().toEqualTypeOf<TeacherContextProfile>()` (같지 않으면 최소 `toMatchTypeOf`, 사유를 보고). |
| `src/lib/storage/profiles/serialize.test.ts` | ① 확정본 스냅샷은 privacyReview를 보존하고 trim된다. 검사 대기 상태는 `not_finalized`. ② 초안 스냅샷은 privacyReview를 항상 검사 대기로 바꾸고, 반환된 privacyReview를 수정해도 `PENDING_PRIVACY_REVIEW` 상수가 변하지 않는다. ③ 프로필에 `answers`, `privacyReviewToken`, `contributionReceipt`, `refineInstructions`, `synthesisConfirmed`, `privacyWarningAccepted` 필드를 덧붙여(`as unknown as`) 넣어도 `JSON.stringify(snapshot)`에 그 키와 값이 없다. 개인정보 검사 항목 원문(예: 가상 이름 문장)도 초안에 남지 않는다. ④ 태그 선택이 `confirmedTags`에 반영되고, 기존 `confirmedTags`의 태그도 선택 키가 있으면 유지된다. ⑤ `toEditableSession`의 draft 우선 규칙, baseline, 태그 병합, 참조 비공유.              |
| `src/lib/storage/profiles/migrate.test.ts`   | ① v1 레코드 통과(`migrated: false`). ② `storageSchemaVersion: 2` → `unsupported_version` + id. ③ 깨진 객체 → `corrupted` + id, id가 없으면 `null`. ④ `null`·배열·문자열 → 예외 없이 실패 결과. ⑤ 백업: v1 통과, 순수 프로파일 → `bare_profile`이고 `exportedAt === now`, `formatVersion: 2` → `unsupported_format_version`, 다른 `format` → `unknown_format`, strict 위반 → `invalid_backup`, schemaVersion `"2.0"` → `unsupported_profile_schema`.                                                                                                                                                                                                                                                                       |
| `src/lib/profile/tags.test.ts`               | ① 키 형식. ② 순서와 중복 제거. ③ `confirmedTags` → 제안 → 선택 → `confirmedTags` 왕복이 같다. ④ 현재 `profile-review.tsx` 645-650행의 인라인 계산과 결과가 같다(같은 식을 테스트 안에 재현해 비교). ⑤ 목록에 없는 선택 키는 무시한다.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/lib/profile/changes.test.ts`            | ① 생성 claim의 필드 값. ② id가 `machineIdentifierSchema`를 통과한다. ③ 충돌하는 `randomId`를 주입하면 재시도하고, 계속 충돌하면 예외를 던진다. ④ 생성된 claim을 프로필에 넣고 텍스트를 채우면 `teacherContextProfileSchema`를 통과한다. ⑤ `isTeacherAuthoredClaim`.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/lib/export/platform-neutral.test.ts`    | 4.8절 참조                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

기존 테스트에 추가할 케이스:

- `src/types/profile.test.ts`
  - `isPendingPrivacyReview`가 `PENDING_PRIVACY_REVIEW`에는 true, `UNVERIFIED_PRIVACY_REVIEW`와 `clear`에는 false다.
  - 추출한 `refineTeacherContextProfile`을 거쳐도 기존 오류 메시지와 path가 그대로다. 대표 3가지(태그 중복, `needs_confirmation`+확인, 모듈 누락)의 `issues`를 스냅샷 없이 직접 비교한다.

## 6. 완료 조건

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`가 통과한다. `profile-review.tsx`를 건드렸으므로 가능하면 `pnpm build`도 실행한다.
- [ ] 기존 테스트 파일의 기존 케이스는 수정 없이 통과한다.
- [ ] `git diff --stat`에 4절의 파일과 5절의 테스트 파일만 나온다.
- [ ] 화면, API, Markdown 출력, 기존 저장 키(`tcontext:*`)에 변화가 없다.
- [ ] 새 파일의 공개 함수는 예상 가능한 실패를 결과 객체로 반환하고 예외를 던지지 않는다(2절 6번).
- [ ] 가드 테스트가 통과하고, 패턴 자기 검증 케이스도 통과한다.

## 7. 커밋

- 메시지(저장소의 기존 스타일): `Add local profile record schemas, serializers, and migrations`
- 본문에 한 줄씩 적는다: 교차 검증 추출(동작 동일), 검사 대기 상수 이동, 플랫폼 이름 가드 추가.

## 8. 작업 후 보고

다음을 짧게 보고한다. Claude가 이 보고와 실제 diff를 함께 리뷰한다.

1. 만든 파일과 수정한 파일 목록
2. 각 명령의 결과(통과·실패, 테스트 수)
3. 지시와 다르게 구현한 부분과 그 이유. 특히 `LocalDraftProfile`과 `TeacherContextProfile`의 타입이 완전히 같지 않은 경우
4. WU-2 이후에 영향을 줄 수 있는 발견 사항이나 질문
