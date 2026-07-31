import { ShieldCheck, ShieldX } from "lucide-react";

import type { PrivacyReview } from "@/types/profile";

export function PrivacyReviewPanel({
  review,
}: {
  review: PrivacyReview | null;
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
            자동 검사는 보조 수단입니다. 다운로드 전에 이름·학교명·개별 학생
            정보가 없는지 직접 한 번 더 읽어 주세요.
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
          <p className="font-bold">수정이 필요한 표현이 있습니다.</p>
          <p className="mt-1 text-sm leading-6 text-[#653c38]">
            아래 제안을 참고해 해당 문장을 직접 수정하거나 삭제한 뒤 다시 검사해
            주세요.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-4">
        {review.items.map((item, index) => (
          <li key={`${item.text}-${index}`} className="bg-white/70 p-4">
            <p className="font-semibold">검토할 문장</p>
            <p className="mt-1 text-sm leading-6 break-words">{item.text}</p>
            <p className="mt-3 text-sm">
              <strong>이유:</strong> {item.reason}
            </p>
            <p className="mt-2 text-sm">
              <strong>지원 중심 표현 예시:</strong> {item.suggestedRewrite}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
