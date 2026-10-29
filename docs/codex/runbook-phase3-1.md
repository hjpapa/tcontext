# Codex 연속 실행 지침: Phase 3.1 (WU-17 ~ WU-18)

- 설계 근거
  - WU-17: `docs/context-export-design.md` 11장(핵심본 2.0)
  - WU-18: 이 문서 5절(현재 문서 메뉴)
- 기준 코드: `main` @ `3bf12a6` (Phase 3 병합 후)
- 브랜치: `feat/core-export-v2`. Claude가 만들고 설계·지침 문서를 먼저 커밋했다. 이 브랜치에서 시작한다.
- 방식: WU-17 → WU-18을 멈추지 않고 이어서 구현한다. WU-18을 커밋한 뒤 멈추면 Claude가 최종 리뷰를 한다.

## 1. 실행 순서

```text
WU-17 핵심본 2.0 → WU-18 현재 문서 메뉴
   ▶ 최종 정지: Claude 최종 리뷰
```

두 WU는 서로 다른 파일만 고친다. WU-18은 WU-17의 결과에 의존하지 않는다.

## 2. 입력 문서와 우선순위

충돌하면 위의 문서가 우선한다.

1. `AGENTS.md`
2. 이 문서 5절의 WU별 사양
3. `docs/context-export-design.md` 11장
4. `docs/codex/runbook-phase3.md` 3절(공통 규칙). 이 문서에서 따로 정하지 않은 부분에 적용한다.

## 3. 공통 규칙

### 3.1 브랜치와 커밋

- WU 하나당 커밋 하나다. 메시지는 영어 명령문 요약 뒤에 WU 번호를 붙인다.
- 이전 커밋을 amend하거나 rebase하지 않는다.

### 3.2 자동 관문

| 시점    | 반드시 통과                                                    |
| ------- | -------------------------------------------------------------- |
| 모든 WU | `lint`, `typecheck`, `test`, `build`                           |
| WU-18   | 위 항목 + `test:e2e`(chromium·mobile, 재시도 0, 프로덕션 서버) |

- 모든 명령은 `corepack pnpm <명령>`으로 실행한다.
- 외부 키는 가짜 값으로 덮어쓴다: `OPENAI_API_KEY=test-key-not-used`, `SUPABASE_URL=https://example.supabase.co`, `SUPABASE_SECRET_KEY=test-secret-not-used`
- **이 PC에서는 `pnpm`이 PATH에 없어 `CI=1`의 webServer가 뜨지 않는다.** 다음 순서로 실행한다.
  1. `corepack pnpm build`
  2. `corepack pnpm start --port 3100`을 따로 띄운다.
  3. `PLAYWRIGHT_BASE_URL=http://localhost:3100`으로 `corepack pnpm test:e2e --retries=0`
  4. 끝나면 서버를 끈다.
- 관문이 실패한 채로 커밋하지 않는다. 테스트를 건너뛰게 바꾸거나, 기대값을 구현에 맞춰 느슨하게 고치거나, lint 규칙을 끄지 않는다.

### 3.3 변경 금지 영역

- `runbook-phase3.md` 3.3의 목록은 그대로 적용한다.
  - 전체본·텍스트 출력, 서버·저장·기여, skill 산출물, 플랫폼 콘텐츠, 의존성
- **모듈 선택본 출력**: 글자 하나도 바뀌면 안 된다. WU-17의 고정 해시 테스트로 확인한다.
- **이번에 고칠 필요가 없는 화면 코드**
  - `src/components/layout/interview-session-provider.tsx`
  - `src/components/layout/app-shell.tsx`
  - `src/components/profile/**`
  - `src/components/local-profiles/**`
  - `src/components/ai-guide/**`
  - `src/components/export/`의 `result-actions.tsx`, `result-view.tsx`, `export-variant-panel.tsx`, `use-context-as-of.ts`
- **기존 테스트**
  - `d4adc40` 이전부터 있던 테스트: 수정하지 않는다. 예외는 없다.
  - Phase 3(WU-13~16, WU-16a)에서 만든 테스트: 5절에서 허용한 **핵심본 관련 기대값만** 바꾼다. 모듈 선택본, 패널, 훅, 가이드, 핵심본 복사 버튼 테스트의 기대값은 바꾸지 않는다.

### 3.4 진행 기록

- `docs/codex/progress-phase3.md`에 "WU-17", "WU-18" 절을 이어서 쓰고, 마지막에 "Phase 3.1 요약"을 적는다.
- 형식은 기존 절과 같다: 상태, 변경 파일, 관문, 다르게 구현한 부분과 이유, 이전 WU 수정, 확인하지 못한 것, 리뷰어에게 묻고 싶은 것.

## 4. 멈추고 물어봐야 하는 경우

다음 중 하나라도 해당하면 그 WU를 커밋하지 말고 진행 기록에 상황을 적은 뒤 멈춘다.

1. 3.3의 변경 금지 영역을 고쳐야만 진행할 수 있다.
2. 모듈 선택본 고정 해시 테스트가 **코드를 고치기 전부터** 실패한다. 또는 구현 뒤 실패를 3번 고쳐도 통과하지 못한다.
3. 저장 형식(로컬 기록, 백업, 기여 데이터)이 바뀐다.
4. 개인정보 불변 조건과 충돌한다. 예: 선택 상태나 "현재 문서" 여부를 브라우저 저장소에 남겨야 하는 경우
5. 같은 WU에서 관문을 세 번 고쳐도 통과하지 못한다.
6. 3.3에서 허용하지 않은 기존 테스트 기대값을 바꿔야 한다.
7. 새 의존성이 필요하다.
8. WU-18에서 5절의 규칙대로 해도 320px에서 가로 넘침이 생긴다. 다른 배치를 스스로 정하지 않는다.

"작은 설계 판단"(내부 함수 분리, 변수 이름, 테스트 구성)은 멈추지 말고 결정한 뒤 진행 기록에 남긴다.

## 5. WU별 사양

### WU-17. 핵심본 2.0

#### 파일

| 파일                                                                           | 변경                       |
| ------------------------------------------------------------------------------ | -------------------------- |
| `src/content/export-variants.ts`                                               | 상수 이름 변경, 추가, 삭제 |
| `src/lib/export/profile-variants.ts`                                           | 핵심본 생성기 교체         |
| `src/lib/export/profile-variants-fidelity.ts`                                  | 핵심본 판정 교체           |
| `src/lib/export/profile-variants-module-golden.test.ts`(신규)                  | 모듈 선택본 고정 해시      |
| `src/lib/export/profile-variants.test.ts`, `profile-variants-fidelity.test.ts` | 핵심본 테스트 교체         |
| `src/lib/export/profile-variants.test-fixtures.ts`                             | 필요할 때 새 배열만 추가   |
| `src/components/export/export-variant-picker.tsx`                              | 핵심본 설명 문구 1줄       |
| `e2e/context-export.spec.ts`                                                   | 핵심본 기대값              |
| `README.md`, `docs/product-spec.md`                                            | 핵심본 설명                |

#### 0단계: 모듈 선택본 고정 해시 (코드를 고치기 전에)

- `src/lib/export/profile-variants-module-golden.test.ts`를 만든다(`// @vitest-environment node`, `node:crypto` 사용).

```ts
const MODULE_OUTPUT_SHA256 =
  "204bc0e3db1bb8bceaf410d82db8dd9f1db217ecce329f347d73c9a3776e305d"; // main @ 3bf12a6
const selections = [
  ["identity_and_role"],
  ["identity_and_role", "class_context", "environment_and_ai"],
  PROFILE_MODULE_IDS,
];
// VARIANT_FIXTURES(현재 8건, 순서 그대로) × selections × [OPTIONAL_SECTION_IDS, []]
//   r = profileToModuleMarkdown(profile, { asOf: TEST_AS_OF, modules, sections })
//   parts.push(r.ok ? r.markdown : `error:${r.error}`)
// 기대: parts.length === 48
//       sha256(parts.join("\n<<<variant>>>\n"), "utf8") === MODULE_OUTPUT_SHA256
```

- **고치기 전의 코드에서 먼저 실행해 통과하는지 확인한다.** 통과하지 않으면 멈춘다(4절 2번).
- `VARIANT_FIXTURES`와 `TEST_AS_OF`는 바꾸지 않는다. 핵심본 테스트에 새 고정 데이터가 필요하면 별도 배열로 추가한다.

#### 상수 (`src/content/export-variants.ts`)

진행 순서는 다음과 같다. 매 단계 뒤 고정 해시 테스트를 실행한다.

1. **이름 변경 (내용은 그대로)**
   - `VARIANT_FORMAT_VERSION` → `MODULE_FORMAT_VERSION` (`"1.0"`)
   - `CORE_USAGE_RULES`(5줄) → `MODULE_USAGE_RULES`
   - 모든 사용처를 갱신한 뒤 고정 해시가 통과하는지 확인한다.
2. **추가**

```ts
export const CORE_FORMAT_VERSION = "2.0";

export const CORE_USAGE_RULES = [
  "이 문서는 반복해서 쓰는 교사의 핵심 맥락이다. 교과·단원·성취기준·시간처럼 수업마다 달라지는 정보는 요청에서 받고, 요청이 이 문서와 다르면 요청을 우선한다.",
  "요약과 목록은 AI가 인터뷰를 종합하고 교사가 확인한 내용이다. 교사가 직접 말한 사실처럼 단정하지 말고, 근거가 되는 교사 진술이 필요하면 전체본을 요청한다.",
  "학생 개인을 추정·분류하거나 개인정보를 만들거나 요구하지 않는다. 제안은 초안이며 최종 판단과 선택은 교사가 한다.",
] as const;

export const CORE_AS_OF_NOTICE = (
  date: string,
  source: "confirmed" | "generated",
) =>
  `이 문서는 ${date}에 ${source === "confirmed" ? "확정" : "작성"}한 기준입니다. 학기나 수업 집단이 바뀌면 학급 맥락과 지원 고려사항을 다시 확인하세요.`;
```

3. **문구 변경**: `VARIANT_PICKER_HINT` = `"반복해서 쓸 때는 핵심본이 가볍습니다. 교사 진술 근거가 필요한 작업에는 전체본이나 모듈 선택본을 쓰세요."`
4. **삭제**: `CORE_CLAIM_LABELS`, `CORE_EXCLUDED_NOTICE`. 사용처가 남지 않게 한다.
5. **그대로 둠**: `AS_OF_NOTICE`(모듈 선택본 전용), `MODULE_SCOPE_NOTICE`, `EMPTY_SECTION_LINE`, `EVIDENCE_GUIDE_LINES`, 개인정보·검토 경고 상수, `VARIANT_SECTION_TITLES`, `CLAIM_GROUPS`

#### 생성기 (`src/lib/export/profile-variants.ts`)

- **모듈 선택본 경로는 동작을 바꾸지 않는다.**
  - 공용이던 `frontMatter`는 모듈 선택본 전용으로 남긴다(이름을 `moduleFrontMatter`로 바꿔도 된다).
  - 학급 지원 섹션에 `AS_OF_NOTICE`를 넣는 기존 동작도 모듈 선택본에서는 그대로다.
- **`profileToCoreMarkdown(profile, { asOf })`**
  - 시그니처, 결과 타입, 입력 검증(`invalid`, `pending_review`)은 그대로다.
  - 출력은 정확히 다음 줄 배치를 따른다. `[ ]`는 조건부다.

```text
---
document_type: "teacher_profile_context"
export_variant: "core"
variant_format_version: "2.0"
profile_title: "…"
school_level: "…"
role: "…"
[teaching_subject: "…"]
context_as_of: "YYYY-MM-DD"
context_as_of_source: "confirmed|generated"
privacy_review: "clear|needs_review"
---

# {profileTitle}

## 이 문서를 사용하는 방법

- {CORE_USAGE_RULES[0]}
- {CORE_USAGE_RULES[1]}
- {CORE_USAGE_RULES[2]}

{CORE_AS_OF_NOTICE(date, source)}
[
{개인정보 경고: 확인 안 됨 → 경고 순서로 하나}]
[
## 요약

{shortSummary}]
[
## 영역별 요약
{모듈마다:
(빈 줄)
### {module.title}
(빈 줄)
{module.summary}}]

## 수업 설계 원칙

{목록 또는 EMPTY_SECTION_LINE}

## 학급 지원 고려사항

{목록 또는 EMPTY_SECTION_LINE}

## 현실적인 제약과 대체안

{목록 또는 EMPTY_SECTION_LINE}

## AI 협업 지침과 판단 경계

{목록 또는 EMPTY_SECTION_LINE}
```

- 세부 규칙
  - 문자열 값은 지금처럼 `yamlQuoted`, 본문 텍스트는 `sanitizeMarkdownText`로 정제한다.
  - "비어 있음"은 정제 결과가 `""`인 경우다.
  - `## 요약`: `shortSummary`가 비면 섹션째 뺀다.
  - `## 영역별 요약`: `PROFILE_MODULE_IDS` 순서대로, 요약이 비지 않은 모듈만 넣는다. 하나도 없으면 섹션째 뺀다. 여러 줄 요약은 정제 결과를 그대로 문단으로 둔다.
  - 목록 항목: 지금처럼 `- ` + 정제 텍스트, 줄바꿈은 `\n  `로 들여쓴다.
  - 학급 지원 섹션에 `AS_OF_NOTICE`를 넣지 않는다. 기준 시점은 문서 앞의 `CORE_AS_OF_NOTICE` 한 번뿐이다.
  - 개별 문장(claims), 근거 라벨, `[검토 전]`, 검토 필요 경고, 제외 안내는 넣지 않는다.
  - 중복 제거를 하지 않는다. 제약과 AI 협업 지침뿐 아니라 원칙과 학급 지원도 원문 전부를 순서대로 넣는다.
  - 끝은 지금처럼 `"\n"` 하나로 끝난다.

#### 충실성 검사 (`src/lib/export/profile-variants-fidelity.ts`)

- `verifyVariantFidelity`의 시그니처와 `FidelityRule` 5종은 그대로 둔다.
- 내부를 나눈다.
  - `variant === "core"` → 새 함수(예: `verifyCoreFidelity`)
  - `"modules"` → 기존 판정을 옮긴 함수. 동작은 바꾸지 않고, 핵심본 전용 분기만 걷어낸다.
- 핵심본 판정은 설계 11.4를 따른다.

| 규칙             | 핵심본 실패 조건                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unknown_line`   | 머리말 밖의 내용 줄이 고정 문구, 고정 제목, `# 제목`, `### 모듈 제목`, 요약 문단(`shortSummary`, 모듈 요약), 종합 항목 원문 중 어느 것도 아님                                                              |
| `claim_coverage` | 요약이 있는 모듈이 `## 영역별 요약`에 빠지거나 순서가 다르거나 두 번 나옴. 요약 없는 모듈의 제목이 나옴. 원칙·학급 지원 목록이 원문과 항목 수·순서가 다름. 종합 섹션 4개와 사용 규칙 밖에 목록 항목이 있음 |
| `constraints`    | 제약 또는 AI 협업 지침 목록이 원문과 항목 수·순서가 다름                                                                                                                                                   |
| `ai_label`       | 사용 규칙 2번이 없음                                                                                                                                                                                       |
| `as_of`          | 기준 시점 문단이 없거나, 두 번 이상이거나, `## 요약`·`## 영역별 요약`·종합 섹션보다 뒤에 있음                                                                                                              |

#### 테스트

- **모듈 선택본**: 고정 해시 테스트와 기존 모듈 선택본 테스트(구성, 전체본 블록 일치, 충실성, 변이)를 그대로 통과한다.
- **핵심본 구성** (기존 핵심본 테스트를 교체한다)
  1. 머리말 키 목록과 순서가 위와 정확히 같다. 빠진 필드(`title`, `service`, `language`, `schema_version`, `created_at`, `privacy_rule`, `needs_claim_review`)가 없다.
  2. 섹션 순서와 생략 규칙
     - `shortSummary`가 비면 `## 요약`이 없다.
     - 모듈 요약이 모두 비면 `## 영역별 요약`이 없다.
     - 종합 목록이 비면 `EMPTY_SECTION_LINE`이 들어간다.
  3. 개별 문장이 없다.
     - 요약이나 종합 항목과 같은 텍스트가 아닌 모든 claim 텍스트가 출력에 없다.
     - `[직접]`, `[AI 해석`, `[검토 전]`, `### 교사가 직접 말한 내용`, `## 근거 표시를 읽는 법`이 없다.
  4. 모든 모듈 요약과 종합 항목이 원문 그대로, 순서대로 있다(여러 줄 항목 포함). 원칙과 같은 학급 지원 항목도 지우지 않는다.
  5. `CORE_AS_OF_NOTICE`가 정확히 한 번, `## 요약`보다 앞에 있다. 모듈용 `AS_OF_NOTICE`("이 내용은 …")는 없다.
  6. `# 수업마다 추가할 작업 컨텍스트`, `# AI에게 바로 전달할 실행 프롬프트`, `## 생성 결과 자기 점검`이 없다.
  7. 개인정보 경고 2종이 전체본과 같은 문자열로 들어간다.
  8. **분량**: 가상 프로필 4건에서 핵심본 길이가 `profileToMarkdown` 길이의 35% 이하다(시제품 측정 31~33%).
  9. 결정적 출력, 입력 검증 결과는 기존과 같다.
- **충실성**
  - 모든 고정 데이터의 핵심본에서 빈 배열이다.
  - 변이 테스트: 각각 지정한 규칙이 잡힌다.

| 변이                                               | 잡혀야 하는 규칙                     |
| -------------------------------------------------- | ------------------------------------ |
| 제약 1줄 삭제                                      | `constraints`                        |
| AI 협업 지침 1줄 삭제                              | `constraints`                        |
| 원칙 항목의 끝 10자 자르기                         | `unknown_line` 또는 `claim_coverage` |
| 모듈 요약 문단 하나 삭제                           | `claim_coverage`                     |
| 두 모듈 블록의 순서 바꾸기                         | `claim_coverage`                     |
| 영역별 요약 안에 claim 텍스트를 `- ` 항목으로 삽입 | `claim_coverage`                     |
| 사용 규칙 2번 삭제                                 | `ai_label`                           |
| 기준 시점 문단 삭제                                | `as_of`                              |
| 기준 시점 문단을 문서 끝으로 이동                  | `as_of`                              |
| 지어낸 목록 항목 삽입                              | `unknown_line`                       |

#### 화면 문구

- `export-variant-picker.tsx`의 핵심본 설명: `"요약과 원칙·지원·제약·AI 지침만, 반복 사용에 적합"`
- 다른 컴포넌트는 고치지 않는다. 핵심본 복사 버튼, 패널, 가이드는 생성기 결과를 그대로 쓰므로 자동으로 바뀐다.

#### E2E (`e2e/context-export.spec.ts`, 허용된 변경)

- **첫 번째 테스트의 핵심본 부분**
  - "확인된 문장이 있다"는 기대를 다음으로 바꾼다: 모듈 요약과 종합 항목이 있고, claim 텍스트가 없다.
  - 파일명 `-core.md`, 클립보드 내용 일치, 작업 양식·실행 프롬프트 없음은 그대로 둔다.
- **세 번째 테스트(저장한 확정본)**
  - 확정일 기대(`context_as_of: "2026-10-26"`, `context_as_of_source: "confirmed"`)는 유지한다.
  - 기준 시점 문장은 `CORE_AS_OF_NOTICE("2026-10-26", "confirmed")`로 바꾼다.
  - "확인되지 않은 문장 2개"와 `MODULES[0].claim.text` 포함 기대를 지운다. 대신 `MODULES`의 claim 텍스트가 하나도 없음을 확인한다.
  - 전체본 쪽 기대는 그대로 둔다. 테스트 제목은 내용에 맞게 바꾼다.
- 나머지 테스트는 바꾸지 않는다.

#### 문서

- `README.md` Markdown 절의 표와 설명, `docs/product-spec.md`의 핵심본 항목을 11장에 맞게 고친다.
  - 핵심본 = 요약·모듈 요약·종합 4종. 개별 문장은 넣지 않음. 근거가 필요하면 전체본·모듈 선택본.
- 진행 기록에 가상 프로필 4건과 최대 크기 프로필의 실제 분량(전체본, 핵심본, 비율)을 적는다.

### WU-18. 현재 문서 메뉴

#### 목적

- 결과 화면에서 AI 활용 가이드·문서 예시 등으로 이동한 뒤, 만든 문서로 바로 돌아갈 메뉴가 없다.
- 상단 메뉴에 "현재 문서" 링크를 추가한다.

#### 파일

- `src/components/layout/primary-nav.tsx`
- `src/components/layout/primary-nav.test.tsx`(신규)
- `e2e/current-document-nav.spec.ts`(신규)
- `docs/product-spec.md`(화면 흐름 한 줄)

#### 동작

- 세션 값: `const { profile, markdown } = useInterviewSession()`
- 링크 대상
  - `profile === null`: 링크를 보이지 않는다.
  - `markdown.length > 0`(완성 문서, `GuideArtifacts`의 `hasDocument`와 같은 조건): `/result`
  - 그 밖(검토 중인 문서): `/review`
- 보이지 않는 경로: `/interview`, `/review`, `/admin`과 그 하위 경로(`isCurrentPath` 사용)
- `/result`에서는 대상이 `/result`일 때 `aria-current="page"`를 붙인다.
- 링크 모양
  - 접근 가능한 이름: `aria-label="현재 문서"`
  - 보이는 글자: 640px 미만은 "문서", 그 이상은 "현재 문서"
  - 스타일은 "문서 예시" 링크와 같다(현재 페이지 표시 포함).
- 순서: 문서 예시 → 내 프로파일 → **현재 문서** → 개인정보 안내 → 인터뷰 시작
- **좁은 화면 배치**
  - 현재 문서 링크가 보일 때만 "인터뷰 시작" 링크를 640px 미만에서 숨긴다(`hidden sm:inline-flex`). 640px 이상에서는 둘 다 보인다.
  - 링크가 없으면 "인터뷰 시작"은 지금과 같다.
  - 근거(Claude 측정, 2026-10-29): 320px의 비작업 화면에서 남는 폭은 12px(로고 123px, 메뉴 162px)이다. 새 링크(간격 포함 약 54px)는 "인터뷰 시작"(간격 포함 76px)을 숨겨야 들어간다.
- 세션은 메모리에만 있으므로 새로 고치면 링크가 사라진다. 의도한 동작이다. 브라우저 저장소에 아무것도 남기지 않는다.
- 하단 바로가기(`app-shell.tsx`)는 고치지 않는다.

#### 테스트

- **RTL** (`next/navigation`의 `usePathname`을 모의하고, 세션은 `InterviewSessionProvider` 안에서 설정한다)
  1. 문서가 없으면 "현재 문서" 링크가 없고, "인터뷰 시작" 링크에 `hidden` 클래스가 없다.
  2. 완성 문서가 있으면 링크가 `/result`를 가리키고 "인터뷰 시작"에 `hidden` 클래스가 있다. `/result`에서는 `aria-current="page"`, `/ai-guide`에서는 없다.
  3. 검토 중인 문서(`profile`만 있고 `markdown`이 빈 문자열)면 `/review`를 가리킨다.
  4. `/interview`, `/review`, `/admin/…`에서는 링크가 없다.
- **E2E** (`e2e/current-document-nav.spec.ts`, chromium·mobile, 기존 `e2e/helpers.ts` 흐름 재사용)
  1. 인터뷰를 마쳐 결과 화면에 간 뒤 "AI에서 활용하기"로 이동하면, 메뉴의 "현재 문서"가 보인다. 누르면 `/result`로 돌아오고 같은 문서(제목)가 보인다.
  2. 320×568에서 문서가 있을 때 `/ai-guide`와 `/examples`에 가로 넘침이 없고, "현재 문서"는 보이며 "인터뷰 시작"은 보이지 않는다. 1024px에서는 둘 다 보인다.
  3. `/ai-guide`에서 새로 고치면 "현재 문서" 링크가 사라진다.
- 기존 `e2e/public-pages.spec.ts`의 320px 메뉴 검사는 문서가 없는 상태이므로 그대로 통과해야 한다.

## 6. 완료 판단 (Phase 3.1)

- [ ] 핵심본이 설계 11.3의 구성과 같고, 가상 프로필 4건에서 전체본의 35% 이하다.
- [ ] 모듈 선택본 고정 해시가 그대로다. 전체본, 기여, 관리자 대조, skill zip, 저장 형식이 바뀌지 않았다.
- [ ] 충실성 검사가 모든 고정 데이터에서 통과하고, 핵심본 변이 10종을 잡는다.
- [ ] 모든 화면에서(작업 경로 제외) 현재 문서로 돌아갈 수 있고, 320px에서 넘침이 없다.
- [ ] 3.3에서 허용한 것 외에 기존 테스트 기대값이 바뀌지 않았다.
- [ ] 모든 관문이 통과했다(E2E 재시도 0).
