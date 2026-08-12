import {
  CONTEXT_DOCUMENT_TITLE,
  LESSON_DESIGN_SELF_CHECKS,
  PROFILE_INTERPRETATION_RULES,
} from "@/content/profile-document";
import {
  teacherContextProfileSchema,
  type TeacherContextProfile,
} from "@/types/profile";

import { escapeHtml } from "./sanitize";

export const BROWSER_PDF_GUIDANCE =
  "인쇄 창에서 대상 프린터를 ‘PDF로 저장’으로 선택하면 파일로 보관할 수 있습니다.";

function printableList(values: readonly string[], emptyText: string): string {
  const items = values.length > 0 ? values : [emptyText];
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

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
  const useGuide = printableList(
    [
      "이 문서를 수업안·활동지·평가·수업 자료를 만들거나 검토할 때 기본 배경으로 사용합니다.",
      "수업마다 교과·단원·성취기준·목표·시간·핵심 활동·자료·원하는 결과물을 별도로 추가합니다.",
      ...PROFILE_INTERPRETATION_RULES,
    ],
    "현재 수업 정보를 추가해 주세요.",
  );
  const selfChecks = printableList(
    LESSON_DESIGN_SELF_CHECKS.map((item) => `□ ${item}`),
    "교사가 생성 결과를 직접 확인해 주세요.",
  );

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(profile.profileTitle)}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:32px;color:#17202a;line-height:1.65}
    h1{font-size:1.8rem;margin-bottom:.25rem}h2{font-size:1.25rem;margin-top:2rem}p.subtitle{color:#52605a;margin-top:0}li{margin:.4rem 0}.privacy-warning{border-left:4px solid #b66a2c;background:#fff8ec;padding:12px 16px;margin:16px 0}
    @media print{body{padding:0}section{break-inside:avoid}}
  </style>
</head>
<body>
  <h1>${escapeHtml(profile.profileTitle)}</h1>
  <p class="subtitle">${escapeHtml(CONTEXT_DOCUMENT_TITLE)}</p>
  ${privacyWarning}
  <p>${escapeHtml(profile.shortSummary)}</p>
  <section><h2>0. 문서의 목적과 사용 방법</h2>${useGuide}</section>
  ${moduleHtml}
  <section><h2>수업 설계 실행 가이드</h2>
    <h3>핵심 수업 설계 원칙</h3>${printableList(profile.teachingDesignPrinciples, "아직 확인된 원칙이 없습니다.")}
    <h3>학급 지원 고려사항</h3>${printableList(profile.classSupportConsiderations, "아직 확인된 지원 고려사항이 없습니다.")}
    <h3>현실적인 제약과 대체안</h3>${printableList(profile.realisticConstraints, "아직 확인된 제약이 없습니다.")}
    <h3>AI와 협업할 때의 지침과 판단 경계</h3>${printableList(profile.aiCollaborationInstructions, "AI 협업 지침을 직접 추가해 주세요.")}
  </section>
  <section><h2>생성 결과 자기 점검</h2>${selfChecks}</section>
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
