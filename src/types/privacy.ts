export const PRIVACY_RISK_TYPES = [
  "email",
  "phone",
  "resident_registration_number",
  "birth_date",
  "address",
  "student_name",
  "person_name",
  "individual_score",
  "rank",
  "medical_or_counseling",
  "school_name",
  "stigmatizing_description",
] as const;

export type PrivacyRiskType = (typeof PRIVACY_RISK_TYPES)[number];
export type PrivacyRiskSeverity = "high" | "medium";

export type PrivacyMatch = {
  type: PrivacyRiskType;
  severity: PrivacyRiskSeverity;
  start: number;
  end: number;
  matchedText: string;
  reason: string;
  suggestedRewrite: string;
};

export type PrivacyScanResult = {
  status: "clear" | "blocked";
  matches: PrivacyMatch[];
  notice: string;
};

export type SupportCenteredRewrite = {
  original: string;
  rewritten: string;
  changed: boolean;
  reasons: string[];
};
