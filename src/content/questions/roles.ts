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
    "학급의 흐름이 흔들릴 때 가장 먼저 회복시키는 루틴은 무엇인가요?",
    "담임교사가 학급의 흐름을 회복하는 핵심 루틴을 확인합니다.",
    "잠시 멈춰 오늘의 순서와 공동 목표를 다시 확인합니다.",
  ),
  subject_teacher: roleQuestion(
    "subject_teacher",
    "preferred_teaching",
    "여러 학급을 가르쳐도 바꾸지 않고 유지하는 수업 원칙 하나는 무엇인가요?",
    "교과교사가 여러 학급에서 일관되게 유지하는 수업 원칙을 확인합니다.",
    "수업 시작 질문과 개념 확인 절차는 모든 학급에서 유지합니다.",
  ),
  special_education_teacher: roleQuestion(
    "special_education_teacher",
    "class_context",
    "같은 학습 목표에 접근하는 방법을 다양하게 만들 때 가장 먼저 조정하는 요소는 무엇인가요?",
    "다양한 학습 접근을 위해 우선 조정하는 요소를 확인합니다.",
    "과제를 표현하는 방식을 말·그림·도구 중에서 선택하게 합니다.",
  ),
  counselor: roleQuestion(
    "counselor",
    "participation_and_emotion",
    "상담 내용을 보호하면서 교실 지원으로 연결할 때 지키는 가장 중요한 경계는 무엇인가요?",
    "상담 비밀 보장과 교실 지원을 연결하는 핵심 경계를 확인합니다.",
    "개별 상담 내용은 공유하지 않고 필요한 지원 원칙만 전달합니다.",
  ),
  school_nurse: roleQuestion(
    "school_nurse",
    "materials_assessment_feedback",
    "건강교육 자료를 선택할 때 가장 먼저 확인하는 기준은 무엇인가요?",
    "건강교육 자료를 검토하는 핵심 기준을 확인합니다.",
    "공신력 있는 최신 출처인지 먼저 확인합니다.",
  ),
  librarian: roleQuestion(
    "librarian",
    "materials_assessment_feedback",
    "학습자가 자료의 신뢰성을 판단하도록 도울 때 가장 먼저 확인하게 하는 기준은 무엇인가요?",
    "학습자의 정보 신뢰성 판단을 돕는 핵심 기준을 확인합니다.",
    "자료를 누가 어떤 근거로 만들었는지 먼저 확인하게 합니다.",
  ),
  administrator: roleQuestion(
    "administrator",
    "identity_and_role",
    "교사가 새로운 수업을 시도하도록 돕기 위해 가장 먼저 제공할 지원은 무엇인가요?",
    "교육 리더가 새로운 수업 시도를 위해 우선 제공하는 지원을 확인합니다.",
    "작게 시도할 수 있는 공동 준비 시간을 먼저 제공합니다.",
  ),
  other: roleQuestion(
    "other",
    "identity_and_role",
    "현재 역할에서 학습자나 교사에게 가장 자주 제공하는 지원은 무엇인가요?",
    "기타 역할에서 반복적으로 제공하는 핵심 교육 지원을 확인합니다.",
    "활동 목표를 명확하게 안내하는 지원을 자주 제공합니다.",
  ),
};
