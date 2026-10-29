# 데이터 사전

## 저장 경계

`public.teacher_context_submissions`에는 사용자가 검토하고 명시적으로 기여한 최종 프로필만 저장한다. 원본 인터뷰 질문·답변은 어떤 열에도 저장하지 않는다.

| 필드                  | 형식        | 출처와 목적                           | 보유기간       | 개인정보 가능성·주의                                            |
| --------------------- | ----------- | ------------------------------------- | -------------- | --------------------------------------------------------------- |
| `id`                  | UUID        | 서버 생성 제출 식별자                 | 행 삭제 시까지 | 직접 식별자는 아니나 외부 공유를 피한다.                        |
| `created_at`          | timestamptz | DB 생성, 운영·집계 기준               | 최대 365일     | 단독 위험은 낮지만 정밀 시각 결합에 주의한다.                   |
| `schema_version`      | text        | 서버 환경, JSON 호환성                | 최대 365일     | 없음                                                            |
| `prompt_version`      | text        | 서버 환경, 재현·평가                  | 최대 365일     | 없음                                                            |
| `app_version`         | text        | 배포 버전, 품질 추적                  | 최대 365일     | 없음                                                            |
| `school_level`        | text enum   | 사용자 선택, 학교급 집계              | 최대 365일     | 집단이 작을 때 다른 정보와 결합하지 않는다.                     |
| `teacher_role`        | text        | 사용자 선택, 역할 집계                | 최대 365일     | 자유 입력 기타 역할은 개인정보를 제거한다.                      |
| `profile_json`        | JSONB       | 교사가 최종 승인한 canonical 프로필   | 최대 365일     | 자유 서술이므로 이중 개인정보 검토가 필수다.                    |
| `profile_markdown`    | text        | 동일 JSON에서 결정적으로 생성         | 최대 365일     | JSON과 같은 주의가 필요하다.                                    |
| `confirmed_tags`      | JSONB       | 사용자가 확인한 controlled vocabulary | 최대 365일     | 평가·점수·교사 유형으로 해석하지 않는다.                        |
| `privacy_review`      | JSONB       | 최종 개인정보 검토 결과               | 최대 365일     | `clear`인 결과만 저장한다.                                      |
| `model_name`          | text        | 생성 모델 운영 추적                   | 최대 365일     | 없음                                                            |
| `consent_version`     | text        | 동의 문안 버전                        | 최대 365일     | 없음                                                            |
| `consented_at`        | timestamptz | 서버가 기록한 동의 시점               | 최대 365일     | 정밀 시각 결합에 주의한다.                                      |
| `retention_until`     | timestamptz | 일일 정리의 삭제 대상 전환 시각       | 다음 정리까지  | 최장 보유일보다 하루 일찍 설정하며 1일 정책은 동의 시각과 같다. |
| `deletion_token_hash` | 64자 hex    | 익명 삭제 코드 검증                   | 행 삭제 시까지 | 원문 코드는 저장하지 않는다.                                    |
| `source`              | text enum   | 유입 채널, 현재 `web`                 | 최대 365일     | 없음                                                            |

## 저장하지 않는 항목

- 사용자 이름, 이메일, IP 주소, 로그인 ID
- 구체적인 학교명, 반 이름, 학생 이름
- 브라우저 고유 식별자와 광고 식별자
- 원본 인터뷰 질문과 답변
- 삭제 코드 원문

## 프로필 메타데이터의 담당 교과

중학교와 고등학교 사용자가 선택한 `teachingSubject`는 통제된 열거값으로
`profile_json.metadata`에만 포함한다. 자유 입력 교과명이나 학교·학급명은 받지
않는다. 기존 프로필과의 호환을 위해 필드는 선택 사항이며, 새 문서는 담당 교과를
선택하지 않은 경우에도 명시적인 해당 없음 값을 사용할 수 있다.

## `confirmed_tags`

모든 키는 배열이며 허용 목록에 있는 값만 사용한다. AI가 제안하더라도 사용자가 확인하지 않은 태그는 제외한다.

| 키                           | 허용값                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `preferredTeachingMethods`   | `direct_instruction`, `inquiry`, `discussion`, `collaboration`, `project_based`, `making`, `experiential`, `blended`                             |
| `participationPriorities`    | `questioning`, `choice`, `judgment`, `revision`, `sharing`, `peer_feedback`, `reflection`                                                        |
| `emotionalSupportPriorities` | `psychological_safety`, `low_risk_participation`, `small_success_steps`, `growth_feedback`, `multiple_expression_modes`, `predictable_structure` |
| `assessmentPriorities`       | `final_product`, `learning_process`, `reasoning`, `revision`, `self_reflection`, `peer_feedback`, `observation`                                  |
| `environmentConstraints`     | `limited_time`, `device_gap`, `unstable_network`, `large_class`, `preparation_load`, `mixed_achievement`, `attention_transition`                 |
| `aiBoundaries`               | `no_personal_data`, `teacher_final_judgment`, `student_thinking_first`, `fact_check_required`, `copyright_review`, `disclose_ai_use`             |

## 브라우저 로컬 저장(IndexedDB)

교사가 켠 경우에만 DB `tcontext-local-profiles`(버전 1)를 만든다. 프로파일 기록 형식은 버전 2이며 설정 레코드는 버전 1을 유지한다. 최대 10개 프로파일을 보관하고 Web Storage에는 프로파일 본문을 저장하지 않는다. v1 기록은 읽을 때 `history: []`, `exports: []`를 더해 v2로 변환하며 다음 쓰기에서 저장한다. 읽기만으로 DB를 고치지 않는다.

| store      | 필드                                                                         | 목적                                                       |
| ---------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `meta`     | `key: "settings"`, `enabledAt`, `storageSchemaVersion: 1`                    | 명시적 활성화 시각과 설정 형식 버전                        |
| `profiles` | `id`, `storageSchemaVersion`, `createdAt`, `updatedAt`, `revision`, `origin` | 무작위 문서 ID, 버전·시각, 충돌 검출, 인터뷰·가져오기 구분 |
| `profiles` | `suggestedTags`                                                              | 검토 때 다시 선택할 수 있는 통제된 제안 태그               |
| `profiles` | `confirmed: { profile, confirmedAt } \| null`                                | 검토 완료된 구조화 프로필과 확정 시각                      |
| `profiles` | `draft: { profile, baseConfirmedAt, updatedAt } \| null`                     | 미완성 문장을 허용하는 편집 초안과 기준 확정 시각          |
| `profiles` | `history: { profile, confirmedAt, replacedAt }[]`                           | 이전 확정본 최대 5개, 원래 확정 시각과 교체 시각           |
| `profiles` | `exports: { target, format, confirmedAt, exportedAt }[]`                    | 대상별 최근 내보내기 1건, 전체 최대 10건                   |

프로필에는 7개 모듈, 종합 목록 4종, 확인 태그와 생성 메타데이터가 포함된다. 초안의 개인정보 검사 결과는 검사 대기 값으로만 보관하며 확정본은 실제 검사 상태를 보존한다. `profiles`의 keyPath는 `id`, `updatedAt` 인덱스는 수정 순서 조회용이다.

`history`는 `replacedAt` 내림차순이며 이력이 있으면 현재 확정본도 있어야 한다. 각 프로필은 지원하는 버전과 확정본 검사 규칙을 따르고, `confirmedAt`은 현재 확정본과 이력 전체에서 고유하다. 전체본 Markdown 내용이 같으면 이력을 만들지 않고 확정 시각을 유지한다. 복원은 선택한 버전의 원래 `confirmedAt`을 유지하며 초안이 있으면 거절한다.

`exports.target`은 소문자·숫자·하이픈으로 된 최대 64자의 불투명한 대상 id이며 중복되지 않는다. `format`은 `full`, `core`, `modules`, `skill-package` 중 하나다. `confirmedAt`은 내보낸 확정본의 식별 시각이고 `exportedAt`은 내보내기 기록 시각이다. 10건을 넘으면 가장 오래전에 내보낸 기록부터 지운다. 해당 확정본이 이력 보관 범위를 벗어나도 내보내기 기록은 남을 수 있다. 내보내기 기록과 이력 하나 삭제는 본문 수정이 아니므로 `revision`·`updatedAt`을 바꾸지 않는다.

원문 인터뷰 답변, 서명된 검사 토큰, 기여 영수증, 경고 확인 체크 상태, 별도 Markdown 사본, 내보낸 내용·모듈 선택·외부 계정 정보, IP 주소·사용자 에이전트·이름·이메일·쿠키는 저장하지 않는다. 내보내기 기록은 외부 서비스에 실제 등록했다는 뜻이 아니다. 교사가 내용을 검토하며 개인정보를 제거해야 한다.

프로파일 삭제 시 `history`와 `exports`도 함께 삭제한다. JSON 백업은 기존 형식을 유지하고 선택한 현재 확정본 또는 초안 하나만 담으며, 이력과 내보내기 기록은 포함하지 않는다.

보존 기간은 교사가 지우거나 브라우저가 지울 때까지이며 자동 만료는 없다. `/profiles`에서 개별 문서 삭제·초안 버리기, `/profiles` 또는 `/privacy`에서 “로컬 저장 끄고 모두 삭제”를 제공한다. “이 탭의 모든 기록 삭제”는 저장된 프로파일을 지우지 않는다. 공용 기기에 주의하고 소실에 대비해 JSON 백업을 보관한다. 서버 기여와 내려받은 파일은 각각 별도로 삭제해야 한다.

## 분석 제한

- 태그를 교사의 전문성, 성과, 인성 점수로 사용하지 않는다.
- 교사 개인이나 소규모 집단을 비교·순위화하지 않는다.
- 비공개 집계 뷰는 학교급·역할 조합이 5건 이상인 경우만 반환한다.
- 자유 서술을 분석 시스템에 추가로 제공하려면 별도 목적·법적 근거·위험 검토가 필요하다.
