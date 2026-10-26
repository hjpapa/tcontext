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

## WU-10 콘텐츠 스키마와 데이터

- 상태: 완료
- 변경 파일: `src/content/usage-instructions.ts`, `src/content/platform-guides/{schema,chatgpt,gemini,claude,index,schema.test}.ts`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 846, 기존 건너뜀 4) build ✓ e2e -
- 설계·지시와 다르게 구현한 부분과 이유: 없음. 플랫폼 사실·상태·URL·확인일은 platform-facts.md만 사용했다. 공통 지침은 instruct.md 4.6과 원문 일치 테스트로 고정했다. 스키마 파싱은 테스트에서만 수행한다. runbook의 단계 순서대로 이 커밋에서는 skill 방법에 Markdown·공통 지침만 연결하며, WU-10a에서 skill-file을 추가한다.
- 이전 WU 수정: 없음
- 확인하지 못한 것·남은 위험: 외부 서비스 화면은 직접 조작하지 않았다. 플랫폼 사실은 2026-10-25 검증 자료이며 사용자별 요금제·배포 상태에 따라 달라질 수 있다. 아직 생성하지 않는 skill-package는 콘텐츠 검증에서 거절한다.
- 리뷰어에게 묻고 싶은 것: 없음

## WU-10a 단일 파일 SKILL.md 내보내기

- 상태: 완료
- 변경 파일: `src/lib/export/{skill,skill.test}.ts`, `src/content/usage-instructions.ts`, `src/content/platform-guides/{schema,gemini}.ts`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 849, 기존 건너뜀 4) build ✓ e2e -
- 설계·지시와 다르게 구현한 부분과 이유: 없음. 고정 name·description만 YAML 머리말에 넣고 기존 Markdown의 맨 앞 머리말만 제거했다. now는 지정된 입력 시그니처에 포함하지만 산출물 시각은 canonical 문서의 생성 메타데이터를 그대로 사용한다. 공개 형식 생성기에는 플랫폼 이름을 넣지 않았으며 기존 Markdown 생성기는 수정하지 않았다.
- 이전 WU 수정: WU-10의 skill 방법에 skill-file artifact를 연결하고 승인된 업로드 단계·계정 조건·파일명 확인·수정 후 재업로드 안내로 바꿨다.
- 확인하지 못한 것·남은 위험: platform-facts.md 6절의 실제 계정 표본 업로드·사용은 아직 미확인이다. 승인된 지시에 따라 이 결과를 기다리지 않고 구현했으며 최종 리뷰에서 확인해야 한다. zip 패키지는 만들지 않는다.
- 리뷰어에게 묻고 싶은 것: 표본 SKILL.md의 실제 업로드와 활용 결과를 최종 리뷰 때 확인해 주세요.

## WU-11 범용 가이드 화면

- 상태: 완료
- 변경 파일: `src/app/ai-guide/page.tsx`, `src/app/ai-guide/[platform]/page.tsx`, `src/components/ai-guide/{platform-guide-view,guide-artifacts,guide.test}.tsx`, `src/components/export/result-view.tsx`, `src/app/profiles/page.tsx`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 854, 기존 건너뜀 4) build ✓ e2e -; 실제 브라우저 8개 경로·폭 조합 확인
- 설계·지시와 다르게 구현한 부분과 이유: 없음. 플랫폼 문자열 분기 없이 콘텐츠 상태로 렌더링하고, 다운로드·복사만 클라이언트 컴포넌트로 분리했다. 문서가 없으면 파일 버튼을 비활성화하고 지침 복사는 허용한다. 종료·출시 예정 방법은 접힌 안내로 표시한다.
- 이전 WU 수정: 결과 화면과 내 프로파일 화면에 AI에서 활용하기 진입점을 연결했다.
- 확인하지 못한 것·남은 위험: 프로덕션 서버에서 목록과 세 상세 경로를 320px·393px로 검사하여 모두 HTTP 200, 가로 넘침 0, 페이지 오류 0, main 영역 1개를 확인했다. 320px 스크린샷도 확인했다. 전체 E2E와 실제 다운로드·클립보드는 WU-12에서 검증한다. 외부 서비스에 자동 업로드하지 않는다.
- 리뷰어에게 묻고 싶은 것: 없음

## WU-12 중단 및 재개 이력

- 최초에는 문서 변경 `b863e55` 확인을 놓쳐 WU-10a·11을 이전 단일 파일 사양으로 구현한 사실을 발견했다. 기존 테스트 기대값 변경이 필요하여 runbook 4절 5번에 따라 WU-12를 커밋하지 않고 멈췄다.
- 사용자가 WU-10a·11의 최신 ZIP·지침 전용 파일 사양 반영과 관련 테스트 변경을 승인했다. runbook WU-10a 절과 platform-facts.md 5절을 다시 읽고 같은 WU-12에서 재개했다. 기존 커밋은 수정하지 않았다.
- 위 WU-10a·11 기록은 당시 구현·검증 결과다. 최신 사양 충족 여부는 아래 최종 기록을 따른다.

## WU-12 가이드 E2E와 전환 시뮬레이션

- 상태: 완료. WU-10a·11의 최신 사양 보정을 함께 포함한다.
- 변경 파일: `src/lib/export/{files,download,skill,skill.test,zip,zip.test,zip.test-helper,download-binary.test}.ts`, `src/content/usage-instructions.ts`, `src/content/platform-guides/{schema,schema.test,gemini,chatgpt,claude}.ts`, `src/components/ai-guide/{guide-artifacts,guide.test,transition.test}.tsx`, `src/components/ai-guide/renderer-contract.test.ts`, `e2e/ai-guide.spec.ts`, `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 871, 기존 건너뜀 4) build ✓ e2e ✓(Chromium 31, mobile 31, 총 62 통과; CI=1, 재시도 0, 프로덕션 next start)
- 설계·지시와 다르게 구현한 부분과 이유: ExportFile은 Content 제네릭으로 string·Uint8Array를 지원하되 기본값은 string으로 두어 기존 JSON 백업 생성기의 공개 반환 타입을 보존했다. 다운로드 경계는 두 형식을 모두 받는다. ZIP 날짜는 UTC를 쓰고 DOS 날짜 표현 범위(1980~2107)로 제한한다. 테스트 전용 독립 ZIP 판독기를 단위 검사와 E2E에서 공유한다. 플랫폼 사실·상태·URL·확인일은 승인된 문서 값을 유지한다.
- 이전 WU 수정: WU-10a의 단일 파일 생성기를 createSkillPackageFile로 교체하여 `teacher-context/SKILL.md`와 `teacher-context/references/teacher-profile.md` 두 파일을 무압축 ZIP으로 만든다. 참고 파일은 기존 profileToMarkdown 결과와 바이트 단위로 같다. createUsageInstructionsFile은 프로필 없이 지침 전용 SKILL.md를 만든다. WU-11은 skill-package 다운로드와 문서 없이 가능한 지침 파일 다운로드를 연결하고, 세 플랫폼의 A 방식 단계와 Gemini Replace skill 안내를 최신 사양으로 바꿨다. 사용자 승인에 따라 WU-10·10a·11에서 추가한 콘텐츠·산출물 테스트를 새 계약으로 갱신했다. bd81a2e 이전 테스트, 기존 Markdown·JSON 계약, 서버·저장 스키마·의존성은 변경하지 않았다.
- 검증 근거: ZIP CRC-32 표준값, UTF-8 한글 경로, 로컬 헤더·중앙 디렉터리·EOCD, 크기·내용·결정성, 경로/ZIP64 한도 거부, 바이너리 BOM 미삽입을 검사했다. 개인정보·미확인 경고 보존, 검사 대기/잘못된 입력 거부, 고정 지침에 프로필 미포함을 확인했다. RTL은 콘텐츠 상태 변경만으로 권장·종료·출시 예정 표시가 전환됨을 검사한다. E2E는 세 플랫폼의 실제 파일·클립보드, 메모리 없는 지침 다운로드, DB 미생성, 외부 링크 고지, 320px 넘침 없음과 미등록 경로 404를 검사한다.
- 관문 보정 이력: 새 RTL 선택자의 지원되지 않는 exact 옵션 3곳을 제거해 타입 검사를 통과했다(이름 문자열의 정확 일치 의미는 유지). 전체 테스트 871개는 통과했고 해당 RTL도 수정 후 재통과했다. 첫 E2E는 기존 54개 통과·새 8개 실패였으며 원인은 Windows 클립보드의 CRLF 반환이었다. 클립보드 경계의 CRLF만 LF로 정규화하고 문구 전체 일치 검사를 유지한 뒤 전체 62개를 재실행하여 통과했다. lint·typecheck도 최종 수정 후 재통과했다.
- 확인하지 못한 것·남은 위험: 실제 계정의 ZIP 업로드·참고 문서 반영은 platform-facts.md 6절에서 미확인이다. 지시에 따라 실측을 기다리지 않았다. 외부 API는 모킹했고 실제 기기·Safari·Firefox는 검증하지 않았다. 미등록 가이드 경로는 HTTP 404 검증을 통과했지만 Next.js 서버에 Internal: NoFallbackError 로그가 두 프로젝트에서 각각 남았다. 원인은 이번 범위에서 규명하지 않았고 dynamicParams=false는 유지했다. 실행 환경의 NO_COLOR/FORCE_COLOR 경고도 남았다.
- 리뷰어에게 묻고 싶은 것: 실제 생성 ZIP의 업로드와 참고 파일 반영을 최종 리뷰에서 확인해 주세요. 미확인이면 platform-facts.md 5.2에 따라 skill 안내 보류와 A 기본 경로 전환을 결정해야 합니다. 미등록 경로의 404 내부 로그도 검토 대상으로 남깁니다.

## Phase 2 요약

- 완료 범위: WU-9 커밋, WU-9a 리뷰 수정, WU-10 콘텐츠, WU-10a ZIP·지침 파일, WU-11 범용 가이드, WU-12 E2E·상태 전환 검증을 완료했다. WU-10a·11의 최신 사양 보정은 사용자 승인에 따라 WU-12에 포함했다.
- 최종 관문: lint·typecheck·build 통과. 단위·컴포넌트 테스트 871개 통과, 기존 4개 건너뜀. E2E 62개 통과(Chromium 31, mobile 31; 기존 54개와 새 가이드 8개), 재시도 0.
- 브랜치·커밋: `feat/local-profiles`에서 WU별 1개 커밋을 유지한다. WU-12 커밋에 이 요약을 포함하고 최종 리뷰를 위해 멈춘다. 기존 커밋 amend/rebase, 푸시·배포는 하지 않았다.
- 보호한 계약: 서버/API, 로컬 저장 스키마·DB 이름·버전·키, JSON 백업 형식, canonical Markdown, 기존 테스트를 유지했다. 새 런타임·개발 의존성을 추가하지 않았다. 가이드는 외부 업로드를 자동 실행하지 않는다.
- 남은 위험·리뷰 요청: 실제 ZIP 업로드 및 참고 파일 반영은 미확인이다. platform-facts.md 5.2의 실측/대안 경로 결정을 최종 리뷰에서 확인해야 한다. 미등록 가이드 경로의 HTTP 404는 정상 응답하지만 NoFallbackError 서버 로그가 남는다. 실제 기기와 다른 브라우저는 별도 검증 대상이다.

## WU-12a Gemini 안내 조정(실측 반영)

- 상태: 완료. 2026-10-26 사용자의 명시적 승인에 따라 수행했으며, 지시문 2.4의 테스트 기대값 변경도 승인 범위로 적용했다. 지시문 머리의 승인 대기 문구보다 이번 사용자 승인을 우선했다.
- 변경 파일: `src/content/platform-guides/{gemini,schema.test}.ts`, `src/components/ai-guide/{platform-guide-view,transition.test}.tsx`, `src/lib/export/{skill,skill.test}.ts`, `e2e/ai-guide.spec.ts`, `docs/codex/{platform-facts,progress}.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 874, 기존 건너뜀 4) build ✓ e2e ✓(Chromium 31, mobile 31, 총 62 통과; CI=1, 재시도 0, 프로덕션 next start). 모든 관문은 corepack pnpm으로 실행했고 첫 실행에 통과했다. 아키텍처 가드와 렌더러의 플랫폼 문자열 분기 금지 검사도 통과했다.
- 설계·지시와 다르게 구현한 부분과 이유: 없음. 새 대안 안내 RTL은 기존 transition.test.tsx에 세 플랫폼별 케이스로 추가했다. 전환 시뮬레이션은 승인된 새 상태에서 출발하여 상태만 바꾸며, 종료·출시 예정 접힘 검증도 유지했다. 공식 도움말 verifiedAt은 기존 2026-10-25를 유지하고 실측 문구에 2026-10 한계를 표시했다.
- 이전 WU 수정: Gemini를 대화 첨부 recommended → skill available → Gem transitioning 순서로 바꾸고 summary·skill 한계·대응 요령을 반영했다. 대안 자체가 recommended이면 대안 안내를 숨기는 상태 조건을 범용 렌더러에 추가했다. 두 SKILL.md의 name을 따옴표 없이 출력하며, ZIP 안 지침의 첫 문단은 참고 파일 전체를 먼저 읽고 실패 시 알리도록 바꿨다. description 인용, 지침 전용 파일의 첫 문단, ZIP 구조와 참고 파일 내용은 유지했다. platform-facts.md 6.1은 적용됨(WU-12a)으로 갱신했다.
- 검증 근거: 새 RTL 3개로 Gemini의 자기 참조 대안 안내 미표시 및 ChatGPT·Claude의 기존 대안 안내를 검증했다. 머리말 두 name의 정확한 비인용 표기·안전 문자 패턴, 새 첫 문단, 기존 ZIP 참고 파일 바이트 일치·개인정보 경고 보존을 확인했다. E2E는 Gemini 첫 방법의 이름과 권장 배지, 320px 화면, 실제 파일·클립보드와 전체 기존 흐름을 검증했다. 독립 읽기 전용 리뷰에서 범위 위반이나 수정이 필요한 결함이 발견되지 않았다.
- 확인하지 못한 것·남은 위험: 지침 변경 후 실제 Gemini 계정의 재업로드·참고 파일 반영은 재실측하지 않았다. 문구 강화만으로 참고 파일을 항상 읽는다고 보장하지 않으며 대화 첨부를 기본으로 안내한다. 외부 API는 모킹했고 실제 기기·다른 브라우저는 검증하지 않았다. 기존 미등록 가이드 경로의 HTTP 404는 통과했지만 Next.js Internal: NoFallbackError 로그와 실행 환경의 NO_COLOR/FORCE_COLOR 경고는 남아 있다. 이번 범위에서 수정하지 않았다.
- 리뷰어에게 묻고 싶은 것: 없음.
- 범위 점검: ChatGPT·Claude 콘텐츠, ZIP 작성기, canonical Markdown, 저장 스키마·DB·백업 형식, 서버와 의존성, 공개 함수 시그니처는 변경하지 않았다. feat/local-profiles에서 지정된 메시지로 커밋 1개를 만든 뒤 멈춘다.
