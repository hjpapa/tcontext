import { DeleteContributionForm } from "@/components/consent/delete-contribution-form";

export default function DeletePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="space-y-4">
        <p className="text-sm font-bold text-[#8d352f]">선택적 기여 데이터</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          제출 ID와 삭제 코드로 영구 삭제합니다.
        </h1>
        <p className="text-lg leading-8 text-[#536159]">
          이 화면은 결과를 선택적으로 기여한 경우에만 사용합니다. 브라우저 탭의
          인터뷰를 지우는 기능과는 별개입니다.
        </p>
      </header>
      <div className="mt-10 border-t border-[#cfd8d0] pt-8">
        <DeleteContributionForm />
      </div>
    </div>
  );
}
