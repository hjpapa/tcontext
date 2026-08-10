import { InterviewFlow } from "@/components/interview/interview-flow";

export default function InterviewPage() {
  return (
    <div className="page-container py-8 sm:py-12 lg:py-16">
      <div className="page-workspace">
        <InterviewFlow />
      </div>
    </div>
  );
}
