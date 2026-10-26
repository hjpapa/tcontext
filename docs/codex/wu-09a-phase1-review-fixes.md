# Codex 작업 지시: WU-9a Phase 1 중간 리뷰 후속 수정

- 근거: Claude의 Phase 1 중간 리뷰(2026-10-25, 대상 `499f781`~`a971cd0`와 미커밋 WU-9)
- 선행 작업: 아래 0단계(WU-9 커밋)
- 산출물: 커밋 2개(WU-9, WU-9a). 이어서 runbook에 따라 WU-10~12를 진행한다.
- 규칙: `docs/codex/runbook.md`의 3절(관문·금지 영역·진행 기록)과 4절(멈춤 조건)을 그대로 적용한다.

## 0. 먼저 WU-9를 커밋한다

리뷰 결과 WU-9는 그대로 커밋해도 된다. 미커밋으로 남은 것은 runbook 4절 7번의 문구 오류 때문이었고, runbook은 정정했다.

- 포함 파일: `e2e/local-profiles.spec.ts`, `e2e/helpers.ts`, `e2e/tcontext.spec.ts`, `docs/codex/progress.md`
- `docs/codex/runbook.md`, `docs/codex/platform-facts.md`, 이 지시문, 설계 문서는 Claude가 이미 커밋했다. WU-9 커밋에 섞지 않는다.
- 메시지: `Add Phase 1 local profile end-to-end coverage (WU-9)`

## 1. 목표

중간 리뷰에서 찾은 문제를 고친다. 데이터 손실 버그 1건(F1), 상태 표시 오류 1건(F2), 낮은 심각도의 화면·접근성 문제(F3~F6), CI E2E 실행 방식(F7)이다. 저장 형식, 스키마, 저장소 API는 바꾸지 않는다.

## 2. 수정 범위

### F1. "다시 수정하기"가 기존 편집 초안을 경고 없이 덮어씀 (중간 · 데이터 손실)

- **재현 경로**
  1. 내 프로파일에서 편집 초안이 있는 기록을 **보기**로 연다. 세션에는 확정본이 올라가고, link의 revision은 기록의 현재 revision이다.
  2. 결과 화면에서 **다시 수정하기**(`result-view.tsx:193`, 단순 `<Link href="/review">`)를 누른다.
  3. 아무 문장이나 고친다.
  4. 자동 저장이 확정본을 바탕으로 한 내용으로 `saveDraft`를 호출하고, revision이 일치하므로 **기존 초안이 대체된다.**
- **수정**
  - `src/components/local-profiles/edit-again-button.tsx`를 새로 만들고 `result-view.tsx`의 Link를 이것으로 바꾼다.
  - 처리 흐름
    - link가 없거나 availability가 `enabled`가 아니면: 지금처럼 `/review`로 이동한다.
    - link가 있으면 `getLocalProfile(link.recordId)`를 호출한다.
      - 실패: 오류 문구를 보여주고 이동하지 않는다.
      - 초안이 없음: `/review`로 이동한다.
      - **초안이 있음**: AlertDialog를 연다. 제목은 "편집 중인 초안이 있습니다"이고 선택지는 두 개다.
        - **초안 이어서 수정**(기본): `toEditableSession` → `openProfile(edit)` → `/review`
        - **확정본에서 새로 시작**: 설명에 "첫 수정이 저장되면 기존 초안은 대체됩니다"를 적는다. 그대로 `/review`로 이동한다.
      - 취소하면 그대로 머문다.
- **테스트**
  - RTL: 초안이 있는 기록에서 대화상자가 나오고, 각 선택에 따른 세션 내용과 이동 경로를 확인한다. 초안이 없거나 link가 없으면 대화상자 없이 이동한다.
  - E2E(`e2e/local-profiles.spec.ts`에 추가): 초안을 만든 뒤 보기 → 다시 수정하기 → "초안 이어서 수정" → 초안 문장이 보이고 IndexedDB 초안이 그대로다.

### F2. 확정본 저장 실패·진행 중에도 "저장됨"이 표시됨 (중하 · 오해 유발)

- **위치**: `local-save-panel.tsx`의 연결 상태 블록(126-136행)
- **문제**: `currentWrite`가 `saving`이나 `error`여도 "저장됨 · (이전 updatedAt)"이 함께 표시된다. 교사가 최신 확정본이 저장됐다고 오해할 수 있다.
- **수정**
  - `saving`: "확정본 저장 중…"만 표시한다.
  - `error`: 제목을 "최신 확정본을 이 브라우저에 저장하지 못했습니다"로 하고, 오류 문구와 "Markdown·JSON 다운로드는 계속 사용할 수 있습니다"를 표시한다. "저장됨"은 표시하지 않는다.
  - `error`가 `conflict`인 경우: **"이 확정본으로 덮어쓰기"** 동작을 추가한다.
    - 확인 대화상자를 거친다. 설명: "다른 탭에서 저장한 내용이 이 확정본으로 바뀝니다."
    - 확인하면 `getLocalProfile`로 현재 revision을 읽고, `toConfirmedSnapshot(세션 profile)` → `saveConfirmed(expectedRevision=현재 revision)`를 호출한다.
    - 성공하면 link의 revision과 baseline을 갱신하고, write status를 `saved`로 설정한다.
  - 저장 성공 상태와 연결만 된 상태(저장 기록 없음)는 지금처럼 "저장됨 · 시각"이다.
- **테스트**: RTL로 `saving`, `error`(일반), `error`(conflict) → 덮어쓰기 성공, 정상 저장의 4가지 표시를 확인한다.

### F3. 가져온 초안(확정본 없음)에 "확정본 대비 변경"과 "새 문장" 배지가 전부 표시됨 (하)

- **위치**: `profile-review.tsx`의 `changes` 계산(약 409행)과 표시
- **수정**
  - `localProfileLink.baseline`이 `null`이면 diff를 계산하지 않는다.
  - 대신 다음 안내를 한 번 표시한다: "확정본이 없는 가져온 초안입니다. 모든 문장을 다시 확인한 뒤 검토를 마쳐 주세요."
  - 문장별·모듈별 배지는 표시하지 않는다.
- **테스트**: RTL로 baseline이 `null`인 연결에서 배지 0개와 안내 1개를 확인한다.

### F4. 접근성·표시 (하)

1. 모듈별 **문장 추가** 버튼 7개가 모두 같은 이름이다. `aria-label={`${PROFILE_MODULE_TITLES[module.id]} 문장 추가`}`를 붙인다. 보이는 텍스트는 그대로 둔다.
2. "확정본 대비 변경 N곳"의 `aria-live="polite"`를 제거한다. 입력할 때마다 화면 낭독기가 읽기 때문이다.
3. "변경", "새 문장", "수정됨" 배지가 스타일 없는 `<span>`이다. 같은 파일의 기존 배지 클래스(예: 미확인 개수 배지)와 같은 형태로 스타일을 준다.
4. `ConfirmLocalAction`에 `confirmLabel`과 `destructive` prop을 추가한다. 기본값은 "계속"이다.
   - 삭제: "삭제", 모두 삭제: "모두 삭제", 초안 버리기: "초안 버리기", 덮어쓰기: "덮어쓰기"
   - 파괴적 동작은 `variant="destructive"`로 표시한다.

### F5. 문구·표시 정리 (하)

1. `backup-import.tsx`의 섹션 제목 "JSON 불러와 저장하지 않고 열기"를 **"JSON 백업 불러오기"**로 바꾼다. 저장 선택지도 있는 섹션이기 때문이다. "저장하지 않고 열기" 버튼은 그대로 둔다.
2. `SavedProfilesEntry`: 목록을 읽기 전이거나 기록이 0개이면 아무것도 렌더링하지 않는다. 지금은 잠깐 "0개"가 보인다.
3. `profile-library.tsx`와 `backup-import.tsx`의 학교급 라벨: 관리자 모듈(`@/lib/admin/presentation`) 대신 `@/content/profile-document`의 `SCHOOL_LEVEL_DISPLAY_LABELS`를 import한다. 공개 화면이 관리자 모듈에 의존하지 않게 하기 위해서다. 그 파일은 import만 하고 수정하지 않는다.
4. `profile-library.tsx`의 "/ 10개"는 `MAX_LOCAL_PROFILES`를 쓴다.

### F6. 포맷

- `e2e/local-profiles.spec.ts`, `docs/data-dictionary.md`, `docs/codex/progress.md`를 Prettier 기준에 맞춘다. 내용은 바꾸지 않는다.

### F7. CI의 E2E를 프로덕션 서버로 실행 (2026-10-25 사용자 승인)

- 배경(Claude 재현)
  - 개발 서버에서 워커 2개로 `local-profiles.spec.ts`를 4번씩(48회) 반복하자, "requires a fresh warning acknowledgement…"가 1회 실패했다. `/review`가 전체 새로고침되어 메모리 문서가 사라진 경우다.
  - 같은 스위트는 프로덕션 서버(52/52)와 개발 서버 워커 1개(52/52)에서 모두 통과했다. 그래서 앱 로직 결함이 아니라 개발 서버의 병렬 부하에서 생기는 현상으로 판단한다.
- 수정: `playwright.config.ts`의 `webServer.command`만 바꾼다.
  - CI(`process.env.CI`가 참)에서는 `pnpm start --port 3100`을 쓴다. CI는 E2E 전에 이미 `pnpm build`를 실행한다(`.github/workflows/ci.yml`).
  - 로컬에서는 지금처럼 `pnpm dev --port 3100`을 쓴다.
  - `url`, `reuseExistingServer`, `PLAYWRIGHT_BASE_URL` 분기는 그대로 둔다.
- 확인
  - 로컬에서 `$env:CI="1"`로 설정하고 build → `test:e2e`를 실행해 서버가 `next start`로 뜨고 전체가 통과하는지 본다. 이 PC에서 `pnpm`이 PATH에 없으면 `corepack enable`이나 `PLAYWRIGHT_BASE_URL` 방식으로 확인하고, 그 사실을 진행 기록에 적는다.
  - `ci.yml`은 수정하지 않는다.

## 3. 범위 밖(이번에 하지 않음)

- 저장 형식, 스키마, 저장소 API 변경
- `profileToMarkdown` 등 변경 금지 영역(runbook 3.3)

## 4. 완료 조건

- [ ] WU-9 커밋이 0단계의 파일만 포함한다.
- [ ] F1~~F7이 모두 반영되고, F1~~F5에는 각 항목의 테스트가 있다.
- [ ] 관문: `lint`, `typecheck`, `test`, `build`, `test:e2e`(chromium·mobile)가 모두 통과한다. 기존 테스트 기대값은 수정하지 않는다.
- [ ] 진행 기록에 "WU-9a" 절을 추가한다.
- [ ] 커밋 메시지: `Fix review findings for local profile editing and status (WU-9a)`
- [ ] 커밋한 뒤 멈추지 않고 runbook 1절 순서대로 WU-10을 이어서 시작한다. WU-9a는 WU-12 뒤의 최종 리뷰에서 함께 검토한다.
