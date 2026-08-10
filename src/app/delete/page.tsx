import { DeleteContributionForm } from "@/components/consent/delete-contribution-form";

export default function DeletePage() {
  return (
    <div className="page-container py-8 sm:py-12 lg:py-16">
      <div className="page-workspace mx-auto max-w-3xl">
        <header className="space-y-4">
          <p className="text-destructive text-sm font-bold">
            선택적 기여 데이터
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            제출 ID와 삭제 코드로 영구 삭제합니다.
          </h1>
          <p className="text-muted-foreground text-lg leading-8">
            이 화면은 결과를 선택적으로 기여한 경우에만 사용합니다. 브라우저
            탭의 인터뷰를 지우는 기능과는 별개입니다.
          </p>
        </header>
        <div className="mt-10 border-t pt-8">
          <DeleteContributionForm />
        </div>
      </div>
    </div>
  );
}
