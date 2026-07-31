import {
  CONTROLLED_TAGS,
  PROFILE_MODULE_IDS,
  PROFILE_MODULE_TITLES,
  teacherContextProfileSchema,
  type ConfirmedTags,
  type ProfileModuleId,
  type SchoolLevel,
  type TeacherContextProfile,
} from "@/types/profile";

type ExampleSeed = {
  schoolLevel: SchoolLevel;
  role: string;
  profileTitle: string;
  shortSummary: string;
  evidenceQuestionId: string;
  moduleContent: Record<
    ProfileModuleId,
    { summary: string; claims: [string, ...string[]] }
  >;
  teachingDesignPrinciples: string[];
  classSupportConsiderations: string[];
  realisticConstraints: string[];
  aiCollaborationInstructions: string[];
  confirmedTags: ConfirmedTags;
};

const emptyConfirmedTags = (): ConfirmedTags => ({
  preferredTeachingMethods: [],
  participationPriorities: [],
  emotionalSupportPriorities: [],
  assessmentPriorities: [],
  environmentConstraints: [],
  aiBoundaries: [],
});

function buildExample(seed: ExampleSeed): TeacherContextProfile {
  return teacherContextProfileSchema.parse({
    metadata: {
      schoolLevel: seed.schoolLevel,
      role: seed.role,
      generatedAt: "2026-07-30T00:00:00.000Z",
      schemaVersion: "1.0",
      modelName: "fictional-example",
      promptVersion: "1.1",
    },
    profileTitle: seed.profileTitle,
    shortSummary: seed.shortSummary,
    modules: PROFILE_MODULE_IDS.map((id, moduleIndex) => ({
      id,
      title: PROFILE_MODULE_TITLES[id],
      summary: seed.moduleContent[id].summary,
      claims: seed.moduleContent[id].claims.map((text, claimIndex) => ({
        id: `${seed.schoolLevel}-${moduleIndex + 1}-${claimIndex + 1}`,
        text,
        basis: "direct" as const,
        evidenceQuestionIds: [seed.evidenceQuestionId],
        confirmedByUser: true,
      })),
    })),
    teachingDesignPrinciples: seed.teachingDesignPrinciples,
    classSupportConsiderations: seed.classSupportConsiderations,
    realisticConstraints: seed.realisticConstraints,
    aiCollaborationInstructions: seed.aiCollaborationInstructions,
    confirmedTags: seed.confirmedTags,
    privacyReview: { status: "clear", items: [] },
  });
}

const kindergartenTags = emptyConfirmedTags();
kindergartenTags.preferredTeachingMethods = ["experiential", "making"];
kindergartenTags.participationPriorities = ["choice", "sharing"];
kindergartenTags.emotionalSupportPriorities = [
  "predictable_structure",
  "multiple_expression_modes",
];
kindergartenTags.assessmentPriorities = ["observation", "learning_process"];
kindergartenTags.environmentConstraints = ["attention_transition"];
kindergartenTags.aiBoundaries = ["no_personal_data", "teacher_final_judgment"];

const elementaryTags = emptyConfirmedTags();
elementaryTags.preferredTeachingMethods = ["inquiry", "collaboration"];
elementaryTags.participationPriorities = ["questioning", "revision", "sharing"];
elementaryTags.emotionalSupportPriorities = [
  "psychological_safety",
  "low_risk_participation",
  "small_success_steps",
];
elementaryTags.assessmentPriorities = [
  "learning_process",
  "revision",
  "observation",
];
elementaryTags.environmentConstraints = [
  "mixed_achievement",
  "attention_transition",
];
elementaryTags.aiBoundaries = [
  "no_personal_data",
  "student_thinking_first",
  "teacher_final_judgment",
];

const middleTags = emptyConfirmedTags();
middleTags.preferredTeachingMethods = ["discussion", "inquiry", "blended"];
middleTags.participationPriorities = ["choice", "peer_feedback", "reflection"];
middleTags.emotionalSupportPriorities = [
  "low_risk_participation",
  "growth_feedback",
];
middleTags.assessmentPriorities = [
  "reasoning",
  "learning_process",
  "self_reflection",
];
middleTags.environmentConstraints = ["limited_time", "large_class"];
middleTags.aiBoundaries = [
  "fact_check_required",
  "teacher_final_judgment",
  "disclose_ai_use",
];

const highTags = emptyConfirmedTags();
highTags.preferredTeachingMethods = ["inquiry", "discussion", "project_based"];
highTags.participationPriorities = ["judgment", "revision", "reflection"];
highTags.emotionalSupportPriorities = [
  "predictable_structure",
  "growth_feedback",
];
highTags.assessmentPriorities = ["reasoning", "revision", "final_product"];
highTags.environmentConstraints = [
  "limited_time",
  "mixed_achievement",
  "preparation_load",
];
highTags.aiBoundaries = [
  "student_thinking_first",
  "fact_check_required",
  "copyright_review",
  "teacher_final_judgment",
];

export const FICTIONAL_PROFILES: TeacherContextProfile[] = [
  buildExample({
    schoolLevel: "kindergarten",
    role: "homeroom_teacher",
    profileTitle: "놀이를 관찰하고 확장하는 유치원 교사 컨텍스트",
    shortSummary:
      "유아의 선택과 충분한 놀이 시간을 존중하고, 관찰에 근거해 환경과 질문으로 놀이를 확장한다.",
    evidenceQuestionId: "kindergarten-play-intervention",
    moduleContent: {
      identity_and_role: {
        summary: "놀이 관찰과 일과 운영을 함께 맡는다.",
        claims: [
          "유아가 스스로 시도할 시간을 확보하고 필요한 순간에만 도움을 제공하는 것을 중요한 역할로 본다.",
        ],
      },
      educational_philosophy: {
        summary: "놀이 과정의 변화와 관계 형성을 성장으로 본다.",
        claims: [
          "완성된 결과보다 놀이가 이어지고 생각과 표현이 달라지는 과정을 중요하게 살핀다.",
        ],
      },
      preferred_teaching: {
        summary: "관찰 뒤 재료와 질문으로 놀이를 확장한다.",
        claims: [
          "교사가 놀이 방향을 정하기보다 유아의 관심을 관찰한 뒤 새로운 재료나 짧은 질문을 제안한다.",
        ],
      },
      class_context: {
        summary: "예측 가능한 전환 신호가 안정적인 참여를 돕는다.",
        claims: [
          "그림 순서표와 익숙한 노래로 활동 전환을 미리 알리면 일과 참여가 안정된다.",
        ],
      },
      participation_and_emotion: {
        summary: "말·몸짓·그림 등 여러 표현 방식을 인정한다.",
        claims: [
          "전체 앞에서 말하기 외에도 놀이, 몸짓, 그림으로 생각을 표현하고 친구와 공유할 수 있게 한다.",
        ],
      },
      materials_assessment_feedback: {
        summary: "관찰한 행동과 맥락을 사실 중심으로 기록한다.",
        claims: [
          "해석이나 평가보다 관찰한 행동과 상황을 짧게 기록하고 다음 환경 지원에 활용한다.",
        ],
      },
      environment_and_ai: {
        summary: "AI는 활동 초안을 돕지만 유아 판단에는 사용하지 않는다.",
        claims: [
          "AI에는 개인 정보를 입력하지 않으며, 놀이 재료 아이디어만 참고하고 최종 선택은 관찰에 근거해 직접 한다.",
        ],
      },
    },
    teachingDesignPrinciples: [
      "유아의 자발적 놀이를 먼저 충분히 관찰한다.",
      "놀이를 확장할 때 한 번에 하나의 재료나 질문을 제안한다.",
    ],
    classSupportConsiderations: [
      "활동 전환 전에 시각적·청각적 신호를 함께 제공한다.",
      "언어 외에도 몸짓과 그림을 정당한 참여 방식으로 인정한다.",
    ],
    realisticConstraints: [
      "놀이 흐름과 정해진 일과 시간을 함께 고려해야 한다.",
    ],
    aiCollaborationInstructions: [
      "유아 개인을 평가하거나 진단하지 말고 환경 지원 아이디어를 제안한다.",
      "짧고 안전하며 구하기 쉬운 재료를 우선 제안한다.",
    ],
    confirmedTags: kindergartenTags,
  }),
  buildExample({
    schoolLevel: "elementary",
    role: "homeroom_teacher",
    profileTitle: "질문과 작은 성공을 연결하는 초등 교사 컨텍스트",
    shortSummary:
      "질문과 실수가 환영받는 학급에서 짧은 안내, 단계별 과제, 다양한 참여 통로로 모든 학생의 시도를 지원한다.",
    evidenceQuestionId: "elementary-foundation-support",
    moduleContent: {
      identity_and_role: {
        summary: "학급문화와 교과 학습을 연결하는 담임 역할을 맡는다.",
        claims: [
          "학생이 비교의 부담 없이 질문하고 다시 시도할 수 있는 학급 문화를 중요하게 생각한다.",
        ],
      },
      educational_philosophy: {
        summary: "실수의 수정 과정에서 성장을 확인한다.",
        claims: [
          "처음 생각과 수정한 생각의 차이를 설명할 수 있을 때 의미 있는 학습이 일어났다고 본다.",
        ],
      },
      preferred_teaching: {
        summary: "짧은 안내 뒤 탐구·짝 대화·공유로 이어 간다.",
        claims: [
          "교사 설명은 핵심 질문과 활동 방법에 집중하고 학생이 직접 조작하고 말할 시간을 충분히 둔다.",
        ],
      },
      class_context: {
        summary: "방향이 보이는 모둠 활동과 단계별 안내가 효과적이다.",
        claims: [
          "설명이 길어질 때 집중이 흐트러질 수 있어 시각적 순서 안내와 짧은 과제 단위가 필요하다.",
          "수학 기초학습 지원이 필요한 학생이 일부 있어 구체물, 예시, 단계 카드가 도움이 된다.",
        ],
      },
      participation_and_emotion: {
        summary: "저위험 참여에서 공개 공유로 단계적으로 이동한다.",
        claims: [
          "발표가 부담스러운 학생에게 먼저 기록하거나 짝과 이야기한 뒤 공유 여부를 선택하게 한다.",
        ],
      },
      materials_assessment_feedback: {
        summary: "과정 관찰과 구체적인 다음 행동을 중심으로 피드백한다.",
        claims: [
          "정답 여부뿐 아니라 질문, 시도, 수정 과정을 살피고 다음에 바꿀 한 가지를 구체적으로 안내한다.",
        ],
      },
      environment_and_ai: {
        summary: "짧은 준비 시간과 제한된 공용 기기를 고려한다.",
        claims: [
          "AI는 수준별 발문과 활동지 초안을 만드는 데 활용하되 학생에 대한 판단과 최종 평가는 직접 한다.",
        ],
      },
    },
    teachingDesignPrinciples: [
      "핵심 목표는 공통으로 두고 도움의 형태와 도전 수준을 다양화한다.",
      "생각할 시간, 짝 대화, 전체 공유의 순서로 참여 부담을 낮춘다.",
    ],
    classSupportConsiderations: [
      "구체물과 단계별 안내를 선택할 수 있게 제공한다.",
      "집중과 활동 전환을 위해 시각적 순서 안내를 사용한다.",
    ],
    realisticConstraints: [
      "공용 기기 수가 제한적이므로 비디지털 대안을 함께 준비한다.",
      "자료 준비는 반복 사용할 수 있는 간단한 형식을 선호한다.",
    ],
    aiCollaborationInstructions: [
      "학생을 수준이나 특성으로 규정하지 말고 필요한 수업 지원을 서술한다.",
      "짧은 교사 안내와 학생 활동이 분명한 수업안을 제안한다.",
    ],
    confirmedTags: elementaryTags,
  }),
  buildExample({
    schoolLevel: "middle",
    role: "subject_teacher",
    profileTitle: "선택과 근거 있는 대화를 설계하는 중학교 교사 컨텍스트",
    shortSummary:
      "여러 학급에서 예측 가능한 수업 구조를 유지하며, 학생의 선택과 소규모 대화를 통해 참여 격차를 줄인다.",
    evidenceQuestionId: "middle-autonomy-participation",
    moduleContent: {
      identity_and_role: {
        summary: "여러 학급을 만나는 교과교사로서 일관된 루틴을 만든다.",
        claims: [
          "학급마다 관계의 속도는 다르지만 시작 질문, 목표 안내, 마무리 성찰은 일관되게 운영한다.",
        ],
      },
      educational_philosophy: {
        summary: "자기 생각의 근거를 설명하고 수정하는 과정을 중시한다.",
        claims: [
          "정답을 빠르게 찾는 것보다 자료를 근거로 설명하고 다른 관점에 따라 생각을 고치는 것을 성장으로 본다.",
        ],
      },
      preferred_teaching: {
        summary: "짧은 개념 안내와 자료 탐구, 대화를 결합한다.",
        claims: [
          "개념을 짧게 확인한 뒤 자료를 개인적으로 읽고 소규모 대화에서 근거를 비교하게 한다.",
        ],
      },
      class_context: {
        summary: "여러 학급의 참여 속도 차이를 수업 구조 안에서 조정한다.",
        claims: [
          "같은 목표를 유지하되 학급의 참여 속도에 따라 도움 자료와 대화 시간을 조정한다.",
        ],
      },
      participation_and_emotion: {
        summary: "주제와 표현 방식의 선택으로 자율성을 지원한다.",
        claims: [
          "공개 발표 전에 익명 질문, 기록, 짝 대화 중 하나를 선택할 수 있게 해 참여 진입점을 넓힌다.",
        ],
      },
      materials_assessment_feedback: {
        summary: "수행 결과와 함께 계획·수정 근거를 확인한다.",
        claims: [
          "수행평가에서는 결과물뿐 아니라 중간 점검과 수정 이유를 짧게 남기게 한다.",
        ],
      },
      environment_and_ai: {
        summary: "제한된 수업 시간에 바로 쓸 수 있는 자료를 선호한다.",
        claims: [
          "AI가 만든 자료는 사실과 출처를 확인하고, 사용 사실을 알린 뒤 교과 목표에 맞게 수정한다.",
        ],
      },
    },
    teachingDesignPrinciples: [
      "공통 목표 안에서 주제나 표현 방식의 선택지를 제공한다.",
      "주장에는 자료 근거를 요구하고 수정 이유를 말하게 한다.",
    ],
    classSupportConsiderations: [
      "공개 발표 전에 익명 또는 소규모 참여 통로를 제공한다.",
      "여러 학급에서 예측 가능한 시작과 마무리 루틴을 유지한다.",
    ],
    realisticConstraints: [
      "한 차시 안에서 활동과 정리를 마쳐야 한다.",
      "여러 학급의 자료와 피드백을 관리해야 한다.",
    ],
    aiCollaborationInstructions: [
      "자료의 출처와 사실 확인 지점을 함께 제시한다.",
      "학생이 먼저 생각할 수 있도록 완성 답안보다 단계별 발문을 만든다.",
    ],
    confirmedTags: middleTags,
  }),
  buildExample({
    schoolLevel: "high",
    role: "subject_teacher",
    profileTitle:
      "교과의 깊이와 실행 가능성을 함께 보는 고등학교 교사 컨텍스트",
    shortSummary:
      "핵심 개념의 정확성을 바탕으로 대표 쟁점을 깊게 탐구하고, 평가 부담 속에서도 학생의 판단과 수정을 보장한다.",
    evidenceQuestionId: "high-depth-pace",
    moduleContent: {
      identity_and_role: {
        summary: "교과의 깊이와 진도, 평가를 함께 책임진다.",
        claims: [
          "모든 내용을 같은 깊이로 다루기보다 핵심 개념과 대표 탐구 쟁점을 구분해 수업을 설계한다.",
        ],
      },
      educational_philosophy: {
        summary: "근거에 따라 판단하고 설명을 정교화하는 것을 성장으로 본다.",
        claims: [
          "학생이 자기 결론의 조건과 한계를 설명하고 피드백 후 근거를 보완할 때 성장이 드러난다고 본다.",
        ],
      },
      preferred_teaching: {
        summary: "개념 이해 뒤 자료 분석과 토론으로 깊이를 더한다.",
        claims: [
          "필수 개념은 명료하게 설명하고 대표 쟁점은 자료 분석, 질문, 토론으로 탐구한다.",
        ],
      },
      class_context: {
        summary: "준비도 차이에 따라 도움과 도전 수준을 선택하게 한다.",
        claims: [
          "공통 필수 과제와 선택 도전 과제를 구분하고 계획표와 중간 점검으로 자기 속도를 조절하게 한다.",
        ],
      },
      participation_and_emotion: {
        summary: "평가와 분리된 질문·수정 기회를 확보한다.",
        claims: [
          "정답 공개 전에 익명 질문과 초안 수정 기회를 제공해 평가 부담 속에서도 생각을 드러내게 한다.",
        ],
      },
      materials_assessment_feedback: {
        summary: "결론보다 추론 과정과 수정의 타당성을 함께 평가한다.",
        claims: [
          "최종 결과와 함께 자료 선택, 추론, 반론 검토, 수정 이유를 평가 증거로 본다.",
        ],
      },
      environment_and_ai: {
        summary: "AI는 자료 비교와 발문 초안을 돕되 판단을 대신하지 않는다.",
        claims: [
          "AI 산출물은 사실, 출처, 저작권, 편향을 검토하고 학생의 최종 판단과 교사의 평가는 대신하게 하지 않는다.",
        ],
      },
    },
    teachingDesignPrinciples: [
      "핵심 개념과 깊게 탐구할 대표 쟁점을 구분한다.",
      "주장, 자료, 추론, 반론, 수정의 흐름이 드러나는 과제를 설계한다.",
    ],
    classSupportConsiderations: [
      "공통 필수 과제와 선택 도전 과제를 함께 제공한다.",
      "평가와 무관한 질문 및 초안 수정 시간을 확보한다.",
    ],
    realisticConstraints: [
      "시험 범위와 진도 일정을 고려해야 한다.",
      "선택과목 안에서도 준비도 차이가 크며 자료 준비 시간이 제한적이다.",
    ],
    aiCollaborationInstructions: [
      "교과 개념의 사실성과 자료 출처를 명시하고 불확실성을 표시한다.",
      "완성 답안을 제공하기보다 학생의 판단을 촉진하는 자료와 발문을 제안한다.",
    ],
    confirmedTags: highTags,
  }),
];

export const FICTIONAL_PROFILE_BY_SCHOOL_LEVEL = Object.fromEntries(
  FICTIONAL_PROFILES.map((profile) => [profile.metadata.schoolLevel, profile]),
) as Record<SchoolLevel, TeacherContextProfile>;

// Keep the vocabulary import live so accidental changes to the example tag
// strings are caught both by TypeScript and the canonical schema.
void CONTROLLED_TAGS;
