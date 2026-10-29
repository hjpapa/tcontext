# Phase 4 진행 기록

- 기준: `docs/codex/runbook-phase4.md`, `docs/version-and-skill-design.md`, `docs/codex/platform-facts.md` 7절.
- 시작: 2026-10-30, `feat/version-history`의 `6cb2246`, 변경 없는 작업 트리.

## WU-19 저장 형식 v2와 저장소 API

- 상태: 완료.
- 변경 파일: `src/lib/storage/profiles/{schema,migrate,repository}.ts`, 신규 `src/lib/profile/versions.ts`와 단위 테스트, 신규 `schema-v2.test.ts`, `migrate-v2.test.ts`, `repository-versions.test.ts`, E1~E4의 승인된 기존 테스트, `local-save-panel.tsx`의 오류 문구 1줄, 이 진행 기록.
- 관문: lint ✓ typecheck ✓ test ✓(1,028개 통과, 기존 건너뜀 4) build ✓ e2e -(WU-23 대상). 가짜 외부 키를 설정한 corepack pnpm으로 실행했다. 기존 저장소 22/22, 스키마·마이그레이션 관련 81/81, 새 버전·저장소 기능 22/22 집중 검사도 통과했다.
- 설계·지시와 다르게 구현한 부분과 이유: 명세 변경 없음. 설정 버전은 1로 분리하고 DB 버전과 백업 형식을 유지한다. 새 저장소 입력은 Zod로 검사하고, 같은 내용 판정 전에 확정본 입력의 추가 비밀 필드도 엄격히 거절한다. 이력 순서와 내보낸 시각 정렬은 ISO 문자열의 소수 초 정밀도가 달라도 시간순이 되도록 실제 시각으로 비교한다.
- 이전 WU 수정: 없음.
- 승인된 기존 테스트 예외(변경 후 줄): E1 `src/lib/storage/profiles/schema.test.ts:20,28-29`; `serialize.test.ts:133,141-142,189,197-198,233,241-242`; `src/components/local-profiles/use-local-draft-autosave.test.tsx:19,26-27`. E2 `src/lib/storage/profiles/migrate.test.ts:25,33-34,45,104,112-113,180,186,196`. E3 `src/lib/storage/profiles/repository.test.ts:307`. E4 `e2e/context-export.spec.ts:303,311-312`. 현재 형식의 버전과 빈 배열, 미래 버전 3, 사용자 업그레이드 연쇄와 기대 버전만 바꿨다. 잘못된 업그레이드 5종과 그 밖의 기대값은 유지한다. IndexedDB 자체의 미래 버전 2와 백업 미래 형식 2는 그대로다.
- 검증 근거: 기존 손상·미래 버전 처리, 비밀 필드 거절, v1 읽기 후 다음 쓰기에서만 v2 저장, 같은 내용 확정 시 원래 시각·분석 태그 보존, 이력 상한·복원·삭제, 부가 정보 쓰기의 수정 번호 보존을 검사한다.
- 관문 보정 이력: 없음.
- 확인하지 못한 것·남은 위험: 화면·실제 브라우저 전체 검증은 후속 WU 대상이다.
- 리뷰어에게 묻고 싶은 것: 없음.
