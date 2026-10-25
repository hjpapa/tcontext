# Codex 작업 지시: WU-1a 직렬화·버전 판별 보강

- 설계 근거: `docs/local-profile-design.md` (4.8, 5.5, 6.3)
- 선행 작업: WU-1 (`fef2c9a`, 브랜치 `feat/local-profiles`)
- 배경: WU-1 리뷰에서 나온 낮은 심각도 문제를 IndexedDB에 데이터가 쌓이기 전(WU-2 전)에 고친다.
- 산출물: 커밋 1개

## 1. 목표

WU-1에서 만든 순수 로직의 작은 결함 4가지를 고치고, 테스트 공백을 메운다. 공개 함수의 이름과 기존 결과 타입은 바꾸지 않는다.

1. 담당 교과가 없는 프로필에 `teachingSubject: undefined` 키가 생기는 문제
2. 다시 열 때 확정본 태그가 추천 목록에서 빠지는 문제
3. 미래 스키마 파일·기록이 "손상"으로 잘못 분류되는 문제
4. 다른 실행 환경(realm)에서 만든 일반 객체를 거절할 수 있는 판별 방식과, 업그레이드 함수의 예외·원본 변경 위험

## 2. 제약

1. 수정할 수 있는 파일은 아래 다섯 개뿐이다.
   - `src/lib/storage/profiles/serialize.ts`
   - `src/lib/storage/profiles/migrate.ts`
   - `src/lib/storage/profiles/schema.test.ts`, `serialize.test.ts`, `migrate.test.ts`
   - `src/types/profile.test.ts`: 161행 근처의 연속 빈 줄 하나만 지운다. 다른 변경은 금지한다.
2. `schema.ts`, `tags.ts`, `changes.ts`, `src/types/profile.ts`, 화면 코드, `package.json`은 수정하지 않는다.
3. WU-1에서 새로 추가한 테스트 파일의 케이스는 강화하거나 고쳐도 된다. `bd81a2e` 이전부터 있던 테스트 케이스는 수정하지 않는다.
4. WU-1 지시문의 공통 제약(결과 객체 반환, 최상위 브라우저 전역 금지, `console.*` 금지, 플랫폼 이름 금지)은 그대로 적용된다.

## 3. 작업 내용

### 3.1 `serialize.ts` — 담당 교과 키 생략

- `copyProfile`의 `metadata`에서 `teachingSubject`를 무조건 넣지 말고, 값이 있을 때만 넣는다.

```ts
...(profile.metadata.teachingSubject === undefined
  ? {}
  : { teachingSubject: profile.metadata.teachingSubject }),
```

- 저장소 기존 규칙(`src/lib/ai/profile.ts`의 `trustedMetadata`, `src/lib/storage/schema.ts`의 `toStoredInterviewProgress`)과 같은 방식이다.
- 이유: zod 4는 명시적으로 `undefined`인 선택 키를 출력에 남긴다. 그러면 IndexedDB에 그대로 저장되고, 키 단위 비교(WU-7 변경 표시)에서 원본과 달라 보인다.

### 3.2 `serialize.ts` — 다시 열 때 태그 병합 범위

`toEditableSession`의 `suggestedTags`를 아래 순서로 합친다.

```ts
mergeSuggestedTags(
  record.suggestedTags,
  suggestedTagsFromConfirmedTags(
    record.confirmed?.profile.confirmedTags ?? EMPTY,
  ),
  suggestedTagsFromConfirmedTags(record.draft?.profile.confirmedTags ?? EMPTY),
);
```

- `EMPTY`는 6개 카테고리가 모두 빈 배열인 `ConfirmedTags`다. 모듈 안의 상수로 둔다.
- 이유: 초안에서 해제한 확정 태그가 `record.suggestedTags`에 없으면, 다시 열었을 때 선택지에서 사라져 되살릴 수 없다. 가져온 파일이나 순수 프로필 JSON에서 생긴다.
- 선택 상태(어떤 태그가 체크되어 있는지)는 여전히 `profile.confirmedTags`로만 정해진다. WU-4가 `selectedTagKeysFromConfirmedTags(session.profile.confirmedTags)`로 계산한다. 이 함수는 선택지 목록만 넓힌다.

### 3.3 `migrate.ts` — 일반 객체 판별

`isObject`를 다음으로 바꾼다.

```ts
Object.prototype.toString.call(raw) === "[object Object]";
```

- 이유: 지금처럼 프로토타입이 현재 실행 환경의 `Object.prototype`인지 비교하면, 다른 realm(iframe, `vm`, 일부 테스트 환경)에서 만든 일반 객체를 손상으로 판정한다. 이 경우 IndexedDB에서 읽은 모든 기록이 손상으로 표시될 위험이 있다.
- 바꾼 뒤에도 `null`, 배열, `Date`, `Map`, 문자열은 계속 거절한다.

### 3.4 `migrate.ts` — 미래 프로필 스키마 사전 판별

엄격한 구조 검증 전에 프로필의 `metadata.schemaVersion`만 먼저 확인한다. 미래 버전은 구조도 바뀌어 있을 가능성이 높기 때문이다.

- 공통 헬퍼(모듈 내부): `peekProfileSchemaVersion(value: unknown): string | null`
  - `value`가 일반 객체이고, `value.metadata`도 일반 객체이며, `schemaVersion`이 문자열이면 그 문자열을 돌려준다. 그 밖에는 `null`이다.
  - 배열 순회나 깊은 접근은 하지 않는다.
- `migrateBackupFile`의 판정 순서

1. 일반 객체가 아니면 `not_object`
2. `format === PROFILE_BACKUP_FORMAT`인 경우
   1. `formatVersion`이 숫자이고 지원 버전보다 크면 `unsupported_format_version`
   2. **새 단계:** `peekProfileSchemaVersion(raw.profile)`이 문자열이고 지원하지 않는 버전이면 `unsupported_profile_schema`
   3. 그 밖에는 엄격 검증, 실패하면 `invalid_backup`
3. `format` 키가 없는 경우
   1. **새 단계:** `peekProfileSchemaVersion(raw)`이 문자열이고 지원하지 않는 버전이면 `unsupported_profile_schema`
   2. 그 밖에는 기존과 같다(`teacherContextProfileSchema`를 통과하면 감싸고, 실패하면 `unknown_format`).
4. 그 밖에는 `unknown_format`
5. 성공 후보에 대한 기존의 사후 버전 검사는 유지한다(중복이지만 안전장치).

- `migrateLocalProfileRecord`의 판정 순서

1. 일반 객체가 아니면 `corrupted`
2. `storageSchemaVersion`이 숫자이고 현재보다 크면 `unsupported_version`
3. **새 단계:** `raw.confirmed`와 `raw.draft` 각각이 일반 객체일 때 `peekProfileSchemaVersion(raw.confirmed.profile)`, `peekProfileSchemaVersion(raw.draft.profile)`을 확인한다. 지원하지 않는 버전이면 `unsupported_version`을 반환한다. 미래 데이터이므로 손상으로 표시하지 않고 보존한다.
4. 업그레이드 반복(3.5)
5. `localProfileRecordSchema` 최종 검증, 실패하면 `corrupted`

### 3.5 `migrate.ts` — 업그레이드 함수 안전장치

- 시그니처를 하위 호환되게 확장한다. 두 번째 인자는 테스트 주입용이며, 기본값은 모듈 내부의 빈 표다.

```ts
export function migrateLocalProfileRecord(
  raw: unknown,
  upgrades: Readonly<Record<number, RecordUpgrade>> = RECORD_UPGRADES,
): RecordMigrationResult;
```

- 업그레이드 함수에는 `structuredClone(candidate)`를 넘긴다. 원본 `raw`가 바뀌지 않게 하기 위해서다.
- 업그레이드 함수가 예외를 던지거나 일반 객체가 아닌 값을 돌려주면 `corrupted`(id 보존)를 반환한다.
- 기존 규칙도 유지한다: 업그레이드 함수가 없거나, 다음 버전이 증가하지 않거나, 다음 버전이 현재 버전을 넘으면 `corrupted`.
- `RecordUpgrade` 타입은 export한다.

## 4. 테스트

### 4.1 `serialize.test.ts`

1. 담당 교과가 없는 `FICTIONAL_PROFILES[0]`(유치원)
   - `toConfirmedSnapshot`, `toDraftSnapshot`, `toEditableSession`의 `profile`·`baseline` 모두에서 `Object.hasOwn(metadata, "teachingSubject") === false`
   - 확정 스냅샷은 `teacherContextProfileSchema.parse(source)`와 `toStrictEqual`로 같다.
2. 담당 교과가 있는 중학교 예시는 값이 그대로 보존된다.
3. `toEditableSession`의 `suggestedTags`가 **정확한 배열**과 같아야 한다(길이 비교 금지). 고정 데이터는 다음과 같다.
   - `record.suggestedTags`: 태그 A 하나
   - 확정본 `confirmedTags`: A와 B
   - 초안 `confirmedTags`: B를 해제하고 C를 선택
   - 기대값: `[A, B, C]`
   - 이때 `selectedTagKeysFromConfirmedTags(session.profile.confirmedTags)`는 `{A, C}`다(B는 선택지에 있지만 선택되지 않음).

### 4.2 `migrate.test.ts`

1. `node:vm`의 `runInNewContext`로 만든 다른 realm의 일반 객체
   - 유효한 v1 기록이면 `ok: true`
   - 백업이면 `backup_v1`
   - `Map`, `Date`, 배열은 계속 거절한다.
2. 미래 스키마 사전 판별
   - 구조가 다른 미래 프로필(`schemaVersion: "2.0"` + 알 수 없는 필드 + 필수 필드 누락)이 감싼 백업이면 `unsupported_profile_schema`, 순수 프로필이어도 `unsupported_profile_schema`
   - 같은 프로필이 기록의 `confirmed`나 `draft`에 있으면 `unsupported_version`(id 보존)
   - `metadata`가 없는 쓰레기 객체는 기존처럼 `invalid_backup` 또는 `unknown_format`
3. 업그레이드 표 주입
   - v0 → v1 성공이면 `migrated: true`
   - 예외를 던지는 업그레이드, 버전이 증가하지 않는 업그레이드, 현재 버전을 넘는 업그레이드는 각각 `corrupted`(id 보존)
   - 입력 객체를 직접 바꾸는 업그레이드를 넣어도 원본 `raw`는 바뀌지 않는다.

### 4.3 `schema.test.ts`

1. 거절 케이스는 `success === false`만 보지 말고, 기대한 위치의 issue가 있는지 확인한다(`issues.some(issue => path가 기대 경로로 시작)`). 기대 경로 예시는 다음과 같다.
   - 모듈 누락: `["modules"]`
   - claim 중복: `["modules"]`
   - 알 수 없는 키: `["modules", 0]`
   - 확인 상태: `["modules", 0, "claims", 0, "confirmedByUser"]`
   - 근거: `["modules", 0, "claims", 0, "evidenceQuestionIds"]`
   - 길이: `["profileTitle"]`
   - 태그: `["confirmedTags", "aiBoundaries"]`
   - 개인정보: `["privacyReview", "items"]`
   - 기록 쪽: `["confirmed", "profile", "privacyReview"]`, `["draft", "profile", "privacyReview"]`, `["id"]` 등
   - 실제 zod issue 경로가 다르면 실제 값에 맞추되, 의도와 다른 이유로 거절되는 일이 없게 한다.
2. 추가로 받아들여야 하는 경우
   - 확정본 없이 초안만 있는 기록(`origin: "import"`, `confirmed: null`, `draft`는 검사 대기 상태)
   - `kind: "draft"` 백업에 빈 텍스트가 있는 경우
3. 추가로 거절해야 하는 경우
   - 기록 최상위의 알 수 없는 키
   - `revision: 0`
   - 시간대가 붙은 시각(`"2026-10-25T09:00:00+09:00"`)
   - 백업의 잘못된 `recordId`

## 5. 완료 조건

- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`가 통과한다.
- [ ] `git diff --stat`에 2절의 다섯 파일만 나온다.
- [ ] `git show HEAD:<변경 파일> | prettier --stdin-filepath <변경 파일>` 결과가 커밋된 내용과 같다(포맷 기준 충족).
- [ ] 4절의 모든 케이스가 있고, 기존 공개 함수의 이름과 결과 타입이 그대로다(`migrateLocalProfileRecord`에 선택 인자 추가만 허용).

## 6. 커밋과 보고

- 커밋 메시지: `Harden local profile serialization and version detection`
- 보고: 변경 파일 목록, 각 명령의 결과(테스트 수 포함), 지시와 다르게 구현한 부분과 이유, WU-2에 영향을 줄 발견 사항
