import { ResultView } from "@/components/export/result-view";
import { getConsentVersion, getRetentionDays } from "@/lib/consent/policy";

export default function ResultPage() {
  const consentVersion = getConsentVersion();
  const retentionDays = getRetentionDays();

  return (
    <div className="page-container py-8 sm:py-12 lg:py-16 print:max-w-none print:p-0">
      <div className="page-workspace print:border-0 print:p-0 print:shadow-none">
        <ResultView
          consentVersion={consentVersion}
          retentionDays={retentionDays}
        />
      </div>
    </div>
  );
}
