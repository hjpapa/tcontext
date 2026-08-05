# TContext

교사의 교육관, 수업 방식, 학급 맥락과 현실적 제약을 반구조화 인터뷰로 정리해 여러 생성형 AI에서 재사용할 수 있는 Markdown 컨텍스트 문서로 만드는 개인정보 보호 중심 웹앱입니다.

TContext는 교사를 점수화하거나 MBTI처럼 유형화하지 않습니다. AI가 만든 모든 문장과 분석 태그는 교사가 직접 검토·수정·삭제·확정합니다.

## 주요 기능

- 로그인 없는 12~18분 교사 인터뷰
- 유치원·초등·중학교·고등학교 및 8개 역할별 질문 분기
- 고정 핵심 질문과 최대 4개의 제한된 AI 후속 질문
- 직접 진술, AI 추론, 확인 필요 근거 구분
- 7개 모듈의 Zod 검증 구조화 프로필
- 교사가 모든 문장과 controlled tag를 검토하는 편집 화면
- 입력 전 규칙 기반 탐지와 최종 OpenAI 개인정보 이중 검토, 경고 확인 후 로컬 내보내기
- YAML front matter를 포함한 범용 Markdown 다운로드·복사·인쇄
- 저장 없이 전체 기능 사용
- 별도 동의가 있을 때만 최종 결과를 Supabase에 선택 저장
- 제출 ID와 일회성 삭제 코드를 이용한 비로그인 삭제
- 일일 정리 간격을 포함한 최대 365일 실제 보유기간과 보호된 Vercel Cron 삭제

## 서비스 흐름

1. 개인정보 입력 주의사항 확인
2. 학교급과 역할 선택
3. 한 화면에 한 질문씩 답변
4. 필요한 경우에만 AI 후속 질문
5. 구조화 프로필 초안 생성
6. 근거 상태별 문장과 AI 작성 제목·요약·원칙·지침 수정·삭제·확인
7. 분석 태그 확인
8. 개인정보 최종 검토(수정 또는 명시적 경고 확인)
9. Markdown 다운로드·복사·인쇄
10. 개인정보 검토가 `clear`인 경우에만 원하는 최종 결과 기여
11. 저장 영수증과 삭제 코드 보관

원본 답변은 React 메모리에만 남으며 Web Storage, 쿠키, IndexedDB에 기록하지 않습니다. `sessionStorage`에는 학교급·역할·현재 질문 위치 같은 비민감 진행 메타데이터만 남고, 언제든 모든 브라우저 기록을 지울 수 있습니다. 새로고침하거나 탭을 닫으면 답변을 복구할 수 없습니다.

## 기술 구성

- Next.js 16 App Router, React 19, TypeScript strict
- Tailwind CSS 4, shadcn/ui, Lucide
- React Hook Form, Zod
- OpenAI JavaScript SDK와 Responses API Structured Outputs
- Supabase JavaScript SDK, PostgreSQL RLS
- Vitest, React Testing Library, Playwright
- pnpm, ESLint, Prettier
- Vercel

OpenAI와 Supabase Secret Key를 사용하는 코드는 모두 Next.js Route Handler 및 `server-only` 모듈에 한정됩니다. 브라우저에서 두 서비스로 직접 요청하지 않습니다.

## OpenAI 모델

| 작업                           | 환경 변수                | 기본값          | reasoning effort |
| ------------------------------ | ------------------------ | --------------- | ---------------- |
| 후속 질문 판단·생성            | `OPENAI_INTERVIEW_MODEL` | `gpt-5.6-luna`  | `low`            |
| 전체 프로필·Markdown 내용 생성 | `OPENAI_PROFILE_MODEL`   | `gpt-5.6-terra` | `low`            |
| 최종 개인정보 검토             | `OPENAI_PRIVACY_MODEL`   | `gpt-5.6-terra` | `low`            |

모델은 환경 변수로 교체할 수 있습니다. 교체 전 Structured Output 호환성, Zod 검증, 충실성, 개인정보 평가를 다시 실행해야 합니다. 비용은 OpenAI 계정의 해당 모델 입력·출력 토큰 단가에 따라 달라지므로 운영 시 실제 사용량과 공식 가격표를 확인하세요. 애플리케이션 로그에는 모델명, 처리 시간, 토큰 사용량, 성공 여부만 남기며 질문·답변·프로필 본문은 남기지 않습니다.

## Supabase 저장 구조

`public.teacher_context_submissions`에는 사용자가 최종 확인하고 명시적으로 동의한 경우에만 다음을 저장합니다.

- canonical `profile_json`
- 동일 JSON에서 만든 `profile_markdown`
- 사용자가 확인한 `confirmed_tags`
- 최종 `privacy_review`
- 학교급·역할 및 스키마·프롬프트·앱·동의·모델 버전
- 동의 시각, 보유 만료 시각
- 삭제 코드의 해시

원본 인터뷰의 전사본이나 별도 답변 필드, 이름, 이메일, IP 주소, 학교명, 학생명, 브라우저 식별자, 삭제 코드 원문은 저장하지 않습니다. 교사가 근거별 문장과 AI 작성 제목·요약·원칙·지침을 검토한 최종 프로필만 선택적으로 저장하며, 이 프로필에는 인터뷰에서 확인한 수업 맥락이 요약되어 있습니다. RLS를 강제하고 `anon` 및 `authenticated`에는 읽기·쓰기 정책과 권한을 주지 않습니다.

## 선택적 데이터 기여

Markdown 다운로드가 가장 중요한 동작이며 데이터 기여는 별도 보조 동작입니다. 체크박스는 기본 해제 상태이고, 저장 항목·목적·최대 365일 실제 보유기간을 확인한 사용자가 명시적으로 동의해야만 서버가 저장합니다. 기본 정책에서는 일일 정리 작업이 끝날 때까지의 최대 하루를 보유기간 안에 포함하기 위해 기여 364일 뒤 삭제 대상으로 전환합니다.

저장 시 반환되는 `tcontext-submission-receipt-{submissionId}.txt`에는 제출 ID와 일회성 삭제 코드가 들어 있습니다. 로그인이나 이메일을 수집하지 않으므로 이 코드를 잃으면 제출물을 다시 찾거나 삭제하기 어렵습니다.

삭제는 `/delete`에서 제출 ID와 삭제 코드를 입력해 실행합니다. 서버는 코드 원문을 저장하지 않고 안전한 해시만 비교합니다. 저장된 프로필을 공개 API로 다시 조회하는 기능은 없습니다.

## 관리자 문서 열람

`/admin`은 운영자가 명시적 동의를 받아 저장된 최종 문서를 읽기 전용으로 확인하는 비공개 화면입니다. 목록·학교급 필터·상세 문서·저장된 Markdown 원문과 다운로드를 제공하며, 삭제 코드 해시와 원본 인터뷰 답변은 조회하지 않습니다. 공개 메뉴에는 관리자 링크를 노출하지 않습니다.

로컬 관리자 자격증명은 다음 명령으로 생성합니다. 비밀번호는 한 번만 표시되므로 비밀번호 관리자에 보관하고 개발 서버를 다시 시작하세요.

```bash
pnpm admin:setup
```

Vercel에서는 생성된 `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `ADMIN_SESSION_TTL_HOURS`를 Preview와 Production에 각각 설정합니다. 관리자 세션은 서명된 HttpOnly 쿠키를 사용하며 기본 유효시간은 8시간입니다.

## Markdown

구조화 JSON이 canonical source이며 Markdown은 그 JSON에서 결정적으로 생성됩니다. 결과에는 버전, 생성 시각, 학교급, 역할의 YAML front matter와 7개 모듈, 수업 설계 원칙, 지원 고려사항, 현실적 제약, AI 협업 지침, 교사가 확인한 태그가 포함됩니다.

데이터베이스 저장을 거부해도 Markdown 다운로드·Markdown 복사·일반 텍스트 복사·AI용 압축본 복사·인쇄를 모두 사용할 수 있습니다.

## 로컬 실행

요구 사항:

- Node.js 22 이상
- pnpm 11

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

`http://localhost:3000`을 엽니다. 비밀값이 없어도 랜딩, 개인정보 안내, 가상 예시와 일부 로컬 UI를 확인할 수 있지만 AI 생성과 선택 저장에는 서버 환경 변수가 필요합니다.

## 환경 변수

```dotenv
OPENAI_API_KEY=
OPENAI_INTERVIEW_MODEL=gpt-5.6-luna
OPENAI_PROFILE_MODEL=gpt-5.6-terra
OPENAI_PRIVACY_MODEL=gpt-5.6-terra

SUPABASE_URL=
SUPABASE_SECRET_KEY=

DATA_RETENTION_DAYS=365
CONSENT_VERSION=1.0
PROFILE_SCHEMA_VERSION=1.0
PROMPT_VERSION=1.2

DELETE_TOKEN_PEPPER=
CRON_SECRET=

ADMIN_PASSWORD_HASH=
ADMIN_SESSION_SECRET=
ADMIN_SESSION_TTL_HOURS=8

NEXT_PUBLIC_APP_NAME=TContext
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, `DELETE_TOKEN_PEPPER`, `CRON_SECRET`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`은 서버 전용입니다. `NEXT_PUBLIC_` 접두사를 붙이거나 저장소에 커밋하지 마세요. `.env.local`은 `.gitignore`에 포함되어 있습니다.

`DATA_RETENTION_DAYS`는 일일 정리 지연까지 포함해 행이 실제로 저장될 수 있는 최장 일수입니다. 삭제 대상 전환 시각은 `consented_at + max(DATA_RETENTION_DAYS - 1, 0)일`로 계산합니다. 값이 `1`이면 기여 즉시 삭제 대상이 되고 다음 일일 정리 주기 안에 삭제됩니다.

## Supabase 마이그레이션

Supabase CLI로 프로젝트를 연결하고 마이그레이션을 적용합니다.

```bash
supabase link --project-ref fqbcyornlnxqmchyhlhs
supabase db push
```

적용 파일:

- `supabase/migrations/202607300001_create_teacher_context_submissions.sql`
- `supabase/migrations/202607300002_create_analytics_views.sql`
- `supabase/migrations/202607310001_allow_immediate_retention_eligibility.sql`

첫 마이그레이션은 테이블, 제약조건, 인덱스, RLS와 최소 권한을 만듭니다. 두 번째는 5건 미만 집단을 제외하는 서버 전용 집계 뷰를 만듭니다. 만료 삭제는 보호된 Next.js Route Handler가 서버 전용 Supabase 클라이언트로 직접 수행합니다.

## 검사와 테스트

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

CI에서는 OpenAI SDK와 Supabase 클라이언트를 모킹하며 실제 API나 운영 데이터베이스를 호출하지 않습니다.

## Vercel 배포

운영 주소: [https://tcontext.vercel.app](https://tcontext.vercel.app)

1. GitHub `hjpapa/tcontext` 저장소를 Vercel `tcontext` 프로젝트에 연결합니다.
2. `.env.example`의 값을 Preview와 Production에 각각 설정합니다.
3. 두 환경에는 서로 독립된 `DELETE_TOKEN_PEPPER`, `CRON_SECRET`을 사용합니다.
4. Preview에서 전체 흐름과 모바일 화면을 확인합니다.
5. 통과한 `main` 커밋을 Production으로 승격합니다.

`vercel.json`의 Cron은 매일 삭제 대상이 된 행을 정리합니다. 기본 365일 정책은 364일째 삭제 대상으로 전환해 다음 일일 실행까지 포함한 실제 보유기간이 최대 365일을 넘지 않게 합니다. 상세 운영 절차는 [docs/deployment.md](docs/deployment.md)를 참고하세요.

## 문서

- [제품 명세](docs/product-spec.md)
- [개인정보 보호 설계](docs/privacy-design.md)
- [데이터 사전](docs/data-dictionary.md)
- [프롬프트 설계](docs/prompt-design.md)
- [질문 은행](docs/question-bank.md)
- [평가와 테스트](docs/evals.md)
- [배포와 운영](docs/deployment.md)

## 알려진 한계

- 개인정보 탐지는 규칙과 AI를 함께 사용해도 모든 문맥상 식별 정보를 찾는다고 보장할 수 없습니다.
- 응답 품질과 비용은 모델 버전과 사용자의 답변 길이에 따라 달라집니다.
- 삭제 코드를 분실하면 로그인·이메일이 없어 제출물을 찾아줄 수 없습니다.
- 분석 태그는 사용자가 확인한 제한 어휘이며 교사의 전문성 평가나 순위에 사용할 수 없습니다.

## 라이선스와 운영 책임

교육 현장에서 실제 운영하기 전 조직의 개인정보 처리방침, 위탁·국외 이전 여부, 보유기간, 민원·삭제 대응 절차에 대해 별도 법률·보안 검토가 필요합니다.
