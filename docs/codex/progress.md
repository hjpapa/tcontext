# 로컬 프로파일 구현 진행 기록

## WU-1a 직렬화·버전 판별 보강

- 상태: 완료
- 변경 파일: `src/lib/storage/profiles/{serialize,migrate}.ts`, 같은 폴더의 `{schema,serialize,migrate}.test.ts`, `src/types/profile.test.ts`(연속 빈 줄 하나 삭제), `docs/codex/progress.md`
- 관문: lint ✓ typecheck ✓ test ✓(통과 777, 건너뜀 4) build - e2e -
- 설계·지시와 다르게 구현한 부분과 이유: 상세 지시문의 "다섯 파일"은 실제 열거된 6개 파일과 불일치하여 열거된 범위를 적용했다. runbook과 사용자 요청에 따라 이 진행 기록을 추가하고 커밋 요약 뒤에 WU 번호를 붙인다. 저장 형식과 기존 결과 타입은 변경하지 않았다.
- 이전 WU 수정: 담당 교과 선택 키 생략, 확정본·초안 태그 선택지 병합, 다른 realm의 객체 지원, 미래 프로파일 스키마 사전 판별, 업그레이드 복제·예외 처리. 상세 지시문에서 승인한 범위다.
- 확인하지 못한 것·남은 위험: 외부 서비스 연동 테스트 4개는 기존 설정에 따라 건너뛰었다. 실제 IndexedDB 검증은 WU-2 및 WU-9에서 수행한다. 최초 관문의 테스트 fixture 오삽입을 1회 수정한 뒤 모든 필수 관문과 변경 코드 6개 파일의 Prettier 일치를 확인했다.
- 리뷰어에게 묻고 싶은 것: 없음
