import type { TeacherRole } from "@/types/interview";
import { TEACHER_ROLE_LABELS } from "@/types/interview";
import type { ControlledTagCategory, SchoolLevel } from "@/types/profile";

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  kindergarten: "유치원",
  elementary: "초등학교",
  middle: "중학교",
  high: "고등학교",
};

export const TAG_CATEGORY_LABELS: Record<ControlledTagCategory, string> = {
  preferredTeachingMethods: "선호하는 수업 방식",
  participationPriorities: "참여에서 중요하게 보는 것",
  emotionalSupportPriorities: "정서 지원의 우선순위",
  assessmentPriorities: "평가와 피드백의 우선순위",
  environmentConstraints: "현실적인 환경 제약",
  aiBoundaries: "AI 활용 경계",
};

export const TAG_LABELS: Record<string, string> = {
  direct_instruction: "명료한 직접 설명",
  inquiry: "탐구",
  discussion: "토의·토론",
  collaboration: "협력 학습",
  project_based: "프로젝트",
  making: "만들기",
  experiential: "체험",
  blended: "온·오프라인 혼합",
  questioning: "질문하기",
  choice: "선택권",
  judgment: "판단권",
  revision: "수정권",
  sharing: "공유",
  peer_feedback: "동료 피드백",
  reflection: "성찰",
  psychological_safety: "심리적 안전",
  low_risk_participation: "부담 낮은 참여",
  small_success_steps: "작은 성공 단계",
  growth_feedback: "성장 중심 피드백",
  multiple_expression_modes: "다양한 표현 방식",
  predictable_structure: "예측 가능한 구조",
  final_product: "최종 결과물",
  learning_process: "학습 과정",
  reasoning: "사고 과정",
  self_reflection: "자기 성찰",
  observation: "관찰",
  limited_time: "제한된 시간",
  device_gap: "기기 격차",
  unstable_network: "불안정한 인터넷",
  large_class: "큰 학급 규모",
  preparation_load: "준비 부담",
  mixed_achievement: "학습 수준 차이",
  attention_transition: "집중·전환 지원",
  no_personal_data: "개인정보 입력 금지",
  teacher_final_judgment: "교사의 최종 판단",
  student_thinking_first: "학생의 사고 우선",
  fact_check_required: "사실 확인 필수",
  copyright_review: "저작권 확인",
  disclose_ai_use: "AI 사용 알림",
};

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export function formatAdminDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

export function teacherRoleLabel(role: TeacherRole): string {
  return TEACHER_ROLE_LABELS[role];
}
