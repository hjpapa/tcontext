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

## 분석 제한

- 태그를 교사의 전문성, 성과, 인성 점수로 사용하지 않는다.
- 교사 개인이나 소규모 집단을 비교·순위화하지 않는다.
- 비공개 집계 뷰는 학교급·역할 조합이 5건 이상인 경우만 반환한다.
- 자유 서술을 분석 시스템에 추가로 제공하려면 별도 목적·법적 근거·위험 검토가 필요하다.
