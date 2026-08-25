import type { InterviewQuestion, TeacherRole } from "@/types/interview";

const PRIVACY_HINT =
  "사람 이름, 전화번호, 이메일, 식별번호, 생년월일, 상세 주소, 정확한 기관이나 반 이름, 개인과 연결되는 건강, 상담, 성적 정보는 적지 마세요. 역할에서 반복되는 업무 상황, 대략적인 인원, 집단의 경향과 필요한 지원은 적어도 됩니다.";

const roleQuestion = (
  role: TeacherRole,
  moduleId: InterviewQuestion["moduleId"],
  prompt: string,
  intent: string,
  example: string,
): InterviewQuestion => ({
  id: `role-${role}`,
  moduleId,
  source: "role",
  roles: [role],
  prompt,
  intent,
  example,
  privacyHint: PRIVACY_HINT,
  required: false,
});

export const ROLE_QUESTIONS: Record<TeacherRole, InterviewQuestion> = {
  homeroom_teacher: roleQuestion(
    "homeroom_teacher",
    "class_context",
    "학급 분위기가 흔들릴 때 다시 차분해지도록 돕는 ‘리셋 버튼’ 같은 루틴 하나는 무엇인가요?",
    "학급 분위기를 다시 차분하게 만드는 루틴 하나를 확인합니다.",
    "잠시 멈추고 오늘의 순서를 다시 확인합니다. 다음에 할 일을 한 문장으로 함께 말합니다.",
  ),
  subject_teacher: roleQuestion(
    "subject_teacher",
    "preferred_teaching",
    "같은 내용을 여러 반에서 가르칠 때, 반에 따라 가장 먼저 바꾸는 것은 무엇인가요?",
    "학급의 반응에 따라 먼저 조정하는 수업 요소 하나를 확인합니다.",
    "학생 반응을 보고 예시 수를 먼저 조정합니다. 개념이 익숙한 반에서는 예시를 줄이고 연습 시간을 늘립니다.",
  ),
  special_education_teacher: roleQuestion(
    "special_education_teacher",
    "class_context",
    "같은 목표를 배우되 방법을 다르게 줄 때, 가장 먼저 바꾸는 것은 무엇인가요?",
    "같은 목표에 여러 방법으로 다가가도록 먼저 바꾸는 요소 하나를 확인합니다.",
    "말, 그림, 도구 가운데 답을 표현할 방법을 고르게 합니다. 학습 목표는 모두 같게 둡니다.",
  ),
  counselor: roleQuestion(
    "counselor",
    "participation_and_emotion",
    "상담에서 알게 된 내용을 지키면서 교실 지원을 요청할 때, 꼭 지키는 원칙 하나는 무엇인가요?",
    "상담 내용을 보호하며 교실 지원을 요청하는 원칙 하나를 확인합니다.",
    "상담 내용은 말하지 않습니다. 교실에서 필요한 지원 방법만 전달합니다.",
  ),
  school_nurse: roleQuestion(
    "school_nurse",
    "materials_assessment_feedback",
    "건강교육 자료를 고를 때 가장 먼저 보는 기준은 무엇인가요?",
    "건강교육 자료를 고를 때 먼저 보는 기준 하나를 확인합니다.",
    "자료를 만든 기관과 출처가 분명한지 먼저 봅니다. 출처를 확인하기 어렵다면 수업 자료로 쓰지 않습니다.",
  ),
  librarian: roleQuestion(
    "librarian",
    "materials_assessment_feedback",
    "자료가 믿을 만한지 확인하도록 가르칠 때, 가장 먼저 보게 하는 것은 무엇인가요?",
    "자료가 믿을 만한지 확인하는 첫 기준 하나를 확인합니다.",
    "자료에 근거와 출처가 표시되어 있는지 먼저 보게 합니다. 표시가 없으면 다른 자료와 비교하게 합니다.",
  ),
  administrator: roleQuestion(
    "administrator",
    "identity_and_role",
    "새로운 수업을 시도하려는 교사를 위해 가장 먼저 마련하는 지원은 무엇인가요?",
    "교사의 새로운 수업 시도를 위해 먼저 마련하는 지원 하나를 확인합니다.",
    "작게 시도해 볼 수 있는 공동 준비 시간을 마련합니다. 결과보다 다음에 바꿀 점을 함께 살펴봅니다.",
  ),
  other: roleQuestion(
    "other",
    "identity_and_role",
    "현재 역할에서 학습자나 교사에게 가장 자주 주는 도움은 무엇인가요?",
    "현재 역할에서 반복해 주는 도움 하나를 확인합니다.",
    "다음에 할 일을 한 문장으로 안내합니다. 필요한 경우 같은 내용을 글이나 그림으로도 보여 줍니다.",
  ),
};
