import { ShieldCheck, ShieldX } from "lucide-react";

import type { PrivacyReview } from "@/types/profile";

export type PrivacyReviewLocation = {
  id: string;
  label: string;
};

export function PrivacyReviewPanel({
  review,
  locationsByText,
  onNavigate,
}: {
  review: PrivacyReview | null;
  locationsByText?: ReadonlyMap<string, readonly PrivacyReviewLocation[]>;
  onNavigate?: (targetId: string) => void;
}) {
  if (!review) return null;

  if (review.status === "clear") {
    return (
      <div
        role="status"
        className="flex gap-3 border-l-4 border-[#3b7a57] bg-[#edf5ef] p-5"
      >
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 size-6 shrink-0 text-[#28684c]"
        />
        <div>
          <p className="font-bold">개인정보 최종 검사를 통과했습니다.</p>
          <p className="mt-1 text-sm leading-6 text-[#536159]">
            자동 검사는 보조 수단입니다. 다운로드 전에 이름·연락처·구체적인
            학교·반명 등 직접 식별정보가 없는지 한 번 더 읽어 주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="border-l-4 border-[#a6443d] bg-[#fff0ee] p-5">
      <div className="flex gap-3">
        <ShieldX
          aria-hidden="true"
          className="mt-0.5 size-6 shrink-0 text-[#8d352f]"
        />
        <div className="min-w-0">
          <p className="font-bold">
            명확한 직접 식별정보로 보이는 내용이 있습니다.
          </p>
          <p className="mt-1 text-sm leading-6 text-[#653c38]">
            가능하면 아래 문장을 직접 수정하거나 삭제한 뒤 다시 검사해 주세요.
            꼭 포함해야 하는 내용이라면 경고를 확인하고 서버에 저장하지 않는
            결과로 이동할 수 있지만, 선택적 데이터 기여는 사용할 수 없습니다.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-4">
        {review.items.map((item, index) => {
          const locations = locationsByText?.get(item.text) ?? [];

          return (
            <li key={`${item.text}-${index}`} className="bg-white/70 p-4">
              <p className="font-semibold">검토할 문장</p>
              <p className="mt-1 text-sm leading-6 break-words">{item.text}</p>
              <p className="mt-3 text-sm">
                <strong>이유:</strong> {item.reason}
              </p>
              <p className="mt-2 text-sm">
                <strong>지원 중심 표현 예시:</strong> {item.suggestedRewrite}
              </p>
              <div className="mt-3 border-t border-[#e6c7c3] pt-3">
                <p className="text-sm font-semibold">문장 위치</p>
                {locations.length > 0 && onNavigate ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {locations.map((location) => (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => onNavigate(location.id)}
                        className="min-h-10 rounded-lg border border-[#a6443d] bg-white px-3 py-2 text-left text-sm font-semibold text-[#7a2f2a] underline underline-offset-4 hover:bg-[#fff7f5] focus-visible:ring-2 focus-visible:ring-[#8d352f] focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        {location.label} 항목으로 이동
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-[#653c38]">
                    현재 문서에서 위치를 찾지 못했습니다.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
