import {
  teacherContextProfileSchema,
  type TeacherContextProfile,
} from "@/types/profile";

import { escapeHtml } from "./sanitize";

export const BROWSER_PDF_GUIDANCE =
  "인쇄 창에서 대상 프린터를 ‘PDF로 저장’으로 선택하면 파일로 보관할 수 있습니다.";

export function profileToPrintableHtml(input: TeacherContextProfile): string {
  const profile = teacherContextProfileSchema.parse(input);
  const privacyWarning =
    profile.privacyReview.status === "needs_review"
      ? '<aside class="privacy-warning"><strong>개인정보 경고:</strong> 식별 가능 정보가 남아 있을 수 있습니다. 외부 공유 전에 직접 확인해 주세요.</aside>'
      : "";
  const moduleHtml = profile.modules
    .map(
      (module, index) => `
        <section>
          <h2>${index + 1}. ${escapeHtml(module.title)}</h2>
          <p>${escapeHtml(module.summary)}</p>
          <ul>${module.claims
            .map(
              (claim) =>
                `<li><strong>${claim.basis === "direct" ? "직접 진술" : claim.basis === "inferred" ? "AI 해석" : "확인 필요"}:</strong> ${escapeHtml(claim.text)}</li>`,
            )
            .join("")}</ul>
        </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(profile.profileTitle)}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:32px;color:#17202a;line-height:1.65}
    h1{font-size:1.8rem}h2{font-size:1.25rem;margin-top:2rem}li{margin:.4rem 0}.privacy-warning{border-left:4px solid #b66a2c;background:#fff8ec;padding:12px 16px;margin:16px 0}
    @media print{body{padding:0}section{break-inside:avoid}}
  </style>
</head>
<body>
  <h1>AI 활용을 위한 교사 프로파일 컨텍스트</h1>
  ${privacyWarning}
  <p>${escapeHtml(profile.shortSummary)}</p>
  ${moduleHtml}
  <section><h2>수업 설계 시 고려할 기본 원칙</h2><ul>${profile.teachingDesignPrinciples.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
  <section><h2>AI와 협업할 때의 기본 지침</h2><ul>${profile.aiCollaborationInstructions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
</body>
</html>`;
}

export function openPrintView(
  profile: TeacherContextProfile,
  windowRef: Window = window,
): boolean {
  const printWindow = windowRef.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(profileToPrintableHtml(profile));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}
