import Image from "next/image";
import type {
  GuideMethodStatus,
  PlatformGuide,
  PlatformGuideMethod,
} from "@/content/platform-guides/schema";
import { GuideArtifacts } from "./guide-artifacts";

const STATUS_LABELS: Record<GuideMethodStatus, string> = {
  recommended: "권장",
  available: "사용 가능",
  transitioning: "전환 중",
  announced: "출시 예정",
  retired: "종료",
};
export function GuideNotices() {
  return (
    <aside
      aria-label="외부 서비스 이용 안내"
      className="bg-secondary/50 space-y-2 rounded-2xl border p-5 text-sm leading-7"
    >
      <p>
        파일과 지침을 등록하면 문서 내용이 외부 서비스로 전달됩니다. 등록하기
        전에 개인정보가 없는지와 각 서비스의 데이터 설정을 확인하세요.
      </p>
      <p>
        TContext와 외부 서비스는 자동 동기화되지 않습니다. TContext에서 문서를
        수정한 뒤에는 파일을 다시 등록해야 합니다.
      </p>
    </aside>
  );
}
function Method({
  method,
  downloads = true,
}: {
  method: PlatformGuideMethod;
  downloads?: boolean;
}) {
  const [year, month] = method.verifiedAt.split("-");
  return (
    <section
      id={method.id}
      aria-labelledby={`${method.id}-title`}
      className={`min-w-0 space-y-5 rounded-2xl border p-5 sm:p-7 ${method.status === "recommended" ? "border-primary bg-secondary/20" : "bg-card"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`${method.id}-title`} className="text-2xl font-bold">
          {method.label}
        </h2>
        <span className="bg-secondary text-primary rounded-full px-3 py-1 text-sm font-semibold">
          {STATUS_LABELS[method.status]}
        </span>
      </div>
      <p className="text-muted-foreground text-sm">
        {year}년 {Number(month)}월 기준 안내
      </p>
      {method.availabilityNote ? (
        <p className="leading-7">{method.availabilityNote}</p>
      ) : null}
      {method.migrationNote ? (
        <p className="border-l-4 border-amber-600 bg-amber-50 p-4 leading-7">
          {method.migrationNote}
        </p>
      ) : null}
      <ol className="list-decimal space-y-5 pl-5">
        {method.steps.map((step, index) => (
          <li key={index} className="pl-1">
            <h3 className="font-bold">{step.title}</h3>
            <p className="mt-1 leading-7 break-words">{step.body}</p>
            {step.image ? (
              <Image
                src={step.image.src}
                alt={step.image.alt}
                width={960}
                height={540}
                unoptimized
                className="mt-3 h-auto max-w-full rounded-lg border"
              />
            ) : null}
          </li>
        ))}
      </ol>
      {method.instructionTarget ? (
        <p className="text-sm">
          공통 지침을 붙여 넣는 곳: {method.instructionTarget}
        </p>
      ) : null}
      {downloads ? (
        <GuideArtifacts artifacts={method.requiredArtifacts} />
      ) : null}
      <a
        href={method.officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        공식 도움말 열기 (새 탭)
      </a>
    </section>
  );
}
export function PlatformGuideView({ guide }: { guide: PlatformGuide }) {
  const active = guide.methods.filter(
    (method) => method.status !== "retired" && method.status !== "announced",
  );
  const announced = guide.methods.filter(
    (method) => method.status === "announced",
  );
  const retired = guide.methods.filter((method) => method.status === "retired");
  const fallback = guide.methods.find(
    (method) => method.id === guide.fallbackMethodId,
  );
  return (
    <div className="min-w-0 space-y-7">
      <header>
        <p className="eyebrow">AI에서 활용하기</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          {guide.name} 활용 가이드
        </h1>
        <p className="text-muted-foreground mt-3 leading-7">{guide.summary}</p>
      </header>
      <GuideNotices />
      {fallback ? (
        <p>
          권장 방법을 이용하기 어렵다면{" "}
          <a
            className="text-primary font-semibold underline"
            href={`#${fallback.id}`}
          >
            {fallback.label}
          </a>{" "}
          방법을 확인하세요.
        </p>
      ) : null}
      {active.map((method) => (
        <Method key={method.id} method={method} />
      ))}
      {announced.map((method) => (
        <details key={method.id} className="rounded-2xl border p-4">
          <summary className="cursor-pointer font-semibold">
            {method.label} · 출시 예정 안내
          </summary>
          <div className="mt-4">
            <Method method={method} downloads={false} />
          </div>
        </details>
      ))}
      {retired.length ? (
        <details className="rounded-2xl border p-4">
          <summary className="cursor-pointer font-semibold">
            이전에 사용한 방법의 전환 안내
          </summary>
          <div className="mt-4 space-y-4">
            {retired.map((method) => (
              <Method key={method.id} method={method} downloads={false} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
