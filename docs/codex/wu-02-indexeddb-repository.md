# Codex 작업 지시: WU-2 IndexedDB 저장 계층

- 설계 근거: `docs/local-profile-design.md`
- 먼저 읽을 절: 3.1~3.7, 4.2, 5.5
- 선행 작업: WU-1(`fef2c9a`), WU-1a(직렬화·버전 판별 보강). **WU-1a 커밋 위에서 시작한다.**
- 산출물: 커밋 1개

## 1. 목표

교사가 동의한 경우에만 IndexedDB에 로컬 프로파일 기록을 만들고, 읽고, 고치고, 지우는 저장 계층을 만든다.

- 동의 전에는 데이터베이스를 만들지 않는다.
- 쓰기는 모두 스키마 검증과 revision 비교를 통과한 경우에만 원자적으로 반영한다.
- 실패는 예외가 아니라 오류 코드로 돌려준다. 손상되었거나 미래 버전인 기록은 덮어쓰지 않는다.

React Provider, 화면, 자동 저장 훅은 만들지 않는다(WU-4 이후). 이번 작업이 끝나도 사용자가 보는 동작은 바뀌지 않는다.

## 2. 제약

1. 만들거나 수정할 수 있는 파일
   - 신규: `src/lib/storage/profiles/database.ts`, `src/lib/storage/profiles/repository.ts`와 각각의 테스트 파일(`database.test.ts`, `repository.test.ts`, 하나로 합쳐도 된다)
   - 수정: `package.json`, `pnpm-lock.yaml`(devDependency 추가만)
2. `schema.ts`, `serialize.ts`, `migrate.ts`, `tags.ts`, `changes.ts`, `src/types/**`, `src/components/**`, `src/app/**`, `src/lib/storage/index.ts`는 수정하지 않는다. 앞 작업의 함수에 결함을 발견하면 고치지 말고 보고한다.
3. 의존성
   - devDependency로 `fake-indexeddb`를 **`6.2.5` 정확한 버전**으로 추가한다: `corepack pnpm add -D -E fake-indexeddb@6.2.5`
   - 최신 6.2.6은 2026-10-16에 배포되어 아직 사용 기간이 짧다. 그래서 1년 가까이 쓰인 6.2.5를 쓴다.
   - 런타임 의존성(`idb` 등)은 추가하지 않는다.
4. 테스트에서 `fake-indexeddb/auto`나 `vitest.setup.ts` 전역 주입을 쓰지 않는다. 테스트마다 `new IDBFactory()`를 만들어 함수 인자로 주입한다. 다른 테스트에 IndexedDB가 생기지 않게 하기 위해서다.
5. 모듈 최상위에서 `indexedDB`, `window`, `BroadcastChannel`, `crypto`를 참조하지 않는다. 함수 안에서만 접근한다(SSR과 Node import 안전).
6. `console.*` 금지, 플랫폼 이름 금지, 공개 함수는 예상 가능한 실패에 예외를 던지지 않는다(WU-1 공통 제약).
7. 원문 답변, 서명 토큰, 기여 영수증 같은 값은 이 계층에 들어올 경로가 없어야 한다. 입력은 WU-1의 스냅샷 타입만 받고, 모든 쓰기 전에 `localProfileRecordSchema`로 전체 기록을 검증한다.

## 3. IndexedDB 사용 규칙

- **연결 수명**: 연산마다 열고, 트랜잭션이 끝나면 `db.close()`한다. 연결을 모듈 전역에 붙잡아 두지 않는다. 그래야 다른 탭의 삭제·업그레이드가 막히지 않는다.
- **`onversionchange`**: 연 연결에는 항상 `db.onversionchange = () => db.close()`를 단다.
- **트랜잭션 안에서 `await` 금지**: IndexedDB 요청 사이에 다른 Promise를 기다리면 트랜잭션이 자동 커밋되어 `TransactionInactiveError`가 난다. 한 트랜잭션 안의 get → 검증 → put은 `onsuccess` 콜백 안에서 **동기적으로** 이어서 처리한다. 바깥 Promise는 `transaction.oncomplete`에서 성공으로, `onabort`·`onerror`에서 실패로 resolve한다.
- **성공 판정 시점**: 요청 `onsuccess`가 아니라 `transaction.oncomplete`다. 디스크 반영까지 기다리기 위해서다.
- **트랜잭션 내구성**: 기록 생성·확정본 저장·삭제는 `db.transaction(stores, "readwrite", { durability: "strict" })`, 초안 저장은 기본값으로 연다. 옵션을 지원하지 않는 구현은 무시하므로 그대로 둔다.
- **오류 이름 → 코드**: 아래 변환 함수를 export하고 단위 테스트한다.

```ts
export function toLocalProfileErrorCode(error: unknown): LocalProfileErrorCode;
// QuotaExceededError → "quota_exceeded"
// ConstraintError    → "conflict"
// VersionError       → "unsupported_version"
// 그 밖(InvalidStateError, SecurityError, UnknownError, AbortError, 알 수 없는 값) → "unavailable"
```

## 4. `database.ts`

```ts
export const PROFILE_STORE = "profiles";
export const META_STORE = "meta";
export const PROFILE_UPDATED_AT_INDEX = "updatedAt";

export type LocalProfileIdbFactory = Pick<
  IDBFactory,
  "open" | "deleteDatabase"
> & {
  databases?: () => Promise<IDBDatabaseInfo[]>;
};

/** `indexedDB`가 없거나 접근 자체가 SecurityError를 던지면 null. */
export function browserIdbFactory(): LocalProfileIdbFactory | null;

export type OpenDatabaseResult =
  | { ok: true; db: IDBDatabase }
  | { ok: false; error: "unavailable" | "disabled" | "unsupported_version" };

/** 데이터베이스를 절대 만들지 않는다. */
export function openExistingDatabase(
  factory: LocalProfileIdbFactory,
): Promise<OpenDatabaseResult>;
/** 교사가 저장을 켠 경우에만 호출한다. */
export function openOrCreateDatabase(
  factory: LocalProfileIdbFactory,
): Promise<OpenDatabaseResult>;

export function deleteLocalProfileDatabase(
  factory: LocalProfileIdbFactory,
  options?: { blockedTimeoutMs?: number }, // 기본 3000
): Promise<{ ok: true } | { ok: false; error: "blocked" | "unavailable" }>;
```

### 4.1 스키마 업그레이드(공용 내부 함수)

- DB 버전은 `LOCAL_PROFILE_DB_VERSION`(1)이다.
- `oldVersion < 1`이면 다음을 만든다(`objectStoreNames.contains`로 중복 방지).
  - `profiles` store: keyPath `id`, index `updatedAt`(keyPath `updatedAt`, unique 아님)
  - `meta` store: keyPath `key`

### 4.2 `openExistingDatabase`

1. `factory.databases`가 있으면 호출한다. 목록에 `LOCAL_PROFILE_DB_NAME`이 없으면 열지 않고 `disabled`를 반환한다. `databases()`가 예외를 던지면 2단계로 넘어간다.
2. `factory.open(LOCAL_PROFILE_DB_NAME, LOCAL_PROFILE_DB_VERSION)`로 **버전을 명시해** 연다.
   - `onupgradeneeded`에서 `oldVersion === 0`이면(존재하지 않던 DB) `request.transaction.abort()`로 생성을 취소하고 `disabled`를 반환한다.
   - `oldVersion > 0`이면(미래의 하위 버전 DB) 4.1 업그레이드를 실행한다.
   - `VersionError`(저장된 DB가 더 새 버전)이면 `unsupported_version`이다.
   - `factory.open` 자체가 예외를 던지면(일부 프라이빗 모드) `unavailable`이다.
3. 성공하면 `onversionchange`를 달고 반환한다.

> 업그레이드를 중단한 뒤 DB가 남지 않는지는 테스트로 반드시 확인한다(6절). fake-indexeddb와 실제 브라우저 동작이 다를 수 있으므로, 실제 브라우저 확인은 WU-9 E2E(#10)에서 한다.

### 4.3 `deleteLocalProfileDatabase`

- `deleteDatabase` 요청이 `onsuccess`면 `ok`다.
- `onblocked`가 오면 `blockedTimeoutMs` 타이머를 시작한다. 그 안에 성공하면 `ok`, 아니면 `blocked`다.
- `blocked`를 돌려준 뒤에도 요청은 살아 있다. 다른 연결이 닫히면 나중에 삭제가 완료될 수 있다(4.2의 `onversionchange`로 다른 탭 연결은 곧 닫힌다).

## 5. `repository.ts`

### 5.1 공통 타입과 옵션

```ts
export type LocalProfileAvailability =
  "unavailable" | "disabled" | "enabled" | "unsupported_version";

export type LocalProfileErrorCode =
  | "unavailable"
  | "disabled"
  | "unsupported_version"
  | "quota_exceeded"
  | "conflict"
  | "corrupted"
  | "not_found"
  | "limit_reached"
  | "blocked"
  | "invalid";

export type LocalProfileResult<T> =
  { ok: true; value: T } | { ok: false; error: LocalProfileErrorCode };

export type LocalProfileRepositoryOptions = {
  factory?: LocalProfileIdbFactory | null; // 기본: browserIdbFactory()
  now?: () => string; // 기본: () => new Date().toISOString()
  randomId?: () => string; // 기본: () => crypto.randomUUID()
  notify?: () => void; // 기본: notifyLocalProfilesChanged
};

export const LOCAL_PROFILES_CHANNEL = "tcontext:local-profiles";
/** BroadcastChannel이 있으면 {type:"changed"}만 보내고 바로 닫는다. 본문은 절대 보내지 않는다. */
export function notifyLocalProfilesChanged(): void;
```

- `factory`가 `null`이거나 `randomId`·`now`가 예외를 던지면 `unavailable`을 반환한다(예: 보안 컨텍스트가 아니어서 `crypto.randomUUID`가 없는 경우).
- `notify`는 **쓰기가 커밋된 뒤에만** 한 번 호출하고, 실패한 연산에서는 호출하지 않는다.

### 5.2 목록 항목

```ts
export type LocalProfileListItem =
  | {
      kind: "record";
      id: string;
      revision: number;
      origin: "interview" | "import";
      title: string; // (draft ?? confirmed).profile.profileTitle. 빈 문자열일 수 있다
      schoolLevel: SchoolLevel;
      role: string;
      teachingSubject?: TeachingSubject; // 없으면 키 자체를 생략
      createdAt: string;
      updatedAt: string;
      confirmedAt: string | null;
      hasDraft: boolean;
      privacyStatus: "clear" | "warning" | "unverified" | null; // 확정본 기준, 확정본이 없으면 null
    }
  | { kind: "corrupted"; id: string | null }
  | { kind: "unsupported"; id: string | null };
```

- `privacyStatus`는 다음과 같이 정한다: 확정본의 `privacyReview.status`가 `clear`이면 `"clear"`, `isUnverifiedPrivacyReview`이면 `"unverified"`, 그 밖의 `needs_review`이면 `"warning"`.
- `id`는 저장소의 primary key가 문자열일 때 그 값이다. 아니면 `null`이며, 이런 항목은 전체 삭제로만 지울 수 있다.
- 정렬: `kind: "record"`는 `updatedAt` 내림차순으로 앞에 두고, `corrupted`와 `unsupported`는 뒤에 둔다. **인덱스가 아니라 store 전체 커서로 읽는다.** 손상된 기록은 `updatedAt`이 없어 인덱스에서 빠지기 때문이다.

### 5.3 함수

모든 함수의 마지막 인자는 `options?: LocalProfileRepositoryOptions`다.

| 함수                                                                                 | 동작                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getLocalProfileAvailability()` → `Promise<LocalProfileAvailability>`                | `openExistingDatabase`만 사용한다(생성 금지). DB가 열리면 `meta`의 `settings`를 읽어 `localProfileSettingsSchema`를 통과하면 `enabled`, 없거나 무효이면 `disabled`다. 읽기만 하고 아무것도 쓰지 않는다.                                                                                                                                                                                                                                                                                                                                         |
| `enableLocalProfiles()` → `Result<{ enabledAt: string }>`                            | `openOrCreateDatabase` 후 `settings`가 유효하면 기존 `enabledAt`을 유지하고, 없거나 무효이면 새로 쓴다. 이미 켜져 있으면 쓰지 않고 성공을 돌려준다(이때는 `notify`도 생략).                                                                                                                                                                                                                                                                                                                                                                     |
| `listLocalProfiles()` → `Result<LocalProfileListItem[]>`                             | 켜져 있지 않으면 `disabled`, `unavailable`, `unsupported_version` 오류다. 각 값을 `migrateLocalProfileRecord`로 판정해 5.2 형식으로 만든다. 읽기 전용이며 지연 기록(write-back)도 하지 않는다.                                                                                                                                                                                                                                                                                                                                                  |
| `getLocalProfile(id)` → `Result<LocalProfileRecord>`                                 | 없으면 `not_found`, 마이그레이션 결과에 따라 `corrupted` 또는 `unsupported_version`이다.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `createLocalProfile(input)` → `Result<{ id: string; revision: 1; savedAt: string }>` | `input`은 `{ origin: "interview"; confirmed: ConfirmedSnapshot; suggestedTags }` 또는 `{ origin: "import"; draft: DraftSnapshot; suggestedTags }`다. 켜져 있어야 한다(아니면 `disabled`). **한 readwrite 트랜잭션에서** `count()`(손상·미래 기록 포함)가 `MAX_LOCAL_PROFILES` 이상이면 `limit_reached`, 아니면 새 기록을 만들어 검증 후 `add`한다(`put` 금지, 같은 id 충돌 시 `ConstraintError` → `conflict`). 새 기록: `revision: 1`, `createdAt = updatedAt = now()`, 반대편 칸은 `null`, `suggestedTags`는 `mergeSuggestedTags`로 중복 제거. |
| `saveDraft(id, input)` → `Result<{ revision: number; savedAt: string }>`             | `input = { draft: DraftSnapshot; expectedRevision: number; suggestedTags?: readonly SuggestedTag[] }`. 한 트랜잭션에서 get → `migrateLocalProfileRecord` → 실패면 그 코드(쓰기 없음) → `revision !== expectedRevision`이면 `conflict`(쓰기 없음) → `draft` 교체, `suggestedTags = merge(기존, 입력)`, `revision + 1`, `updatedAt = now()` → 전체 검증 → `put`.                                                                                                                                                                                  |
| `saveConfirmed(id, input)` → `Result<{ revision: number; savedAt: string }>`         | `input = { confirmed: ConfirmedSnapshot; expectedRevision: number; suggestedTags?: … }`. `saveDraft`와 같은 절차로 `confirmed`를 교체하고 **`draft`는 `null`**로 만든다(확정본 승격을 한 트랜잭션으로 처리).                                                                                                                                                                                                                                                                                                                                    |
| `discardDraft(id, input)` → `Result<{ deleted: boolean; revision: number \| null }>` | `input = { expectedRevision: number }`. 같은 절차로 확인한 뒤, 확정본이 있으면 `draft = null`, `revision + 1`, 결과 `{ deleted: false, revision }`이다. 확정본이 없으면(가져온 초안만 있는 기록) 기록을 삭제하고 `{ deleted: true, revision: null }`이다. 초안이 이미 없으면 쓰지 않고 성공(`deleted: false`, 현재 revision)을 돌려준다.                                                                                                                                                                                                        |
| `deleteLocalProfile(id)` → `Result<{ deleted: boolean }>`                            | 기록이 손상되었거나 미래 버전이어도 삭제한다(교사의 명시적 삭제). 없으면 `{ deleted: false }`로 성공이다.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `disableAndDeleteAllLocalProfiles(options?: { blockedTimeoutMs })` → `Result<void>`  | `deleteLocalProfileDatabase`에 위임한다. 성공하면 `notify`를 호출하고, `blocked`면 그대로 돌려준다. 원래 DB가 없어도 성공이다.                                                                                                                                                                                                                                                                                                                                                                                                                  |

- 모든 쓰기는 마지막에 `localProfileRecordSchema.safeParse(새 기록)`를 거친다. 실패하면 `invalid`를 반환하고 쓰지 않는다. 이 검증이 확정본은 검사 대기가 아니고 초안은 검사 대기라는 불변식, 엄격한 키 검사, 태그 상한을 보장한다.
- 손상(`corrupted`)이나 미래 버전(`unsupported_version`) 기록에 대한 쓰기 연산은 **삭제를 제외하고 모두 거절**한다.
- 쓰기 연산은 켜져 있는지(`settings` 존재) 확인한 뒤에만 진행한다. 꺼져 있으면 `disabled`다.

## 6. 테스트

- 테스트 환경은 파일 첫 줄의 `// @vitest-environment node`로 정한다.
- 테스트마다 `import { IDBFactory } from "fake-indexeddb"`로 새 팩토리를 만든다.
- `now`와 `randomId`는 고정값 함수로 주입한다.
- 스냅샷은 WU-1의 `toConfirmedSnapshot`, `toDraftSnapshot`으로 `FICTIONAL_PROFILES`에서 만든다(직접 객체를 손으로 조립하지 않는다).

반드시 포함할 케이스:

1. **동의 전 생성 금지**
   - 새 팩토리에서 `getLocalProfileAvailability`, `listLocalProfiles`, `getLocalProfile`, `saveDraft`, `createLocalProfile`을 호출해도 `databases()`에 DB가 없다.
   - `databases`를 뺀 래퍼 팩토리(`{ open, deleteDatabase }`)로 같은 검사를 해도 DB가 생기지 않는다(업그레이드 중단 경로). 확인은 원래 팩토리의 `databases()`로 한다.
2. **사용 불가**
   - `factory: null`, `open`이 `SecurityError`를 던지는 팩토리 → `unavailable`
   - `randomId`가 예외를 던지면 `createLocalProfile`이 `unavailable`이고 쓰기가 없다.
3. **켜기**: `enableLocalProfiles` → `enabled`. 다시 호출해도 `enabledAt`이 유지되고 `notify`가 다시 호출되지 않는다.
4. **왕복**
   - `create(interview)` → `get` 결과가 저장한 스냅샷과 같다. **읽어 온 값이 `migrateLocalProfileRecord`를 통과하는 것**(실행 환경 차이로 손상 판정이 나지 않음)을 포함한다.
   - `saveDraft`(revision 2) → `saveConfirmed`(revision 3, `draft: null`) → `discardDraft`(초안이 없으면 쓰지 않음) → `delete`
   - 각 단계의 `revision`, `updatedAt`, 목록 항목 필드를 검증한다.
5. **가져온 초안**: `create(import)` 뒤 `discardDraft` → 기록이 삭제되고 `{ deleted: true }`
6. **충돌**: 오래된 `expectedRevision`으로 `saveDraft`, `saveConfirmed`, `discardDraft` → `conflict`이고, 저장된 값이 바이트 단위로 그대로다.
7. **손상·미래 기록**
   - 같은 팩토리로 raw `put`한 `{ id: "broken", storageSchemaVersion: 1, junk: true }`와 `{ id: "future", storageSchemaVersion: 2 }`가 목록에 각각 `corrupted`, `unsupported`로 나온다. 다른 정상 기록도 함께 나온다.
   - 두 기록에 대한 `get`, `saveDraft`, `saveConfirmed`, `discardDraft`는 거절되고 값이 바뀌지 않는다.
   - `deleteLocalProfile`로는 지워진다.
8. **상한**: 정상 기록 9개 + 손상 기록 1개면 다음 `create`가 `limit_reached`다.
9. **용량 초과와 쓰기 중단**
   - `vi.spyOn(IDBObjectStore.prototype, "put")`(fake-indexeddb가 export하는 클래스)으로 `new DOMException("full", "QuotaExceededError")`를 던지게 하면 `saveDraft`가 `quota_exceeded`이고 이전 값이 남아 있다.
   - 일반 `Error`를 던지게 하면 `unavailable`이고 이전 값이 남아 있다.
   - spy는 테스트마다 원복한다.
10. **검증 실패**: 스키마를 통과하지 않는 스냅샷(예: `as unknown as`로 확정본에 검사 대기 상태를 넣음)을 `saveConfirmed`하면 `invalid`이고 쓰기가 없다.
11. **전체 삭제**
    - 삭제 후 `databases()`에 DB가 없고 availability가 `disabled`다.
    - `onversionchange`로 닫히는 연결을 하나 열어 둔 상태에서도 성공한다.
    - `onversionchange`를 무시하는 연결을 열어 두면 `blockedTimeoutMs: 50`에서 `blocked`를 돌려준다. 그 연결을 닫으면 결국 삭제된다.
12. **미래 DB 버전**: 같은 이름의 DB를 버전 2로 먼저 만들어 두면 availability와 쓰기가 `unsupported_version`이다.
13. **알림**: `notify` spy가 성공한 쓰기마다 정확히 한 번 호출되고, 실패·읽기·이미 켜진 상태의 `enable`에서는 호출되지 않는다.
14. **`toLocalProfileErrorCode`** 매핑 표 전체

## 7. 완료 조건

- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`가 통과한다. 가능하면 `corepack pnpm build`도 실행한다(앱 코드가 import하지 않으므로 영향은 없어야 한다).
- [ ] `git diff --stat`에 2절의 파일만 나온다. `package.json`의 변경은 `fake-indexeddb` 한 줄(정확한 버전 `6.2.5`)뿐이다.
- [ ] 6절의 14개 항목이 모두 테스트로 존재한다.
- [ ] 저장소의 아키텍처 가드(`platform-neutral.test.ts`)가 새 파일을 포함해 통과한다.
- [ ] 앱 코드(`src/app`, `src/components`)에서 새 모듈을 import하지 않는다.

## 8. 커밋과 보고

- 커밋 메시지: `Add opt-in IndexedDB repository for local profiles`
- 보고
  1. 변경 파일 목록
  2. 각 명령의 결과(테스트 수 포함)
  3. 지시와 다르게 구현한 부분과 이유
  4. fake-indexeddb 동작이 실제 브라우저와 다를 수 있다고 판단한 지점: 특히 업그레이드 중단 뒤 DB 삭제 여부, `databases()`, `durability` 옵션
  5. WU-1·WU-1a 함수에서 발견한 결함(수정하지 말고 보고만)
