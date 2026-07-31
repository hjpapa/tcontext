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
    "학급 운영과 교과 수업을 함께 맡을 때, 일관되게 유지하려는 루틴이나 지원 원칙은 무엇인가요?",
    "담임 역할이 수업 설계와 학급문화에 미치는 영향을 확인합니다.",
    "하루 시작에 일정을 예고하고, 모든 교과에서 질문을 메모했다가 공유하는 같은 루틴을 사용합니다.",
  ),
  subject_teacher: roleQuestion(
    "subject_teacher",
    "preferred_teaching",
    "여러 학급에서 교과 수업을 운영할 때도 유지하는 핵심 수업 구조와, 학급마다 조정하는 부분은 무엇인가요?",
    "교과교사의 공통 수업 원칙과 맥락별 조정 범위를 파악합니다.",
    "도입 질문과 개념 확인은 같게 두고, 학급별 참여 속도에 따라 짝 대화 시간과 도움 자료를 조정합니다.",
  ),
  special_education_teacher: roleQuestion(
    "special_education_teacher",
    "class_context",
    "다양한 학습 접근이 필요한 수업에서 참여 방법과 자료를 어떻게 여러 형태로 제공하나요?",
    "진단이나 개인 식별 없이 보편적·개별화된 지원 설계 원칙을 확인합니다.",
    "그림, 말, 조작 활동 중 표현 방법을 고르게 하고 과제를 작은 단계로 나누며 필요한 도움의 강도를 조정합니다.",
  ),
  counselor: roleQuestion(
    "counselor",
    "participation_and_emotion",
    "정서적 안전과 비밀보장을 지키면서 교육 활동으로 연결할 수 있는 지원의 범위는 어디까지인가요?",
    "상담교사의 전문적 경계와 교육적 협업 원칙을 확인합니다.",
    "개별 상담에서 알게 된 사항은 공유하지 않고, 당사자 동의와 안전 원칙 안에서 교실에서 가능한 일반적 지원만 협의합니다.",
  ),
  school_nurse: roleQuestion(
    "school_nurse",
    "environment_and_ai",
    "건강교육이나 지원을 설계할 때 정확성, 접근성, 민감정보 보호를 어떻게 확인하나요?",
    "보건교사의 정보 검토 기준과 개인정보 경계를 확인합니다.",
    "공신력 있는 최신 자료를 확인하고 쉬운 표현과 대체 자료를 제공하며 개인별 보건 관련 정보는 AI에 입력하지 않습니다.",
  ),
  librarian: roleQuestion(
    "librarian",
    "materials_assessment_feedback",
    "도서관 수업이나 교과 협력에서 자료 선택과 정보 활용 과정을 어떻게 지원하나요?",
    "사서교사의 자료 큐레이션과 정보 리터러시 원칙을 파악합니다.",
    "읽기 수준과 관점을 고려해 여러 자료를 제시하고, 출처 확인과 인용 과정을 짧은 점검표로 안내합니다.",
  ),
  administrator: roleQuestion(
    "administrator",
    "identity_and_role",
    "교사와 학생의 자율성을 존중하면서 학교 차원의 수업 개선을 어떤 방식으로 지원하나요?",
    "교육 리더의 지원적 리더십과 의사결정 원칙을 확인합니다.",
    "일률적 방식보다 공동의 목표를 합의하고, 교사가 작은 시도를 공유하고 성찰할 시간과 자원을 마련합니다.",
  ),
  other: roleQuestion(
    "other",
    "identity_and_role",
    "현재 역할에서 주로 만나는 학습자와 동료에게 제공하는 핵심 지원은 무엇인가요?",
    "기타 역할의 실제 책임과 교육적 기여를 파악합니다.",
    "활동 목표를 분명히 안내하고, 각자가 가능한 방식으로 참여하도록 자료와 소통 방법을 조정합니다.",
  ),
};
