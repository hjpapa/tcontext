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
