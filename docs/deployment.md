# 배포와 운영

## 연결 대상

- GitHub: `hjpapa/tcontext`, 기본 브랜치 `main`
- Vercel 프로젝트: `tcontext`
- Supabase 조직: `tcontext`
- Supabase 프로젝트 ref: `fqbcyornlnxqmchyhlhs`
- Supabase 리전: Seoul (`ap-northeast-2`)

비밀값은 문서, 커밋, 빌드 로그에 넣지 않는다.

## 로컬 준비

Node.js 22 이상과 pnpm 11을 사용한다.

```bash
pnpm install
Copy-Item .env.example .env.local
```

`.env.local`에 필요한 값을 채운 후 다음을 실행한다.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

## Supabase 마이그레이션

프로젝트를 연결한 뒤 순서대로 적용한다.

```bash
supabase link --project-ref fqbcyornlnxqmchyhlhs
supabase db push
```

적용 파일:

1. `202607300001_create_teacher_context_submissions.sql`
2. `202607300002_create_analytics_views.sql`
3. `202607310001_allow_immediate_retention_eligibility.sql`

적용 후 확인:

- `teacher_context_submissions`에 RLS와 FORCE RLS가 켜져 있다.
- `anon`, `authenticated`에 SELECT/INSERT/UPDATE/DELETE 권한과 정책이 없다.
- 서버 Secret Key로만 삽입·삭제할 수 있다.
- `tcontext_private.teacher_context_summary`는 5건 미만 조합을 숨긴다.

## 환경 변수

| 이름                      | Preview         | Production      | 비고                             |
| ------------------------- | --------------- | --------------- | -------------------------------- |
| `OPENAI_API_KEY`          | 필수            | 필수            | 서버 전용                        |
| `OPENAI_INTERVIEW_MODEL`  | `gpt-5.6-luna`  | `gpt-5.6-luna`  | 환경별 교체 가능                 |
| `OPENAI_PROFILE_MODEL`    | `gpt-5.6-terra` | `gpt-5.6-terra` | 환경별 교체 가능                 |
| `OPENAI_PRIVACY_MODEL`    | `gpt-5.6-terra` | `gpt-5.6-terra` | 환경별 교체 가능                 |
| `SUPABASE_URL`            | 필수            | 필수            | 프로젝트 URL                     |
| `SUPABASE_SECRET_KEY`     | 필수            | 필수            | 서버 전용, `NEXT_PUBLIC_` 금지   |
| `DATA_RETENTION_DAYS`     | `365`           | `365`           | 정리 간격 포함 실제 최장 일수    |
| `CONSENT_VERSION`         | `1.0`           | `1.0`           | 동의 문안 버전                   |
| `PROFILE_SCHEMA_VERSION`  | `1.0`           | `1.0`           | canonical schema                 |
| `PROMPT_VERSION`          | `1.3`           | `1.3`           | 프롬프트 버전                    |
| `DELETE_TOKEN_PEPPER`     | 필수            | 필수            | 환경별 다른 긴 무작위 값         |
| `CRON_SECRET`             | 필수            | 필수            | Vercel Cron 보호                 |
| `ADMIN_PASSWORD_HASH`     | 필수            | 필수            | scrypt 해시, 서버 전용           |
| `ADMIN_SESSION_SECRET`    | 필수            | 필수            | 환경별 다른 32바이트 이상 비밀값 |
| `ADMIN_SESSION_TTL_HOURS` | `8`             | `8`             | 1~24시간                         |
| `NEXT_PUBLIC_APP_NAME`    | `TContext`      | `TContext`      | 공개 값                          |
| `NEXT_PUBLIC_APP_URL`     | Preview URL     | Production URL  | 영수증·절대 URL 기준 공개 값     |

Preview와 Production에는 서로 독립된 비밀값을 설정한다. 운영 Secret Key를 로컬이나 Preview에 복사하지 않는 구성이 권장된다.

로컬에서는 저장소 루트에서 `pnpm admin:setup`을 실행해 관리자 비밀번호 해시와 세션 비밀값을 `.env.local`에 생성한다. 명령이 한 번만 보여 주는 비밀번호를 안전하게 보관한다. Vercel에는 평문 비밀번호가 아니라 생성된 세 환경 변수만 등록하며, 환경 변수를 바꾼 뒤에는 재배포한다. `/admin/login`에서 로그인하면 명시적 동의를 받아 저장된 문서만 읽기 전용으로 열람할 수 있다.

`DATA_RETENTION_DAYS`는 일일 Cron 지연까지 포함한 실제 최장 보유 일수다. 서버는 `retention_until = consented_at + max(DATA_RETENTION_DAYS - 1, 0)일`로 삭제 대상 전환 시각을 계산한다. 기본값 365에서는 364일째 대상이 되어 다음 일일 정리까지 포함해 365일을 넘지 않는다. 값이 1이면 즉시 대상이 되어 다음 정리 주기 안에 삭제된다. 데이터베이스 제약은 어떤 경로로 삽입하더라도 동의 시점부터 365일을 넘는 `retention_until`을 거부한다.

## Vercel

1. GitHub 저장소를 `tcontext` 프로젝트에 연결한다.
2. Framework Preset을 Next.js, Install Command를 `pnpm install`로 둔다.
3. Preview와 Production 환경 변수를 각각 설정한다.
4. Preview를 배포해 랜딩, 개인정보 안내, 학교급·역할 선택, 인터뷰, 생성·검토, 다운로드, 저장 거부, 선택 저장·삭제, `/admin/login` 인증과 관리자 열람을 스모크 테스트한다.
5. 통과한 커밋을 Production에 배포한다.

`vercel.json`은 매일 한국 시간 오전 3시 17분에 삭제 대상 정리 API를 호출한다. API는 `CRON_SECRET` 또는 Vercel Cron 인증을 검증해야 한다. 일일 실행 실패가 발생하면 최대 보유기간을 넘길 수 있으므로 즉시 수동 정리를 수행하고 스케줄을 복구한다.

## 운영 확인

- `/api/health`는 비밀값 없이 연결 준비 상태만 반환한다.
- `/admin` 응답은 `no-store`, `noindex`이며 로그인 없이는 문서 쿼리를 실행하지 않는지 확인한다.
- 오류 응답과 로그에 사용자 본문이나 키가 없는지 확인한다.
- 월 1회 만료 삭제 성공 건수와 실패 알림을 확인한다.
- 스키마·프롬프트·동의 문안 변경 시 각 버전을 올린다.
- 모델 교체 전 구조 검증, 개인정보, 충실성 평가 세트를 다시 실행한다.

## 수동 만료 삭제

Cron 장애 시 Supabase SQL Editor에서 권한 있는 운영자만 다음 기준으로 삭제한다.

```sql
delete from public.teacher_context_submissions
where retention_until < now();
```

삭제 전에 대상 행 본문을 조회하거나 내보내지 않는다. 실행 기록에는 시각과 삭제 건수만 남긴다.
