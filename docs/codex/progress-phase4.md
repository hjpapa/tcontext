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

## WU-20 버전 기록 화면

- 상태: 완료. WU-19 `a5ccc2d` 뒤에 착수했다.
- 변경 파일: `src/components/local-profiles/profile-library.tsx`, 신규 `profile-versions.tsx`, `version-compare.tsx`, `src/app/profiles/versions/page.tsx`, 각 신규 RTL 테스트 3개, 이 진행 기록.
- 관문: lint ✓ typecheck ✓ test ✓(1,058개 통과, 기존 건너뜀 4) build ✓ e2e -(WU-23 대상). 가짜 외부 키를 설정한 corepack pnpm으로 실행했다. 목록 회귀·신규 5/5, 비교 8/8, 버전 화면 19/19 집중 검사도 통과했다.
- 설계·지시와 다르게 구현한 부분과 이유: 명세 변경 없음. `toViewSession`과 표시 이름 함수는 허용된 목록 파일에서 공유한다. 기존 확인 대화상자에 비활성 prop이 없으므로 초안이 있을 때 일반 비활성 버튼과 사유를 표시하며 공통 대화상자 파일은 수정하지 않는다. 비교에는 기존 근거 배지를 재사용하고 개인정보 상태 차이는 변경 영역 계산과 별도로 표시한다.
- 이전 WU 수정: 없음. 기존 테스트 변경과 E1~E6 예외 사용 없음.
- 검증 근거: 실제 저장소와 provider로 목록 표시·보기 동작을 검사한다. 비교는 바뀐 영역, 추가·수정·삭제, 근거·검토 전 표시, 여러 줄·중복, 개인정보 상태만 다른 경우와 같은 내용 안내를 검사한다. 버전 화면은 미동의·잘못된 id·없는 기록의 DB 미생성, 순서·날짜, 복원·초안 차단·삭제·오류, 연결된 세션 갱신, 갱신 알림과 복원 조회의 경합, 오래된 id·저장소 응답 배제, 미저장 문서 보호 확인창을 검사한다.
- 관문 보정 이력: 신규 버전 화면의 정리 함수가 ref를 직접 참조하는 ESLint 경고 2개를 안정된 콜백으로 고쳤다(보정 1회). 기존 기대값 변경이나 규칙 비활성화는 없다. 코드 검토 중 확인한 복원 조회 경합과 미저장 문서 보호도 신규 코드·테스트 안에서 반영했다.
- 확인하지 못한 것·남은 위험: 프로덕션 브라우저의 320px·키보드 검증은 WU-23 대상이다.
- 리뷰어에게 묻고 싶은 것: 없음.

## WU-21 내보내기 기록과 교체 안내

- 상태: 완료. WU-20 `be28119` 뒤에 착수했다.
- 변경 파일: 신규 `src/components/export/use-record-export.ts`, `export-refresh-notice.tsx`와 신규 테스트, `use-context-as-of.ts`, `result-actions.tsx`, `export-variant-panel.tsx`, `result-view.tsx`, 신규 결과 화면 기록 테스트, `src/components/ai-guide/{guide-artifacts,platform-guide-view}.tsx`와 신규 테스트, `src/content/platform-guides/{schema,chatgpt,gemini,claude}.ts`와 신규 테스트, `profile-versions.tsx`의 내보내기 기록 칸, 이 진행 기록.
- 관문: lint ✓ typecheck ✓ test ✓(1,106개 통과, 기존 건너뜀 4) build ✓ e2e -(WU-23 대상). 가짜 외부 키를 설정한 corepack pnpm으로 실행했다. 결과 화면 21/21, 가이드·콘텐츠 45/45, 기록 훅·안내와 기존 기준 시점·버전 화면 44/44 집중 검사도 통과했다.
- 설계·지시와 다르게 구현한 부분과 이유: 명세 변경 없음. provider 없이 쓰이는 두 내보내기 컴포넌트는 선택 콜백만 받으며, 기록 콜백의 예외도 내보내기 성공 안내를 바꾸지 않게 분리한다. 저장 기록에 성공하면 기존 provider의 refresh로 같은 탭 표시도 갱신한다. 안내는 기록 id·저장소·갱신 신호와 다른 이전 조회를 표시하지 않는다.
- 이전 WU 수정: WU-20 버전 화면에 이 WU에서 지정한 내보내기 기록 칸을 추가했다. 이번 Phase 4에서 새로 만든 `profile-versions.test.tsx:205-208`의 임시 칸 없음 검사를, 조회 완료 후 칸·빈 기록 안내가 보이는 검사로 바꿨다. 해당 파일은 runbook 3.3의 기존 테스트 기준인 `07bd62c`에 없음을 확인했다. 기준 시점 훅의 같은 내용 판정만 WU-19 공통 함수로 바꿨다. 기준 커밋의 기존 테스트 기대값 변경과 E1~E6 예외 사용은 없다.
- 검증 근거: 결과 화면의 성공 후 콜백, 전체·핵심·모듈 형식, 실패 시 기록 없음, 지연 복사 중 선택 변경, 기록 실패 시 성공 문구 보존, 일반 텍스트·백업·인쇄 제외, 결과 화면의 대상·기록 id 전달을 검사한다. 실제 저장소·provider에서 연결과 동일 내용 조건, 미동의·미연결·다른 내용·읽기/쓰기 오류, 지연 쓰기의 버전 충돌, 다른 탭 갱신, 안내의 대상·형식·날짜·링크·최신 표시, 가이드 Markdown·ZIP 기록과 지침 제외를 확인했다. 일곱 updateNote는 승인된 문자열과 일치하고 다른 콘텐츠 값과 verifiedAt은 유지된다.
- 관문 보정 이력: 없음.
- 확인하지 못한 것·남은 위험: 실제 외부 서비스 등록 여부는 알 수 없으며 내보낸 기록만 표시한다. 브라우저 전체 검증은 WU-23 대상이다.
- 리뷰어에게 묻고 싶은 것: 없음.
