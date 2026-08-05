import { z } from "zod";

import {
  machineIdentifierSchema,
  profileModuleIdSchema,
  schoolLevelSchema,
  type ProfileModuleId,
  type SchoolLevel,
} from "@/types/profile";

export const TEACHER_ROLES = [
  "homeroom_teacher",
  "subject_teacher",
  "special_education_teacher",
  "counselor",
  "school_nurse",
  "librarian",
  "administrator",
  "other",
] as const;

export const teacherRoleSchema = z.enum(TEACHER_ROLES);
export type TeacherRole = z.infer<typeof teacherRoleSchema>;

export const TEACHER_ROLE_LABELS: Record<TeacherRole, string> = {
  homeroom_teacher: "담임교사",
  subject_teacher: "교과전담 또는 교과교사",
  special_education_teacher: "특수교사",
  counselor: "상담교사",
  school_nurse: "보건교사",
  librarian: "사서교사",
  administrator: "관리자 또는 교육 리더",
  other: "기타",
};

export const questionSourceSchema = z.enum([
  "common",
  "school_level",
  "role",
  "follow_up",
]);
export type QuestionSource = z.infer<typeof questionSourceSchema>;

export const interviewQuestionSchema = z
  .object({
    id: machineIdentifierSchema,
    moduleId: profileModuleIdSchema,
    source: questionSourceSchema,
    prompt: z.string().trim().min(1),
    intent: z.string().trim().min(1),
    example: z.string().trim().min(1),
    privacyHint: z.string().trim().min(1),
    required: z.boolean().default(false),
    schoolLevels: z.array(schoolLevelSchema).optional(),
    roles: z.array(teacherRoleSchema).optional(),
  })
  .strict();
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;

export const answerDispositionSchema = z.enum([
  "answered",
  "skipped",
  "unsure",
]);
export type AnswerDisposition = z.infer<typeof answerDispositionSchema>;

/**
 * Runtime-only response. This value must never be written to Web Storage,
 * Supabase, logs, analytics, or cookies.
 */
export type InterviewAnswer = {
  questionId: string;
  disposition: AnswerDisposition;
  text: string;
};

export const followUpQuestionSchema = interviewQuestionSchema.extend({
  source: z.literal("follow_up"),
  basedOnQuestionId: machineIdentifierSchema,
});
export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>;

export type InterviewState = {
  version: "1.0";
  schoolLevel: SchoolLevel;
  role: TeacherRole;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  /** In-memory only. Storage serializers intentionally discard this map. */
  answers: Record<string, InterviewAnswer>;
  followUps: FollowUpQuestion[];
  followUpCount: number;
  privacyNoticeAccepted: boolean;
  startedAt: string;
  updatedAt: string;
};

export const MAX_INTERVIEW_ANSWER_LENGTH = 2_000;
export const MAX_FOLLOW_UPS = 4;

export type InterviewProgress = {
  current: number;
  total: number;
  percent: number;
  moduleId: ProfileModuleId;
  moduleCurrent: number;
  moduleTotal: number;
};
