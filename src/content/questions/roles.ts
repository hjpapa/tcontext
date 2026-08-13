import type { InterviewQuestion, TeacherRole } from "@/types/interview";

const PRIVACY_HINT =
  "개인을 식별할 수 있는 이름·기관명·사례·건강·상담 정보 없이, 역할에서 반복되는 업무 맥락과 지원 원칙만 적어 주세요.";

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
    "잠시 멈추고 오늘의 순서와 공동 목표를 다시 확인합니다.",
  ),
  subject_teacher: roleQuestion(
    "subject_teacher",
    "preferred_teaching",
    "같은 내용을 여러 반에서 가르칠 때, 반에 따라 가장 먼저 바꾸는 것은 무엇인가요?",
    "학급의 반응에 따라 먼저 조정하는 수업 요소 하나를 확인합니다.",
    "학생 반응을 보고 설명 길이부터 바꿉니다.",
  ),
  special_education_teacher: roleQuestion(
    "special_education_teacher",
    "class_context",
    "같은 목표를 배우되 방법을 다르게 줄 때, 가장 먼저 바꾸는 것은 무엇인가요?",
    "같은 목표에 여러 방법으로 다가가도록 먼저 바꾸는 요소 하나를 확인합니다.",
    "답을 말·그림·도구 중에서 표현하게 합니다.",
  ),
  counselor: roleQuestion(
    "counselor",
    "participation_and_emotion",
    "상담에서 알게 된 내용을 지키면서 교실 지원을 요청할 때, 꼭 지키는 원칙 하나는 무엇인가요?",
    "상담 내용을 보호하며 교실 지원을 요청하는 원칙 하나를 확인합니다.",
    "상담 내용은 말하지 않고 필요한 지원 방법만 전달합니다.",
  ),
  school_nurse: roleQuestion(
    "school_nurse",
    "materials_assessment_feedback",
    "건강교육 자료를 고를 때 가장 먼저 보는 기준은 무엇인가요?",
    "건강교육 자료를 고를 때 먼저 보는 기준 하나를 확인합니다.",
    "믿을 만한 기관이 최근에 만든 자료인지 봅니다.",
  ),
  librarian: roleQuestion(
    "librarian",
    "materials_assessment_feedback",
    "자료가 믿을 만한지 확인하도록 가르칠 때, 가장 먼저 보게 하는 것은 무엇인가요?",
    "자료가 믿을 만한지 확인하는 첫 기준 하나를 확인합니다.",
    "누가 어떤 근거로 만든 자료인지 먼저 보게 합니다.",
  ),
  administrator: roleQuestion(
    "administrator",
    "identity_and_role",
    "새로운 수업을 시도하려는 교사를 위해 가장 먼저 마련하는 지원은 무엇인가요?",
    "교사의 새로운 수업 시도를 위해 먼저 마련하는 지원 하나를 확인합니다.",
    "작게 시도해 볼 수 있는 공동 준비 시간을 마련합니다.",
  ),
  other: roleQuestion(
    "other",
    "identity_and_role",
    "현재 역할에서 학습자나 교사에게 가장 자주 주는 도움은 무엇인가요?",
    "현재 역할에서 반복해 주는 도움 하나를 확인합니다.",
    "활동 목표와 다음 할 일을 분명하게 안내합니다.",
  ),
};
