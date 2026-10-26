# Phase 3 진행 기록

## WU-13 변형 생성기와 충실성 검사기

- 상태: 완료. 사용자가 지정한 `feat/context-export`의 `4fdedec`에서 시작했다.
- 변경 파일: `src/content/export-variants.ts`, `src/lib/export/{profile-variants,profile-variants-fidelity,profile-variants.test,profile-variants-fidelity.test,profile-variants.test-fixtures}.ts`, `docs/codex/progress-phase3.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 921, 기존 건너뜀 4) build ✓ e2e -(WU-16 대상). 모두 corepack pnpm으로 실행했다.
- 설계·지시와 다르게 구현한 부분과 이유: 없음. 전체본 생성기는 수정하지 않았고 새 생성기·검사기는 이를 import하지 않는다. 글자 단위 일관성을 확인하는 테스트에서만 기존 전체본 출력을 호출한다. 옵션과 기준 날짜도 Zod로 검증하며, 한국 시간 날짜는 명시적으로 Asia/Seoul을 쓴다. 충실성 검사기는 생성기를 호출하지 않고 원본에서 독립적으로 기대 문장·중복 제거·위치를 계산한다.
- 이전 WU 수정: 없음. 기존 코드와 테스트를 수정하지 않고 신규 파일만 추가했다.
- 검증 근거: 가상 프로필 4건과 최대 크기(문장 28개·종합 23개), 경고, 검사 미완료, 구형 프로필 총 8종을 사용했다. 핵심본과 모듈 1·3·7개 × 선택 섹션 전체 켬·끔 조합을 검사했다. 머리말·경고·원문 보존·중복 제거·제약과 AI 지침 보존·전체본 모듈 블록 일치·한국 시간 날짜 변환을 고정했다. 문장 잘림, AI 표시 제거, 제약 누락, 기준 시점 누락, 임의 내용 삽입, 미선택 문장 유입과 여러 줄 제목·요약 경계 사례를 검사했다. 생성기·검사기의 독립 읽기 전용 검토에서 수정이 필요한 결함은 남지 않았다.
- 관문 보정 이력: 첫 실행에서 타입 검사와 테스트는 통과했고, lint가 신규 코드의 지역 변수 이름 module 7곳을 지적했다. 변수명을 profileModule로 바꾼 뒤 lint·typecheck·전체 test를 다시 통과했고 build도 통과했다. 규칙 비활성화나 테스트 기대값 완화는 하지 않았다.
- 확인하지 못한 것·남은 위험: 아직 결과 화면과 AI 활용 가이드에 연결하지 않았으며 실제 브라우저 검증은 WU-16 범위다. 충실성 검사는 명세의 다섯 규칙에 한정하며 범용 Markdown 파서나 교육적 내용 판단을 대신하지 않는다.
- 리뷰어에게 묻고 싶은 것: 없음.

## WU-14 결과 화면 내보내기 패널

- 상태: 완료. 착수 전 runbook 4.1에 따라 중단한 뒤, 2026-10-26 사용자가 기존 테스트 두 곳의 필수 prop과 import 추가를 승인하여 재개했다.
- 변경 파일: `src/components/export/{export-variant-picker,export-variant-panel,result-actions,result-view}.tsx`, `src/components/export/use-context-as-of.ts`, 신규 테스트 `export-variant-panel.test.tsx`, `use-context-as-of.test.tsx`, `result-actions-core.test.tsx`, 기존 테스트 `result-actions.test.tsx`, `result-backup.test.tsx`, `src/components/local-profiles/local-save-panel.test.tsx`, 이 진행 기록.
- 관문: lint ✓ typecheck ✓ test ✓(통과 934, 기존 건너뜀 4) build ✓ e2e -(WU-16 대상). 모두 corepack pnpm으로 실행했다.
- 설계·지시와 다르게 구현한 부분과 이유: 사용자 추가 승인에 따라 result-backup.test.tsx와 local-save-panel.test.tsx에는 contextAsOf 렌더 입력과 import만 추가했다. 두 파일의 기존 기대값은 유지했다. 그 외 명세 변경 없음. 훅은 프로필 없는 화면에서도 호출 순서를 유지하도록 null을 허용하며, 현재 프로필·연결·저장소 옵션과 다른 조회 결과는 사용하지 않는다.
- 이전 WU 수정: 없음.
- 검증 근거: 신규 RTL 13건으로 세 형식의 미리보기·복사·BOM 포함 Blob 일치, 원본 전체본 보존, 모듈 0개 차단·전체 선택/해제·섹션 선택, 생성 오류, 기존 핵심본 버튼의 오류 안내, 확정일/생성일 한국 시간 변환, DB 미생성, 조회 실패·역순 응답·연결 해제를 확인했다. 읽기 전용 코드 검토에서 추가 결함은 발견하지 못했다.
- 관문 보정 이력: 첫 전체 타입 검사에서 신규 RTL 테스트의 지원하지 않는 조회 옵션 exact를 발견했다. 문자열 이름의 기본 정확 일치를 사용하도록 해당 옵션만 제거했다. 기대값 완화는 없으며 보정 횟수는 1회다.
- 확인하지 못한 것·남은 위험: 320px·키보드·실제 다운로드 브라우저 검증은 WU-16에서 수행한다.
- 리뷰어에게 묻고 싶은 것: 없음. 기존 중단 사유인 두 테스트 렌더 입력 변경은 사용자의 명시적 승인으로 해소됐다.
