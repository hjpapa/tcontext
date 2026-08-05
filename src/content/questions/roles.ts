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
    "학급의 흐름이 흔들릴 때 누르는 ‘리셋 버튼’ 같은 루틴이 있나요? 수업과 생활에서 함께 쓰는 방법 하나를 알려 주세요.",
    "담임 역할이 수업 설계와 학급문화에 제공하는 일관된 지원을 확인합니다.",
    "잠시 멈춰 오늘의 순서와 공동 목표를 다시 보고, 질문은 메모한 뒤 차례로 나눕니다.",
  ),
  subject_teacher: roleQuestion(
    "subject_teacher",
    "preferred_teaching",
    "여러 학급을 만나도 그대로 가져가는 수업의 ‘뼈대’ 하나와, 학급마다 다르게 조정하는 것 하나는 무엇인가요?",
    "교과교사의 공통 수업 원칙과 맥락별 조정 범위를 파악합니다.",
    "도입 질문과 개념 확인은 같게 두고, 참여 속도에 따라 짝 대화 시간과 도움 자료를 조정합니다.",
  ),
  special_education_teacher: roleQuestion(
    "special_education_teacher",
    "class_context",
    "같은 배움 목표에 이르는 길을 여러 갈래로 열어 둔다면, 어떤 참여 방법이나 자료를 마련하나요?",
    "진단이나 개인 식별 없이 보편적·개별화된 지원 설계 원칙을 확인합니다.",
    "그림, 말, 조작 중 표현 방법을 고르게 하고 과제를 작은 단계로 나누며 필요한 도움의 강도를 조정합니다.",
  ),
  counselor: roleQuestion(
    "counselor",
    "participation_and_emotion",
    "상담실 안의 이야기는 지키면서 교실에는 도움이 닿게 하려면, 어디까지를 일반적인 지원으로 연결하나요?",
    "상담교사의 비밀보장 경계와 교육적 협업 원칙을 확인합니다.",
    "개별 대화에서 들은 구체 사항은 옮기지 않고, 당사자 동의와 안전 원칙 안에서 누구에게나 도움이 되는 참여 방법만 협의합니다.",
  ),
  school_nurse: roleQuestion(
    "school_nurse",
    "environment_and_ai",
    "건강교육 자료에 ‘통과 도장’을 찍기 전 확인하는 세 가지는 무엇인가요? 정확성·접근성·민감정보 보호 관점에서 알려 주세요.",
    "보건교사의 정보 검토 기준과 개인정보 경계를 확인합니다.",
    "공신력 있는 최신 출처인지, 쉬운 대체 자료가 있는지, 개인 건강정보가 드러나지 않는지 확인합니다.",
  ),
  librarian: roleQuestion(
    "librarian",
    "materials_assessment_feedback",
    "자료의 바다에서 학습자가 스스로 다음 자료를 고르게 돕는 ‘나침반’은 무엇인가요? 자주 쓰는 안내 방법 하나를 알려 주세요.",
    "사서교사의 자료 큐레이션과 정보 리터러시 지원 원칙을 파악합니다.",
    "서로 다른 관점의 자료를 나란히 두고 출처, 근거, 인용을 확인하는 짧은 점검표를 제공합니다.",
  ),
  administrator: roleQuestion(
    "administrator",
    "identity_and_role",
    "학교 안에서 교사가 작은 수업 실험을 해 볼 자리를 만든다면, 어떤 시간·자원·협업을 먼저 지원하겠나요?",
    "교육 리더의 지원적 리더십과 자율성을 존중하는 의사결정 원칙을 확인합니다.",
    "공동 목표는 함께 정하되 방법은 열어 두고, 작은 시도를 나누고 성찰할 시간과 필요한 자료를 마련합니다.",
  ),
  other: roleQuestion(
    "other",
    "identity_and_role",
    "역할 이름표보다 실제 하루를 보여 준다면, 학습자나 동료에게 가장 자주 건네는 지원은 무엇인가요?",
    "기타 역할의 실제 책임과 교육적 기여를 파악합니다.",
    "활동 목표를 분명히 안내하고, 각자가 가능한 방식으로 참여하도록 자료와 소통 방법을 조정합니다.",
  ),
};
