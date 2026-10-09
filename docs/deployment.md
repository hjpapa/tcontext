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

| 이름                              | Preview         | Production      | 비고                                      |
| --------------------------------- | --------------- | --------------- | ----------------------------------------- |
| `OPENAI_API_KEY`                  | 필수            | 필수            | 서버 전용                                 |
| `OPENAI_INTERVIEW_MODEL`          | `gpt-5.6-luna`  | `gpt-5.6-luna`  | 환경별 교체 가능                          |
| `OPENAI_PROFILE_MODEL`            | `gpt-5.6-terra` | `gpt-5.6-terra` | 환경별 교체 가능                          |
| `OPENAI_PRIVACY_MODEL`            | `gpt-5.6-terra` | `gpt-5.6-terra` | 환경별 교체 가능                          |
| `SUPABASE_URL`                    | 필수            | 필수            | 프로젝트 URL                              |
| `SUPABASE_SECRET_KEY`             | 필수            | 필수            | 서버 전용, `NEXT_PUBLIC_` 금지            |
| `DATA_RETENTION_DAYS`             | `365`           | `365`           | 정리 간격 포함 실제 최장 일수             |
| `CONSENT_VERSION`                 | `1.0`           | `1.0`           | 동의 문안 버전                            |
| `PROFILE_SCHEMA_VERSION`          | `1.0`           | `1.0`           | canonical schema                          |
| `DELETE_TOKEN_PEPPER`             | 필수            | 필수            | 환경별 다른 긴 무작위 값                  |
| `PRIVACY_REVIEW_SIGNING_SECRET`   | 필수            | 필수            | 32자 이상, 서버 전용, `NEXT_PUBLIC_` 금지 |
| `CRON_SECRET`                     | 필수            | 필수            | Vercel Cron 보호                          |
| `UPSTASH_REDIS_REST_URL`          | 권장            | 필수            | Upstash 연결 시 자동 주입                 |
| `UPSTASH_REDIS_REST_TOKEN`        | 권장            | 필수            | 서버 전용, `NEXT_PUBLIC_` 금지            |
| `RATE_LIMIT_SECRET`               | 권장            | 필수            | 32자 이상, 환경별 다른 값, 서버 전용      |
| `RATE_LIMIT_TEACHERS_PER_NETWORK` | `100`           | `100`           | 한 네트워크 동시 사용 교사 수 기준        |
| `RATE_LIMIT_AI_PER_MINUTE`        | `300`           | `300`           | 서비스 전체 분당 OpenAI 요청 상한         |
| `RATE_LIMIT_AI_PER_DAY`           | `7500`          | `7500`          | 서비스 전체 24시간 OpenAI 요청 상한       |
| `ADMIN_PASSWORD_HASH`             | 필수            | 필수            | scrypt 해시, 서버 전용                    |
| `ADMIN_SESSION_SECRET`            | 필수            | 필수            | 환경별 다른 32바이트 이상 비밀값          |
| `ADMIN_SESSION_TTL_HOURS`         | `8`             | `8`             | 1~24시간                                  |
| `NEXT_PUBLIC_APP_NAME`            | `TContext`      | `TContext`      | 공개 값                                   |
| `NEXT_PUBLIC_APP_URL`             | Preview URL     | Production URL  | 영수증·절대 URL 기준 공개 값              |

`PRIVACY_REVIEW_SIGNING_SECRET`은 최종 OpenAI 개인정보 검사가 `clear`일 때 서버가 정규화한 프로필 JSON의 SHA-256, 검사 결과, 발급 시각에 HMAC-SHA256으로 서명하는 데 쓴다. 기여 API는 OpenAI를 다시 호출하지 않고 서명, 프로필 해시, 1시간 만료만 확인한다. 토큰은 서버나 데이터베이스에 저장하지 않으며 브라우저 탭 메모리에만 있다. 값이 없거나 32자보다 짧으면 Markdown 생성·다운로드는 그대로 동작하고 선택적 기여만 503으로 거부된다. 값을 교체하면 발급된 토큰이 모두 무효가 되므로 사용자는 개인정보 검사를 다시 받아야 한다. `openssl rand -base64 48` 등으로 환경마다 따로 생성한다.

Preview와 Production에는 서로 독립된 비밀값을 설정한다. 운영 Secret Key를 로컬이나 Preview에 복사하지 않는 구성이 권장된다.

로컬에서는 저장소 루트에서 `pnpm admin:setup`을 실행해 관리자 비밀번호 해시와 세션 비밀값을 `.env.local`에 생성한다. 명령이 한 번만 보여 주는 비밀번호를 안전하게 보관한다. Vercel에는 평문 비밀번호가 아니라 생성된 세 환경 변수만 등록하며, 환경 변수를 바꾼 뒤에는 재배포한다. `/admin/login`에서 로그인하면 명시적 동의를 받아 저장된 문서만 읽기 전용으로 열람할 수 있다.

`DATA_RETENTION_DAYS`는 일일 Cron 지연까지 포함한 실제 최장 보유 일수다. 서버는 `retention_until = consented_at + max(DATA_RETENTION_DAYS - 1, 0)일`로 삭제 대상 전환 시각을 계산한다. 기본값 365에서는 364일째 대상이 되어 다음 일일 정리까지 포함해 365일을 넘지 않는다. 값이 1이면 즉시 대상이 되어 다음 정리 주기 안에 삭제된다. 데이터베이스 제약은 어떤 경로로 삽입하더라도 동의 시점부터 365일을 넘는 `retention_until`을 거부한다.

## Vercel

1. GitHub 저장소를 `tcontext` 프로젝트에 연결한다.
2. Framework Preset을 Next.js, Install Command를 `pnpm install`로 둔다.
3. Preview와 Production 환경 변수를 각각 설정한다.
4. Preview를 배포해 랜딩, 개인정보 안내, 학교급·역할·중고등학교 담당 교과 선택, 인터뷰, 생성·검토, 다운로드, 저장 거부, 선택 저장·삭제, `/admin/login` 인증과 관리자 열람을 스모크 테스트한다.
5. 통과한 커밋을 Production에 배포한다.

AI Route Handler는 `export const maxDuration`으로 함수 실행 한도를 명시한다. 초안 생성 120초(429/5xx 지터 재시도 1회 + 45초 시도 최대 2회), 모듈 재작성 120초(45초 시도 최대 2회), 최종 개인정보 검사 60초(25초 시도 최대 2회)다. 이 값은 Fluid compute가 켜진 Vercel 프로젝트(Hobby 최대 300초)를 전제로 한다. Fluid compute를 끈 Hobby 프로젝트는 최대 60초라 배포가 거부되므로 켜 두거나 값을 낮춘다. 운영 중에는 `openai_request` 로그의 operation별 `durationMs` p95를 보고 조정한다.

최종 개인정보 검사가 OpenAI 지연·한도 초과·응답 잘림으로 끝나지 않으면 화면은 오류에서 멈추지 않고 '확인 안 됨' 상태로 결과 화면에 갈 수 있는 경로를 연다. 이 상태는 `clear`가 아니므로 Markdown에 경고가 남고 선택적 기여는 계속 차단된다.

`vercel.json`은 매일 한국 시간 오전 3시 17분에 삭제 대상 정리 API를 호출한다. API는 `CRON_SECRET` 또는 Vercel Cron 인증을 검증해야 한다. 일일 실행 실패가 발생하면 최대 보유기간을 넘길 수 있으므로 즉시 수동 정리를 수행하고 스케줄을 복구한다.

## 요청 제한과 동시 접속

연수에서는 한 학교의 수십 명이 같은 공인 IP로 동시에 접속한다. 요청 제한은 이 상황에서 정상 사용자를 막지 않으면서, 서버 인스턴스가 늘어나도 OpenAI 비용이 정해진 상한을 넘지 않도록 Upstash Redis에서 인스턴스끼리 횟수를 공유한다.

### 설정

1. Vercel 프로젝트의 Storage(Marketplace)에서 Upstash Redis를 만들고 무료 플랜을 고른다. 리전은 Vercel 함수 리전과 같게 둔다. `vercel.json`에 리전 지정이 없으면 함수는 기본 `iad1`에서 실행되므로 Upstash는 `us-east-1`이 가깝다.
2. 데이터베이스를 `tcontext` 프로젝트의 Preview와 Production에 연결한다. 연결하면 REST URL과 토큰이 환경 변수로 들어온다. 서버는 `UPSTASH_REDIS_REST_URL`·`UPSTASH_REDIS_REST_TOKEN`을 먼저 보고, 없으면 `KV_REST_API_URL`·`KV_REST_API_TOKEN`을 쓴다. 읽기 전용 토큰은 쓰지 않는다.
3. `RATE_LIMIT_SECRET`을 환경마다 따로 `openssl rand -base64 48`로 만들어 등록하고 재배포한다.
4. `/api/health`의 `services.sharedRateLimit`이 `configured`인지 확인한다. `per-instance`이면 URL·토큰·비밀값 중 하나가 빠진 것이다.

무료 플랜은 월 50만 명령까지 카드 등록 없이 쓸 수 있다. 요청 한 번은 Lua 스크립트 호출 한 번(`EVAL`)이고, 스크립트 안의 명령까지 모두 센다고 보수적으로 잡아도 OpenAI 요청 한 번에 약 17명령이다. 30명 연수 한 번(교사당 요청 약 24회)은 1만 2천 명령 안팎이므로 무료 한도로 월 40회 이상 쓸 수 있다. 무료 한도를 넘거나 저장소가 응답하지 않으면 서버는 메모리 제한으로 전환하므로 서비스는 멈추지 않는다.

### 한도

탭·네트워크 한도는 10분 슬라이딩 창이다. 네트워크 한도는 교사 한 명이 10분 동안 보통 쓰는 횟수에 `RATE_LIMIT_TEACHERS_PER_NETWORK`(기본 100)를 곱한 값이다.

| 경로                       | 탭당 10분 | 네트워크 10분(기본값) | 서비스 전체 AI 상한 |
| -------------------------- | --------- | --------------------- | ------------------- |
| `/api/interview/follow-up` | 40        | 교사당 12 (1,200)     | 적용                |
| `/api/profile/generate`    | 10        | 교사당 2 (200)        | 적용                |
| `/api/profile/refine`      | 30        | 교사당 6 (600)        | 적용                |
| `/api/privacy/review`      | 20        | 교사당 3 (300)        | 적용                |
| `/api/submissions/create`  | 10        | 교사당 2 (200)        | 미적용              |
| `/api/submissions/delete`  | 20        | 교사당 2 (200)        | 미적용              |
| 관리자 로그인              | 없음      | 5 (고정)              | 미적용              |

- 서비스 전체 AI 상한은 OpenAI를 부르는 네 경로를 합쳐 1분 창 `RATE_LIMIT_AI_PER_MINUTE`(기본 300), 24시간 창 `RATE_LIMIT_AI_PER_DAY`(기본 7,500)다. 교사 한 명은 AI 요청을 약 20~25회 쓰므로 기본값은 하루 약 300명 규모다.
- 요청 하나는 모든 단계를 통과할 때만 기록된다. 한 탭이 탭 한도에 걸린 요청은 같은 네트워크의 다른 교사 몫을 쓰지 않는다.
- 형식 검증에 실패한 요청과 인터뷰당 후속 질문 최대치에 도달한 요청은 세지 않는다.
- 탭 ID가 없는 요청(배포 직후 열려 있던 이전 화면 등)은 네트워크와 서비스 전체 한도만 적용된다.
- 한 장소에서 100명보다 많이 동시에 쓰거나 하루 300명보다 많이 쓰는 날에는 해당 값을 올리고 재배포한다.

### 화면 동작

- 429 응답 본문은 `error.details.retryAfterSeconds`와 `scope`(`tab`·`network`·`service`)를 담고, `Retry-After` 헤더와 메시지에 남은 시간이 들어 있다.
- 초안 생성, 모듈 다시 쓰기, 선택적 기여, 기여 삭제는 남은 시간이 담긴 메시지를 보여 준다.
- 최종 개인정보 검사는 지금처럼 '확인 안 됨'으로 넘어가되 남은 시간을 함께 보여 준다.
- 후속 질문은 지금처럼 조용히 생략하고 다음 질문으로 진행한다.

### 로그

- `rate_limit_store_fallback`: 저장소 요청 실패 이유(`request_failed`·`http_error`·`invalid_response`)와 HTTP 상태. 이후 30초 동안 메모리로 센 뒤 저장소를 다시 시도한다.
- `rate_limit_shared_store_disabled`: 저장소는 설정됐지만 `RATE_LIMIT_SECRET`이 없거나 32자보다 짧다.
- `rate_limit_service_cap_reached`: 서비스 전체 AI 상한에 도달했다. 경로와 분·일 구분만 남긴다.
- `rate_limit_invalid_config`: `RATE_LIMIT_*` 숫자 값이 잘못되어 기본값을 썼다.

로그와 저장소 어디에도 IP·탭 ID 원문이나 HMAC 값을 남기지 않는다.

## 운영 확인

- `/api/health`는 비밀값 없이 연결 준비 상태만 반환한다. `sharedRateLimit`이 `per-instance`이면 요청 제한이 인스턴스별로만 동작한다.
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
