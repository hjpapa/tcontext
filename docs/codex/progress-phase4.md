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

## WU-22 skill 패키지 2.0과 호환성 검사

- 상태: 완료. WU-21 `7fd1b66` 뒤에 착수했다. 기존 E2E 기대값 충돌로 한 차례 중단했으며, 사용자가 해당 한 줄의 추가 예외를 승인한 뒤 재개했다.
- 변경 파일: `src/lib/export/skill.ts`, 신규 `skill-package-v2.test.ts`·`skill-check.ts`·`skill-check.test.ts`, 신규 `src/content/skill-format.ts`, `src/components/ai-guide/guide-artifacts.tsx`와 신규 `guide-skill-check.test.tsx`, `src/content/platform-guides/{chatgpt,claude}.ts`와 신규 `skill-methods.test.ts`, E5 `skill.test.ts`, E6 `schema.test.ts`, 추가 승인된 `e2e/ai-guide.spec.ts` 한 줄, 이 진행 기록.
- 관문: lint ✓ typecheck ✓ test ✓(1,179개 통과, 기존 건너뜀 4) build ✓ e2e -(WU-23 대상). 가짜 외부 키를 설정한 corepack pnpm으로 실행했다. 검사기 50/50, 생성기·기존 출력 15/15, 가이드·콘텐츠 57/57 집중 검사도 통과했다.
- 중단·재개 근거: `e2e/ai-guide.spec.ts:194`의 `expect(instructions).not.toContain(generatedProfile.profileTitle)`는 기준 커밋 `07bd62c`에도 있는 기대값이며 핵심본 포함 사양과 충돌한다. E1~E6 밖이므로 runbook 4절 2번에 따라 멈춘 뒤, 사용자가 2026-10-30 대화에서 그 한 줄을 `expect(instructions).toContain(generatedProfile.profileTitle)`로 바꾸는 추가 예외와 WU-22~23 재개를 승인했다. 승인 범위를 다른 기존 E2E 기대값으로 확대하지 않았다.
- 설계·지시와 다르게 구현한 부분과 이유: 명세 변경 없음. 핵심본 본문은 앞 빈 줄부터 그대로 붙이고, 전체본 참고 파일과 지침 전용 파일은 유지한다. 형식 결과는 ZIP 버튼 가까이 표시하며 현재 문서·기준 시점이 바뀌면 이전 검사 결과를 숨긴다.
- 이전 WU 수정: 없음.
- 승인된 기존 테스트 예외(변경 후 줄): E5 `src/lib/export/skill.test.ts:55,58`; 기존 도입 문단 기대값은 신규 `skill-package-v2.test.ts:67-69`의 글자·줄 초과 대체 테스트로 옮겼다. E6 `src/content/platform-guides/schema.test.ts:43,49`. 대화 추가 승인 `e2e/ai-guide.spec.ts:194`.
- 검증 근거: 정상 예제 4건·최대 크기·개인정보 경고·미완료 확인·legacy 패키지 통과, 핵심본 접미부 일치, 전체본 바이트 보존, 기준일 전달·기본값, 결정적 출력·입력 보존을 검사했다. 한도 초과 두 사례는 수정 전 SKILL.md의 SHA-256 `822177ebe65aa2becfa9ea951629964fbe8232dfd332f5b858e46d1f417161ec`와 일치한다. 규칙별 잘못된 패키지와 가이드 실패 시 다운로드·기록 차단도 검사했다.
- 관문 보정 이력: 신규 가이드 테스트의 ZIP `mediaType`이 일반 문자열로 추론되는 타입 오류를 리터럴로 고쳤다(보정 1회). 타입 검사와 해당 테스트 10/10을 다시 통과했으며 제품 코드 변경은 없다.
- 확인하지 못한 것·남은 위험: 실제 외부 서비스 업로드와 반영은 병합 뒤 사용자 확인 대상이다. 프로덕션 E2E는 WU-23에서 실행한다.
- 리뷰어에게 묻고 싶은 것: 없음.

## 현재 커밋과 남은 범위

- WU-19: `a5ccc2d` 완료.
- WU-20: `be28119` 완료.
- WU-21: `7fd1b66` 완료.
- WU-22: 완료.
- WU-23: 미착수. Phase 4 완료 요약은 WU-23 완료 후 작성한다.
