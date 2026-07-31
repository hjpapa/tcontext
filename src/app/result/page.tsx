import { ResultView } from "@/components/export/result-view";
import { getConsentVersion, getRetentionDays } from "@/lib/consent/policy";

export default function ResultPage() {
  const consentVersion = getConsentVersion();
  const retentionDays = getRetentionDays();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <ResultView
        consentVersion={consentVersion}
        retentionDays={retentionDays}
      />
    </div>
  );
}
