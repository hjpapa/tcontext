# 로컬 프로파일 구현 진행 기록

## WU-1a 직렬화·버전 판별 보강

- 상태: 완료
- 변경 파일: `src/lib/storage/profiles/{serialize,migrate}.ts`, 같은 폴더의 `{schema,serialize,migrate}.test.ts`, `src/types/profile.test.ts`(연속 빈 줄 하나 삭제), `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 777, 건너뜀 4) build - e2e -
- 설계·지시와 다르게 구현한 부분과 이유: 상세 지시문의 "다섯 파일"은 실제 열거된 6개 파일과 불일치하여 열거된 범위를 적용했다. runbook과 사용자 요청에 따라 이 진행 기록을 추가하고 커밋 요약 뒤에 WU 번호를 붙인다. 저장 형식과 기존 결과 타입은 변경하지 않았다.
- 이전 WU 수정: 담당 교과 선택 키 생략, 확정본·초안 태그 선택지 병합, 다른 realm의 객체 지원, 미래 프로파일 스키마 사전 판별, 업그레이드 복제·예외 처리. 상세 지시문에서 승인한 범위다.
- 확인하지 못한 것·남은 위험: 외부 서비스 연동 테스트 4개는 기존 설정에 따라 건너뛰었다. 실제 IndexedDB 검증은 WU-2 및 WU-9에서 수행한다. 최초 관문의 테스트 fixture 오삽입을 1회 수정한 뒤 모든 필수 관문과 변경 코드 6개 파일의 Prettier 일치를 확인했다.
- 리뷰어에게 묻고 싶은 것: 없음

## WU-2 IndexedDB 저장 계층

- 상태: 완료
- 변경 파일: `src/lib/storage/profiles/{database,repository}.ts`, `repository.test.ts`(DB 테스트 포함), `package.json`, `pnpm-lock.yaml`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 799, 건너뜀 4) build - e2e -
- 설계·지시와 다르게 구현한 부분과 이유: 허용된 대로 DB·저장소 테스트를 한 파일로 합쳤다. 공통 트랜잭션 래퍼가 설정 검사, 예외 변환, 연결 종료, 커밋 후 알림을 처리한다. 전체 삭제 함수는 삭제 옵션과 마지막 저장소 옵션을 별도 인자로 받는다. 진행 기록과 WU 번호는 runbook을 따랐다.
- 이전 WU 수정: 없음
- 확인하지 못한 것·남은 위험: fake-indexeddb에서 databases 지원·미지원·예외 경로 모두 동의 전 DB 미생성을 확인했다. 실제 브라우저의 업그레이드 중단, databases, durability 동작은 WU-9에서 확인한다. 디스크 내구성은 메모리 구현에서 검증할 수 없다. 최초 lint의 미사용 타입 import를 1회 수정했다. 설치 중 기존 ESLint·하위 의존성 deprecated 및 peer 경고가 있었으며 의존성 변경은 fake-indexeddb 6.2.5뿐이다.
- 리뷰어에게 묻고 싶은 것: 없음

## WU-3 JSON 백업 생성·파싱과 결과 화면 다운로드

- 상태: 완료
- 변경 파일: `src/lib/export/{files,download}.ts`, `src/lib/storage/profiles/{backup,backup.test}.ts`, `src/components/export/{result-actions,result-view,result-backup.test}.tsx`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 805, 건너뜀 4) build - e2e -
- 설계·지시와 다르게 구현한 부분과 이유: downloadTextFile은 설계 7장의 범위에 따라 download.ts에 두고 files.ts에는 ExportFile 타입만 둔다. 다운로드 실패는 결과 객체로 반환하고 기존 downloadMarkdown 시그니처는 유지한다. 백업 왕복 비교는 지시된 privacyReview의 PENDING 정규화만 반영해 엄격 비교했다.
- 이전 WU 수정: 없음
- 확인하지 못한 것·남은 위험: 실제 브라우저 다운로드·가져오기 흐름은 WU-9에서 확인한다. RTL에서 IDB open 0회, 다운로드 실패 안내, JSON 무BOM·Markdown BOM 및 파일명 정리를 검증했다. React 체크리스트의 이벤트 처리, 상태 분리, 접근 가능한 오류 안내를 확인했다.
- 리뷰어에게 묻고 싶은 것: 없음

## WU-4 세션 연결과 태그 보존

- 상태: 완료
- 변경 파일: `src/components/layout/interview-session-provider.tsx`, `src/components/interview/interview-flow.tsx`, `src/components/profile/profile-review.tsx`, `src/components/local-profiles/{local-profiles-provider,session-integration.test}.tsx`, `src/app/layout.tsx`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 808, 건너뜀 4) build ✓ e2e -
- 설계·지시와 다르게 구현한 부분과 이유: openedAt은 같은 밀리초에 다시 열어도 증가하도록 이전 값+1과 Date.now의 최댓값을 사용한다. Provider는 마운트 시 availability만 읽고, 명시적 refresh와 채널 알림에서 목록을 읽는다. 기존 단독 컴포넌트 테스트와 저장 비활성 환경을 위해 기본 context는 unknown 상태다.
- 이전 WU 수정: 없음
- 확인하지 못한 것·남은 위험: 기존 RTL을 수정 없이 통과했다. 새 통합 테스트의 응답 필드·태그 비교 및 React 검사 지적을 1회 수정했다. 빌드와 typecheck 동시 실행 시 생성 파일 경합이 발생하여 이후 순차 실행한다. 최종 상태로 빌드를 다시 통과했다. 실제 브라우저 회귀는 WU-9에서 수행한다.
- 리뷰어에게 묻고 싶은 것: 없음

## WU-5 결과 화면 로컬 저장(opt-in)

- 상태: 완료
- 변경 파일: `src/components/local-profiles/{local-save-panel,local-save-panel.test}.tsx`, `src/components/export/result-view.tsx`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 810, 건너뜀 4) build ✓ e2e -
- 설계·지시와 다르게 구현한 부분과 이유: 없음. 로컬 저장 동의·진행·오류는 기여 패널과 분리했다. 저장 중 비활성화, 상한, 사용 불가·미래 버전, 연결된 기록의 저장 시각을 표시한다. 내 프로파일 메뉴는 WU-6까지 추가하지 않았다.
- 이전 WU 수정: 없음
- 확인하지 못한 것·남은 위험: 실제 브라우저의 320px 레이아웃은 WU-9에서 확인한다. 기존 기여 테스트는 수정 없이 통과했다. 새 테스트의 Hook 의존성 경고를 수정했다(첫 수정 스크립트의 문법 오류로 1회 미적용되어 재적용 후 lint 통과).
- 리뷰어에게 묻고 싶은 것: 없음

## WU-6 내 프로파일 화면과 가져오기

- 상태: 완료
- 변경 파일: `src/app/profiles/page.tsx`, `src/components/local-profiles/{profile-library,backup-import,saved-profiles-entry,local-profile-delete-controls,profile-library.test}.tsx`, `src/app/page.tsx`, `src/components/layout/{primary-nav,app-shell}.tsx`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 812, 건너뜀 4) build ✓ e2e -
- 설계·지시와 다르게 구현한 부분과 이유: 내부 ConfirmLocalAction으로 파괴적 동작 확인을 공통 처리했다. 학교급은 기존 순수 표시 모듈의 한국어 라벨을 재사용했다. 내비게이션은 모바일에서 아이콘과 aria-label을 사용하고 헤더 여백을 줄였다.
- 이전 WU 수정: 없음
- 확인하지 못한 것·남은 위험: 새 통합 테스트에서 꺼진 상태의 방문·메모리 가져오기 무생성, 일치 recordId 가져오기 시 확정본 보존을 검증했다. 실제 키보드·Pixel 7·320px 화면과 전체 가져오기 선택지 E2E는 WU-9에서 확인한다. 기존 테스트 기대값은 변경하지 않았다.
- 리뷰어에게 묻고 싶은 것: 없음

## WU-7 검토 화면 편집 강화와 자동 저장

- 상태: 완료
- 변경 파일: `src/lib/profile/{changes,changes.test}.ts`, `src/components/profile/profile-review.tsx`, `src/components/local-profiles/{use-local-draft-autosave,use-local-draft-autosave.test,local-draft-status,local-review.test,local-profiles-provider,local-save-panel}.tsx`(자동 저장 훅 본체는 `.ts`), `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 822, 건너뜀 4) build ✓ e2e -
- 설계·지시와 다르게 구현한 부분과 이유: 훅 내부 컨트롤러가 초안·확정 저장을 직렬화하고 화면을 떠난 뒤에도 큐를 마친다. 상태는 Provider에 올려 결과 화면에서 표시하며 recordId와 openedAt으로 연결을 구분한다. 충돌 덮어쓰기는 명시적 확인 이후 최신 revision으로 재시도한다.
- 이전 WU 수정: WU-4 Provider와 WU-5 저장 패널에 확정 저장 결과 전달을 추가했다. 초안만 있는 기록을 버릴 때 메모리 문서도 비워 삭제된 문서가 남지 않게 했다.
- 확인하지 못한 것·남은 위험: 새 테스트의 타입·fixture와 lint 지적을 1회 수정 후 관문을 통과했다. 기존 늦은 응답 테스트를 포함해 기존 테스트는 변경하지 않았다. 종료 직전 IndexedDB 저장 완료는 브라우저 종료 시점에 따라 보장할 수 없다. 실제 재접속·다중 탭은 WU-9에서 검증한다.
- 리뷰어에게 묻고 싶은 것: 직렬 큐의 확정 우선 처리와 다중 탭 충돌 해소 흐름을 중점 검토해 주세요.

## WU-8 개인정보 안내·문서

- 상태: 완료
- 변경 파일: `README.md`, `docs/{privacy-design,data-dictionary,product-spec}.md`, `src/app/privacy/page.tsx`, `src/components/privacy/browser-record-controls.tsx`, `src/components/profile/profile-review.tsx`, `src/components/export/result-view.tsx`, `src/components/layout/app-shell.tsx`, `src/components/local-profiles/privacy-local-storage.test.tsx`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 823, 건너뜀 4) build ✓ e2e -
- 설계·지시와 다르게 구현한 부분과 이유: 없음。원문 답변 미저장, opt-in 로컬 보관과 서버 기여의 차이, 자동 만료 없음, 공용 기기·소실 주의, 삭제 범위를 문서와 화면에 반영했다. 홈의 “저장 없이도 완성” 제목은 유지했다.
- 이전 WU 수정: WU-4 검토 빈 화면, WU-5 결과 빈 화면, WU-6 푸터의 안내를 현재 저장 정책에 맞췄다.
- 확인하지 못한 것·남은 위험: 안내 문구를 검색 점검했고 RTL에서 탭 기록 삭제 후 저장본 유지, 전체 삭제 취소 시 보존, 확인 시 DB와 설정 제거를 검증했다. 실제 브라우저 삭제·재접속 검증은 WU-9에서 수행한다.
- 리뷰어에게 묻고 싶은 것: 없음

## WU-9 E2E와 Phase 1 회귀

- 상태: 완료. 중간 리뷰와 사용자 승인 후 WU-9a 지시문 0단계에 따라 커밋한다.
- 변경 파일: `e2e/local-profiles.spec.ts`, `e2e/helpers.ts`, `e2e/tcontext.spec.ts`(헬퍼 이동과 import만), `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 823, 기존 건너뜀 4) build ✓ e2e ✓(chromium 26, mobile 26, 총 52 통과)
- 설계·지시와 다르게 구현한 부분과 이유: 8.4표의 Phase 1 시나리오를 6개 테스트에 묶어 두 프로젝트에서 실행했다. 첫 개발 서버 실행은 51개 통과, 1개 실패였다. 실패한 경고 재검토에서 `/review` 전체 재로드와 메모리 문서 소실이 관찰되었으나 정확한 원인은 확인하지 못했다. 기대값이나 제품 코드를 바꾸지 않고 프로덕션 빌드의 서버로 전체 52개를 재실행하여 모두 통과했다. pnpm PATH와 개발 중 재컴파일 영향을 피하기 위해 서버를 corepack으로 별도 실행하고 PLAYWRIGHT_BASE_URL을 지정했다.
- 이전 WU 수정: 없음
- 확인하지 못한 것·남은 위험: 실서비스 OpenAI·Supabase는 호출하지 않고 기존 API 모킹을 재사용했다. Chromium과 Pixel 7 에뮬레이션을 검증했으며 실제 기기·다른 브라우저·장기간 보존·강제 종료 직전 저장은 별도 확인 대상이다. 기존 테스트 본문 및 이동한 헬퍼가 원본과 동일함을 비교했고, 금지 영역 변경과 런타임 의존성 추가가 없음을 확인했다.
- 리뷰어에게 묻고 싶은 것: WU-4·WU-7의 세션 연결·태그 보존·직렬 저장 큐와 충돌 해소를 중점 검토해 주세요. runbook 3.1의 WU별 커밋 규칙과 4절의 “그 WU를 커밋하지 말고” 및 7번 “WU-9 완료”가 겹쳐, 사용자도 강조한 정지 규칙을 우선해 WU-9는 미커밋으로 남겼다. WU-9 커밋은 2026-10-25 중간 리뷰와 사용자 지시로 승인되었다.

최종 E2E 재현 순서(두 번째 명령은 별도 터미널에서 유지):

```powershell
corepack pnpm build
corepack pnpm start --port 3100
```

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3100'
corepack pnpm test:e2e
```

## Phase 1 요약

- 완료 범위: WU-1a~WU-9 구현·검증 완료. 선택적 로컬 저장, 편집 초안 자동 저장, JSON 백업·복원, 삭제·충돌 처리와 개인정보 안내를 구현했다. 중간 정지는 완료되었으며 사용자 지시에 따라 후속 WU를 진행한다.
- 전체 관문: lint·typecheck·build 통과. 테스트 823개 통과·기존 4개 건너뜀. E2E 52개 통과(Chromium 26, 모바일 26; 기존 40개 포함).
- 브랜치·커밋: `feat/local-profiles`. WU-1a~WU-8은 각각 1개, 총 8개 커밋 완료. WU-9와 이 요약도 정정된 runbook 및 WU-9a 0단계에 따라 함께 커밋한다.
- 남은 위험: 개발 서버 E2E에서 재로드로 1건 실패했으나 프로덕션 빌드 전체 실행은 통과했다. 실제 기기·다른 브라우저와 강제 종료 직전 저장·장기 보존은 확인하지 못했다.
- 리뷰 요청: WU-4·WU-7의 세션·태그·저장 큐·다중 탭 충돌을 우선 검토하고, WU-9 커밋은 2026-10-25 중간 리뷰와 사용자 지시로 승인되었다.

## WU-9a Phase 1 중간 리뷰 후속 수정

- 상태: 완료
- 변경 파일: `src/components/local-profiles/{edit-again-button,review-fixes.test,local-save-panel,local-profile-delete-controls,local-draft-status,saved-profiles-entry,profile-library,backup-import,local-review.test,privacy-local-storage.test,profile-library.test}.tsx`, `src/components/export/result-view.tsx`, `src/components/profile/profile-review.tsx`, `playwright.config.ts`, `e2e/local-profiles.spec.ts`, `docs/data-dictionary.md`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 837, 기존 건너뜀 4) build ✓ e2e ✓(chromium 27, mobile 27, 총 54 통과; CI=1, 재시도 0)
- 설계·지시와 다르게 구현한 부분과 이유: EditAgainButton은 기존 탐색 링크의 의미와 접근 가능한 이름을 유지하면서 클릭 시 저장소를 확인한다. F4의 승인된 접근성 이름·확인 버튼 문구 변경에 맞춰 Phase 1에서 추가한 테스트의 선택자만 갱신했고, 동작 기대값과 bd81a2e 이전 테스트는 바꾸지 않았다. F6 지정 파일을 포맷했다.
- 이전 WU 수정: F1~F5에 따라 기존 초안 이어서 수정·확정본에서 시작 선택, 저장 중·실패 표시, 확정 충돌 덮어쓰기, 기준 확정본 없는 문서 안내, 접근성·배지·가져오기 제목·홈 진입점·학교급 라벨·상한 상수를 수정했다. F7은 CI에서만 프로덕션 서버를 실행하며 ci.yml은 수정하지 않았다.
- 확인하지 못한 것·남은 위험: 저장 형식·스키마·저장소 API는 바꾸지 않았다. CI=1 및 PLAYWRIGHT_BASE_URL 미설정으로 실행했고 WebServer 로그에서 next start를 확인했다. 현재 PATH의 Codex 런타임 pnpm 래퍼를 서버 실행에 사용할 수 있어 corepack enable이나 별도 서버 우회는 필요하지 않았다. 관문 명령은 corepack pnpm으로 실행했다.
- 리뷰어에게 묻고 싶은 것: 없음
