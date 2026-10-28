# Codex 연속 실행 지침: Phase 3 (WU-13 ~ WU-16)

- 설계 근거: `docs/context-export-design.md` (9장 결정 확정, 2026-10-26)
- 기준 코드: `main` @ `d4adc40` 또는 그 이후의 최신 `main`
- 방식: Codex가 WU-13부터 WU-16까지 멈추지 않고 이어서 구현한다. WU-16을 커밋한 뒤 멈추면 Claude가 최종 리뷰를 한다.

## 1. 실행 순서

```text
(main 최신화) → 브랜치 feat/context-export 생성
WU-13 → WU-14 → WU-15 → WU-16
   ▶ 최종 정지: Claude 최종 리뷰
```

- 시작 전에 `main`을 최신으로 받는다. `feat/context-export` 브랜치가 이미 있으면(설계 문서 커밋이 들어 있는 경우) 그 브랜치에서 시작하고, 없으면 최신 `main`에서 새로 만든다.
- 중간 정지 지점은 없다. 4절의 멈춤 조건은 계속 적용된다.

## 2. 입력 문서와 우선순위

충돌하면 위의 문서가 우선한다.

1. `AGENTS.md`
2. 이 문서 5절의 WU별 사양
3. `docs/context-export-design.md`
4. `docs/codex/runbook.md` 3절(공통 규칙). 이 문서에서 따로 정하지 않은 부분에 적용한다.
5. `docs/local-profile-design.md`(배경)

## 3. 공통 규칙

### 3.1 브랜치와 커밋

- 브랜치는 `feat/context-export`, WU 하나당 커밋 하나다.
- 메시지는 영어 명령문 요약 뒤에 WU 번호를 붙인다(예: `Add rule-based core and module context exports (WU-13)`).
- 이전 커밋을 amend하거나 rebase하지 않는다.

### 3.2 자동 관문

모든 관문은 `corepack pnpm <명령>`으로 실행한다(PATH에 `pnpm`이 있으면 그대로 써도 된다).

| 시점    | 반드시 통과                                                    |
| ------- | -------------------------------------------------------------- |
| 모든 WU | `lint`, `typecheck`, `test`, `build`                           |
| WU-16   | 위 항목 + `test:e2e`(chromium·mobile, 재시도 0, 프로덕션 서버) |

- 관문이 실패한 채로 커밋하지 않는다.
- 테스트를 건너뛰게 바꾸거나, 기대값을 구현에 맞춰 느슨하게 고치거나, lint 규칙을 끄지 않는다.

### 3.3 변경 금지 영역

- **전체본과 기존 텍스트 출력**: `src/lib/export/profile-to-markdown.ts`, `profile-to-markdown-v1.ts`, `profile-to-text.ts`, `src/content/profile-document.ts`
  - `profileToCompactText`는 지우지 않는다. 화면에서만 쓰지 않게 된다.
- **서버·저장·기여**: `src/app/api/**`, `src/lib/ai/**`, `src/lib/consent/**`, `src/lib/supabase/**`, `src/lib/storage/**`, `supabase/**`
- **skill 산출물**: `src/lib/export/skill.ts`, `zip.ts`. skill zip의 참고 파일은 전체본 그대로 둔다(결정 6).
- **플랫폼 콘텐츠**: `src/content/platform-guides/**`, `src/content/usage-instructions.ts`
- **기존 테스트**: `d4adc40` 시점에 있던 테스트 케이스는 수정하지 않는다.
  - **승인된 예외는 1건뿐이다**: `src/components/export/result-actions.test.tsx`의 "짧은 AI 컨텍스트 복사" 기대값을 "핵심본 복사"로 바꾸는 것(결정 2, WU-14).
- **의존성**: 새 런타임·개발 의존성을 추가하지 않는다.

### 3.4 진행 기록

- `docs/codex/progress-phase3.md`를 만들고 각 WU 커밋에 함께 넣는다.
- 형식은 `docs/codex/runbook.md` 3.4와 같다: 상태, 변경 파일, 관문, 다르게 구현한 부분과 이유, 이전 WU 수정, 확인하지 못한 것, 리뷰어에게 묻고 싶은 것.
- WU-16 뒤에 "Phase 3 요약"을 적는다.

## 4. 멈추고 물어봐야 하는 경우

다음 중 하나라도 해당하면 그 WU를 커밋하지 말고 진행 기록에 상황을 적은 뒤 멈춘다.

1. 3.3절의 변경 금지 영역을 고쳐야만 진행할 수 있다. 특히 전체본 출력을 바꿔야 하는 경우다.
2. 저장 형식(로컬 기록, 백업, 기여 데이터)이 바뀐다.
3. 개인정보 불변 조건과 충돌한다. 예: 변형본이나 선택 상태를 저장해야 하는 경우, 변형본에 canonical에 없는 텍스트를 넣어야 하는 경우
4. 같은 WU에서 관문을 세 번 고쳐도 통과하지 못한다.
5. 3.3의 승인된 1건 외에 기존 테스트 기대값을 바꿔야 한다.
6. 새 의존성이 필요하다.
7. AI(서버 호출)가 필요해 보인다. 결정 1에 따라 Phase 3은 규칙 기반이다.

"작은 설계 판단"(내부 함수 분리, 컴포넌트 이름, 스타일)은 멈추지 말고 결정한 뒤 진행 기록에 남긴다.

## 5. WU별 사양

### WU-13. 변형 생성기와 충실성 검사기 (순수 로직)

#### 파일

| 파일                                                | 내용                                   |
| --------------------------------------------------- | -------------------------------------- |
| `src/content/export-variants.ts`(신규)              | 고정 문구 상수                         |
| `src/lib/export/profile-variants.ts`(신규)          | 생성 함수, 파일명 함수, 기준 시점 함수 |
| `src/lib/export/profile-variants-fidelity.ts`(신규) | 충실성 검사 함수                       |
| 각 `*.test.ts`와 테스트 전용 고정 데이터 파일       | 테스트                                 |

- `src/lib/export/*`는 아키텍처 가드 대상이다. 플랫폼 이름을 쓰지 않는다.

#### 고정 문구 (`src/content/export-variants.ts`)

```ts
export const VARIANT_FORMAT_VERSION = "1.0";

export const CORE_USAGE_RULES = [
  "이 문서는 반복해서 사용하는 교사의 핵심 맥락이다. 교과·단원·성취기준·시간처럼 수업마다 달라지는 정보는 요청에 따로 적는다.",
  "현재 요청의 정보가 이 문서와 다르면 현재 요청을 우선한다.",
  "AI 해석으로 표시된 내용은 교사가 승인한 해석이며, 교사가 직접 말한 사실처럼 단정하지 않는다.",
  "학생 개인을 추정하거나 분류하지 않고, 개인정보를 만들거나 요구하지 않는다.",
  "AI의 제안은 초안이며 최종 판단과 선택은 교사가 한다.",
] as const;

export const CORE_CLAIM_LABELS = { direct: "[직접]", inferred: "[AI 해석·교사 승인]" } as const;

export const MODULE_SCOPE_NOTICE = (titles: string) =>
  `이 문서는 교사 프로파일 중 다음 영역만 담고 있습니다: ${titles}. 담기지 않은 영역에 대한 교사의 선호나 조건을 추측하지 말고, 필요하면 사용자에게 먼저 물어보세요.`;

export const AS_OF_NOTICE = (date: string, source: "confirmed" | "generated") =>
  source === "confirmed"
    ? `이 내용은 ${date}에 확정한 기준입니다. 학기나 수업 집단이 바뀌면 다시 확인하세요.`
    : `이 내용은 ${date}에 작성한 기준입니다. 학기나 수업 집단이 바뀌면 다시 확인하세요.`;

export const CORE_EXCLUDED_NOTICE = (count: number, emptyModuleTitles: readonly string[]) => …;
// "> **확인되지 않은 문장 제외:** 확인되지 않은 문장 {count}개는 이 핵심본에서 제외했습니다. 전체본에서 확인하고 검토를 마쳐 주세요."
// emptyModuleTitles가 있으면 같은 인용 블록에 " 확인된 문장이 없는 영역: {제목들}." 를 덧붙인다.

export const EMPTY_SECTION_LINE = "- 확인된 내용이 없습니다.";

export const VARIANT_PICKER_HINT =
  "반복해서 쓸 때는 핵심본이 가볍습니다. 특정 작업에는 모듈 선택본을 쓰세요.";
```

- **전체본과 같아야 하는 문구는 문자열을 그대로 복사한 상수로 둔다.** 대상은 다음 세 가지다.
  - 근거 표시 3줄(`profile-to-markdown.ts` 165-167행)
  - 개인정보 경고 2종(173행, 178행)
  - 검토 필요 경고(185행)
- 테스트에서 이 상수 문자열이 실제 전체본 출력에 그대로 들어 있는지 확인한다. 전체본 파일은 import하지 않고 수정하지도 않는다.

#### 함수 (`src/lib/export/profile-variants.ts`)

```ts
export type ContextAsOf = { date: string; source: "confirmed" | "generated" }; // date: YYYY-MM-DD
export type OptionalSectionId =
  | "teachingDesignPrinciples"
  | "classSupportConsiderations"
  | "realisticConstraints";
export const OPTIONAL_SECTION_IDS: readonly OptionalSectionId[];
export type VariantResult =
  | { ok: true; markdown: string }
  | { ok: false; error: "invalid" | "pending_review" | "no_modules" };

/** ISO 시각 → 한국 시간(Asia/Seoul) 기준 YYYY-MM-DD. confirmedAt이 유효하면 "confirmed", 아니면 generatedAt으로 "generated". */
export function contextAsOf(
  profile: TeacherContextProfile,
  confirmedAt?: string | null,
): ContextAsOf;

export function profileToCoreMarkdown(
  profile: unknown,
  options: { asOf: ContextAsOf },
): VariantResult;

export function profileToModuleMarkdown(
  profile: unknown,
  options: {
    asOf: ContextAsOf;
    modules: readonly ProfileModuleId[];
    sections: readonly OptionalSectionId[];
  },
): VariantResult;

export function variantMarkdownFilename(
  schoolLevel: SchoolLevel,
  variant: "core" | "modules",
  date?: Date,
): string; // profileMarkdownFilename 결과의 ".md" 앞에 "-core" 또는 "-modules"를 붙인다
```

- 공통 입력 검증
  - `teacherContextProfileSchema` 검증에 실패하면 `invalid`
  - `isPendingPrivacyReview`이면 `pending_review`
  - `asOf.date`가 `YYYY-MM-DD`가 아니면 `invalid`
- 문장 정제
  - 전체본과 같은 `sanitizeMarkdownText`를 쓴다.
  - 여러 줄 문장은 전체본처럼 `\n`을 `\n  `로 바꿔 목록 항목 안에 둔다.

#### 머리말

```yaml
---
document_type: "teacher_profile_context"
export_variant: "core" # 또는 "modules"
variant_format_version: "1.0"
title: "수업 설계를 위한 교사 프로파일 컨텍스트" # CONTEXT_DOCUMENT_TITLE import(수정 아님)
profile_title: "…"
service: "TContext"
language: "ko-KR"
school_level: "…"
role: "…"
teaching_subject: "…" # 있을 때만
schema_version: "…"
created_at: "…"
context_as_of: "YYYY-MM-DD"
context_as_of_source: "confirmed" # 또는 "generated"
privacy_rule: "이름·학교명·특정 학급명·개별 학생 정보는 포함하지 않음"
privacy_review: "clear | needs_review"
needs_claim_review: true|false # 이 변형본에 들어간 문장 기준
included_modules: ["identity_and_role", …] # 모듈 선택본만, PROFILE_MODULE_IDS 순서
included_sections: ["realisticConstraints", …] # 모듈 선택본만
---
```

- 문자열 값은 `yamlQuoted`로 인용한다. 배열은 따옴표로 감싼 id의 YAML flow 목록으로 쓴다.
- `document_format_version`은 넣지 않는다.

#### 핵심본 구성 (순서 고정)

1. 머리말 → 빈 줄 → `# {profileTitle}`
2. `## 이 문서를 사용하는 방법` + `CORE_USAGE_RULES`를 `- ` 목록으로
3. 경고(인용 블록)
   - 개인정보: 확인 안 됨 → 경고 순서로 해당하는 것 하나
   - 제외 문장이 있으면 `CORE_EXCLUDED_NOTICE`
4. `## 요약` + `shortSummary`. 비어 있으면 섹션째 생략한다.
5. `## 확인된 교사 맥락`
   - 모듈 순서대로, **확인된 문장**(`confirmedByUser && basis !== "needs_confirmation"`)이 1개 이상인 모듈만 넣는다.
     - `### {module.title}`
     - 요약 문단(비어 있으면 생략)
     - `class_context`이면 `AS_OF_NOTICE` 문단
     - `- {CORE_CLAIM_LABELS[basis]} {text}`
   - 해당 모듈이 하나도 없으면 `- 확인된 문장이 없습니다.`
6. `## 수업 설계 원칙`
7. `## 학급 지원 고려사항` + 바로 아래 `AS_OF_NOTICE` 문단
8. `## 현실적인 제약과 대체안`
9. `## AI 협업 지침과 판단 경계`

- 6~9가 비어 있으면 `EMPTY_SECTION_LINE`을 넣는다.
- **중복 제거**
  - 비교 키: `sanitizeMarkdownText(text).replace(/\s+/gu, " ")`
  - 범위: 확인된 문장(모듈 순서) → 원칙 → 학급 지원 순서로 비교해, 앞에 같은 키가 있으면 뒤의 것을 뺀다.
  - **8(제약)과 9(AI 지침)는 중복 제거 대상이 아니다.** 항상 전부 넣는다(설계 3장, 제약 보존).

#### 모듈 선택본 구성 (순서 고정)

- `modules`가 비었으면 `no_modules`를 반환한다.
- 모듈 id를 중복 제거하고 `PROFILE_MODULE_IDS` 순서로 정렬한다. 알 수 없는 id나 섹션 id는 `invalid`다.

1. 머리말 → `# {profileTitle}`
2. `## 이 문서의 범위` + `MODULE_SCOPE_NOTICE(모듈 제목들을 "·"로 연결)` 문단 + `CORE_USAGE_RULES` 목록
3. `## 근거 표시를 읽는 법` + 전체본과 같은 3줄
4. 경고
   - 개인정보 경고(전체본과 같은 문자열)
   - 선택한 모듈 안에 미확인 문장이 있으면 전체본의 "검토 필요" 경고(같은 문자열)
5. 선택한 모듈마다 **전체본과 글자 단위로 같은 모듈 블록**
   - 형식: `## M{원래 번호}. {title}` → 빈 줄 → 요약 → 근거별 묶음(`### 교사가 직접 말한 내용` / `### AI가 답변을 종합해 해석한 내용` / `### 확인하거나 수정할 내용`, 각 문장 뒤 미확인이면 ` **[검토 전]**`, 문장이 없으면 `- 작성된 내용이 없습니다.`)
   - `class_context`면 블록 뒤에 빈 줄과 `AS_OF_NOTICE` 문단
6. 켜진 선택 섹션을 핵심본과 같은 제목으로, 원칙 → 학급 지원(+`AS_OF_NOTICE`) → 제약 순서로 넣는다. 중복 제거는 하지 않는다.
7. `## AI 협업 지침과 판단 경계`(항상)

- `shortSummary`는 넣지 않는다(결정 4).

#### 충실성 검사 (`src/lib/export/profile-variants-fidelity.ts`)

```ts
export type FidelityRule =
  "unknown_line" | "claim_coverage" | "constraints" | "ai_label" | "as_of";
export type FidelityIssue = { rule: FidelityRule; detail: string };
export function verifyVariantFidelity(input: {
  profile: TeacherContextProfile;
  variant: "core" | "modules";
  markdown: string;
  modules?: readonly ProfileModuleId[];
  sections?: readonly OptionalSectionId[];
  asOf: ContextAsOf;
}): FidelityIssue[]; // 문제가 없으면 빈 배열
```

| 규칙             | 실패 조건                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `unknown_line`   | 머리말 밖의 비어 있지 않은 줄(여러 줄 항목은 이어 붙여 하나로 본다)이 다음 어느 것에도 해당하지 않음: ① `export-variants.ts`와 전체본 복사 상수에서 만든 고정 줄 ② 고정 제목 ③ `- `·`- [라벨] ` 뒤의 텍스트가 canonical 텍스트(제목, 요약, 문장, 종합 항목)의 정제 결과와 같음 ④ 문단이 모듈 요약·`shortSummary`·`profileTitle` 정제 결과와 같음 |
| `claim_coverage` | 핵심본: 확인된 문장 중 (중복 제거된 것을 빼고) 빠진 것이 있거나, 미확인·확인 필요 문장이 들어 있거나, 제외 개수가 실제와 다름. 모듈 선택본: 선택한 모듈의 문장이 빠졌거나, 선택하지 않은 모듈의 문장이 들어 있음                                                                                                                                 |
| `constraints`    | 핵심본: `realisticConstraints`가 하나라도 빠짐. 모듈 선택본: 섹션이 켜졌는데 빠졌거나, 꺼졌는데 들어 있음. `aiCollaborationInstructions`는 두 변형 모두 항상 전부 있어야 함                                                                                                                                                                      |
| `ai_label`       | `basis === "inferred"`인 문장이 핵심본에서 `[AI 해석·교사 승인]` 없이 나오거나, 모듈 선택본에서 "AI가 답변을 종합해 해석한 내용" 묶음 밖에 나옴                                                                                                                                                                                                  |
| `as_of`          | 학급 맥락(`class_context` 모듈이나 학급 지원 섹션)이 들어갔는데 해당 위치에 `AS_OF_NOTICE`가 없음                                                                                                                                                                                                                                                |

#### 테스트

- **고정 데이터**
  - `FICTIONAL_PROFILES` 4건
  - 최대 크기 합성 프로필: 모듈당 문장 4개(총 28개), 종합 23개(6·6·5·6). 다음을 섞는다.
    - 직접·확인
    - AI 추론·확인
    - AI 추론·미확인
    - 확인 필요
    - 문장 하나와 완전히 같은 원칙 항목 1개
    - 여러 줄 문장 1개
    - `<`, `&`, `javascript:`가 들어간 문장 1개
    - 확인된 문장이 없는 모듈 1개
  - 경고·확인 안 됨 상태 프로필, 구형 프로필(`teachingSubject` 없음)
- **구성 테스트**
  - 2절의 순서, 머리말 필드, 중복 제거, 제외 개수, 기준 시점 문장
  - 핵심본에 `# 수업마다 추가할 작업 컨텍스트`, 실행 프롬프트, 자기 점검이 없음
  - 모듈 선택본에 `shortSummary`가 없음
- **전체본 일관성**: 각 모듈에 대해 전체본 출력에서 `## M{n}.` 줄부터 다음 `## M` 또는 `# 수업 설계 실행 가이드` 앞까지 잘라낸 블록이 모듈 선택본에 그대로 들어 있다. 복사 상수 5종이 전체본 출력에 그대로 들어 있다.
- **충실성**: 모든 고정 데이터와 다음 선택 조합에서 `verifyVariantFidelity`가 빈 배열이다.
  - 모듈 1개 / 3개 / 7개 × 섹션 전부 켬 / 전부 끔
- **변이 테스트**: 정상 출력을 고쳤을 때 해당 규칙이 잡힌다. 문장 끝 10자 자르기, AI 라벨 제거, 제약 1줄 삭제, 기준 시점 문장 삭제, 지어낸 목록 항목 삽입.
- **입력 검증**: `invalid`·`pending_review`·`no_modules`, 결정적 출력, `contextAsOf`의 한국 시간 날짜 변환(UTC 15:00 이후가 다음 날로 넘어가는지)

### WU-14. 결과 화면 "내보내기 형식" 패널

#### 파일

- `src/components/export/use-context-as-of.ts`(신규): 훅 `useContextAsOf(profile)`
  - `localProfileLink`가 있고 availability가 `enabled`이면 `getLocalProfile`로 확정본의 `confirmedAt`을 읽는다.
  - 그 밖이거나 읽지 못하면 `generatedAt`을 쓴다.
  - 결과는 `contextAsOf()`로 만든다.
- `src/components/export/export-variant-picker.tsx`(신규): 제어 컴포넌트
  - 값: `{ variant: "full" | "core" | "modules"; modules: ProfileModuleId[]; sections: OptionalSectionId[] }`
  - 형식 라디오(`fieldset`/`legend`)
    - 전체본: "모든 모듈과 수업 작업 양식"
    - 핵심본: "확인된 맥락과 원칙만, 반복 사용에 적합"
    - 모듈 선택본: "고른 영역만"
  - 모듈 선택본일 때
    - `PROFILE_MODULE_TITLES` 체크박스 7개 + **전체 선택** / **전체 해제**
    - 섹션 체크박스 3개
    - "AI 협업 지침과 판단 경계는 항상 포함됩니다" 안내
  - `VARIANT_PICKER_HINT`를 보조 문구로 둔다.
- `src/components/export/export-variant-panel.tsx`(신규)
  - 제목: "필요한 만큼만 전달하기"
  - 기본값: 전체본, 모듈 전부 선택, 섹션 전부 켬
  - 선택값으로 문자열 하나를 만든다(`useMemo`). 전체본은 세션의 `markdown`을 **그대로** 쓴다.
  - 미리보기: 읽기 전용 영역(`aria-label="내보낼 내용 미리보기"`, 고정 높이, 줄바꿈, `aria-live` 없음), 글자 수, "다른 AI에는 이 내용이 그대로 전달됩니다" 안내
  - **복사**, **Markdown 다운로드**
    - 다운로드는 `downloadTextFile`, BOM `true`
    - 파일명: 전체본은 기존 `profileMarkdownFilename`, 나머지는 `variantMarkdownFilename`
  - 모듈 0개이면 미리보기 대신 "모듈을 하나 이상 고르세요"를 표시하고 두 버튼을 비활성화한다.
  - 생성 오류는 사용자 문구로 표시한다(예: "검토를 마친 문서에서만 만들 수 있습니다").
  - 상태는 컴포넌트 메모리에만 둔다.

#### 연결

- `result-view.tsx`: `ResultActions` 바로 아래에 패널을 둔다. `useContextAsOf` 결과를 패널과 `ResultActions`에 넘긴다.
- `result-actions.tsx`(결정 2)
  - "짧은 AI 컨텍스트 복사" 버튼을 **"핵심본 복사"**로 바꾸고, 복사 내용은 `profileToCoreMarkdown(profile, { asOf })` 결과로 한다.
  - `COPY_LABELS.compact`는 `"핵심본"`이다. 생성에 실패하면 기존 복사 실패 문구를 쓴다.
  - `contextAsOf` prop을 추가한다(필수).
  - 다른 버튼은 바꾸지 않는다.
- `result-actions.test.tsx`: 승인된 예외 1건. 버튼 이름 "핵심본 복사"/"핵심본 복사됨", 기대값은 `profileToCoreMarkdown(profile, { asOf })`로 바꾼다. 테스트 렌더에는 `contextAsOf`를 넘긴다. 다른 케이스는 바꾸지 않는다.

#### 테스트(RTL)

- 세 형식에서 미리보기 문자열 = 복사 인자 = 다운로드 Blob 내용
- 전체본은 세션 `markdown`과 같다.
- 전체 선택·해제와 모듈 0개 비활성화, 섹션 토글이 출력에 반영된다.
- 연결된 문서는 `confirmedAt` 날짜, 연결되지 않은 문서는 `generatedAt` 날짜가 기준 시점에 쓰인다(가짜 저장소 주입).
- 패널이 IndexedDB를 새로 만들지 않는다(`open` 호출 없음, 또는 기존 DB만 읽음).

### WU-15. AI 활용 가이드 연결

- `src/components/ai-guide/guide-artifacts.tsx`
  - artifact `profile-markdown` 영역에 `ExportVariantPicker`를 둔다. "교사 Markdown 다운로드"가 선택한 형식으로 내려받는다.
  - 문서가 없으면 지금처럼 비활성화한다. 선택기도 비활성화한다.
  - 기준 시점은 `useContextAsOf`를 쓴다.
- skill zip(`skill-package`)과 지침 파일은 바꾸지 않는다.
- 렌더러에 플랫폼 이름 분기를 넣지 않는다. 대화 첨부 안내 문구는 `VARIANT_PICKER_HINT`(선택기 안)로 대신하며, 플랫폼 콘텐츠 파일은 고치지 않는다.
- 테스트(RTL)
  - 형식별 다운로드 내용
  - 문서 없음 비활성화
  - skill zip의 참고 파일은 여전히 전체본과 같다(기존 테스트 유지)

### WU-16. E2E와 문서

- `e2e/context-export.spec.ts`(신규). 기존 `e2e/helpers.ts`의 흐름을 재사용한다.
  1. 결과 화면 전체본: 미리보기 = 다운로드 파일 = 기존 "수업 설계용 Markdown 다운로드" 파일
  2. 핵심본: 파일명 `-core.md`
     - 확인된 문장과 기준 시점 문장이 있다.
     - 미확인 문장, `# 수업마다 추가할 작업 컨텍스트`, 실행 프롬프트가 없다.
     - "핵심본 복사" 버튼의 클립보드 내용이 핵심본과 같다(줄바꿈 CRLF→LF 정규화).
  3. 모듈 선택본: 모듈 2개만 선택하고 섹션 하나를 끈다.
     - 파일명 `-modules.md`
     - 범위 안내가 있고, 선택한 모듈 제목만 있으며, 꺼진 섹션은 없고, AI 협업 지침은 있다.
     - 모듈 0개면 버튼이 비활성화된다.
  4. AI 활용 가이드(문서 있음): 핵심본 선택 후 다운로드 내용 확인
  5. 320px에서 가로 넘침 없음. 키보드만으로 형식 라디오와 모듈 체크박스를 조작할 수 있음
  6. 저장 동의 없이 내보내기를 해도 IndexedDB가 생기지 않음
- 문서
  - `README.md`의 Markdown 절과 `docs/product-spec.md`: 전체본·핵심본·모듈 선택본 설명, "짧은 AI 컨텍스트"를 "핵심본"으로 바꾼 사실
  - `docs/context-export-design.md`: 구현 중 바뀐 점이 있으면 진행 기록에만 적고, 설계 문서는 고치지 않는다.
- 전체 관문(3.2) 통과 후 커밋하고, 진행 기록에 Phase 3 요약을 쓰고 멈춘다.

## 6. 완료 판단 (Phase 3)

- [ ] 세 형식을 결과 화면과 AI 활용 가이드에서 미리보고, 복사하고, 내려받을 수 있다.
- [ ] 핵심본과 모듈 선택본이 충실성 검사 5종을 모든 고정 데이터에서 통과한다.
- [ ] 전체본, 기여, 관리자 대조, skill zip, 저장 형식이 바뀌지 않았다.
- [ ] 승인된 1건 외에 기존 테스트 기대값이 바뀌지 않았다.
- [ ] 모든 관문이 통과했다(E2E 재시도 0).
