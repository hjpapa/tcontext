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

적용 후 확인:

- `teacher_context_submissions`에 RLS와 FORCE RLS가 켜져 있다.
- `anon`, `authenticated`에 SELECT/INSERT/UPDATE/DELETE 권한과 정책이 없다.
- 서버 Secret Key로만 삽입·삭제할 수 있다.
- `tcontext_private.teacher_context_summary`는 5건 미만 조합을 숨긴다.

## 환경 변수

| 이름 | Preview | Production | 비고 |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | 필수 | 필수 | 서버 전용 |
| `OPENAI_INTERVIEW_MODEL` | `gpt-5-nano` | `gpt-5-nano` | 환경별 교체 가능 |
| `OPENAI_PROFILE_MODEL` | `gpt-5.4-nano` | `gpt-5.4-nano` | 환경별 교체 가능 |
| `OPENAI_PRIVACY_MODEL` | `gpt-5-nano` | `gpt-5-nano` | 환경별 교체 가능 |
| `SUPABASE_URL` | 필수 | 필수 | 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | 필수 | 필수 | 서버 전용, `NEXT_PUBLIC_` 금지 |
| `DATA_RETENTION_DAYS` | `365` | `365` | 정책 변경 시 동의 문안도 갱신 |
| `CONSENT_VERSION` | `1.0` | `1.0` | 동의 문안 버전 |
| `PROFILE_SCHEMA_VERSION` | `1.0` | `1.0` | canonical schema |
| `PROMPT_VERSION` | `1.0` | `1.0` | 프롬프트 버전 |
| `DELETE_TOKEN_PEPPER` | 필수 | 필수 | 환경별 다른 긴 무작위 값 |
| `CRON_SECRET` | 필수 | 필수 | Vercel Cron 보호 |
| `NEXT_PUBLIC_APP_NAME` | `TContext` | `TContext` | 공개 값 |

Preview와 Production에는 서로 독립된 비밀값을 설정한다. 운영 Secret Key를 로컬이나 Preview에 복사하지 않는 구성이 권장된다.

## Vercel

1. GitHub 저장소를 `tcontext` 프로젝트에 연결한다.
2. Framework Preset을 Next.js, Install Command를 `pnpm install`로 둔다.
3. Preview와 Production 환경 변수를 각각 설정한다.
4. Preview를 배포해 랜딩, 개인정보 안내, 학교급·역할 선택, 인터뷰, 생성·검토, 다운로드, 저장 거부, 선택 저장·삭제를 스모크 테스트한다.
5. 통과한 커밋을 Production에 배포한다.

`vercel.json`은 매일 한국 시간 오전 3시 17분에 만료 삭제 API를 호출한다. API는 `CRON_SECRET` 또는 Vercel Cron 인증을 검증해야 한다.

## 운영 확인

- `/api/health`는 비밀값 없이 연결 준비 상태만 반환한다.
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

