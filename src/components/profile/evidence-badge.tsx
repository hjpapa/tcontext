import { Badge } from "@/components/ui/badge";
import type { EvidenceBasis } from "@/types/profile";

const BASIS_COPY: Record<
  EvidenceBasis,
  { label: string; description: string; className: string }
> = {
  direct: {
    label: "직접 진술",
    description: "선생님의 답변에 직접 나타난 내용",
    className: "border-[#9bb8a5] bg-[#edf5ef] text-[#18452f]",
  },
  inferred: {
    label: "AI 추론",
    description: "여러 답변을 AI가 종합한 해석",
    className: "border-[#d7bd8b] bg-[#fff8e8] text-[#6f4c0e]",
  },
  needs_confirmation: {
    label: "확인 필요",
    description: "근거가 충분하지 않아 선생님의 판단이 필요한 내용",
    className: "border-[#dda5a0] bg-[#fff0ee] text-[#7a2f2a]",
  },
};

export function EvidenceBadge({ basis }: { basis: EvidenceBasis }) {
  const copy = BASIS_COPY[basis];
  return (
    <Badge
      variant="outline"
      title={copy.description}
      className={copy.className}
    >
      {copy.label}
    </Badge>
  );
}

export function EvidenceLegend() {
  return (
    <div
      className="grid gap-3 border-y border-[#dce2dc] py-4 text-sm sm:grid-cols-3"
      aria-label="문장 근거 표시 안내"
    >
      {(Object.keys(BASIS_COPY) as EvidenceBasis[]).map((basis) => (
        <div key={basis} className="flex items-start gap-2">
          <EvidenceBadge basis={basis} />
          <span className="leading-6 text-[#536159]">
            {BASIS_COPY[basis].description}
          </span>
        </div>
      ))}
    </div>
  );
}
