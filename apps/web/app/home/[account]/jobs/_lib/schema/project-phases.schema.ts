import { z } from 'zod';

export const PhaseStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'blocked',
  'complete',
]);

export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

const optionalString = z.string().optional();
const optionalNullableString = z.string().nullable().optional();
const optionalDate = z.coerce.date().optional();
const optionalNullableDate = z.union([z.coerce.date(), z.null()]).optional();
const optionalNullableInt = z.number().int().nullable().optional();

const accountJobFields = {
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
};

const accountJobSlugFields = {
  ...accountJobFields,
  accountSlug: z.string().min(1),
};

export const CreatePhaseSchema = z.object({
  ...accountJobSlugFields,
  name: z.string().min(1, 'Phase name is required').max(200),
  description: optionalString,
  status: PhaseStatusSchema.optional().default('not_started'),
  is_milestone: z.boolean().optional().default(false),
  colour: optionalNullableString,
  start_date: optionalDate,
  due_date: optionalDate,
});

export const UpdatePhaseSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  jobId: z.string().uuid(),
  phaseId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: optionalNullableString,
  status: PhaseStatusSchema.optional(),
  is_milestone: z.boolean().optional(),
  colour: optionalNullableString,
  start_date: optionalNullableDate,
  due_date: optionalNullableDate,
});

export const DeletePhaseSchema = z.object({
  ...accountJobSlugFields,
  phaseId: z.string().uuid(),
});

export const ReorderPhasesSchema = z.object({
  ...accountJobSlugFields,
  orderedPhaseIds: z.array(z.string().uuid()).min(1),
});

export const ListPhasesForJobSchema = z.object({
  ...accountJobFields,
});

export const MoveTaskSchema = z.object({
  ...accountJobSlugFields,
  taskId: z.string().uuid(),
  phaseId: z.string().uuid().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const ListJobBoardSchema = z.object({
  ...accountJobFields,
  accountSlug: z.string().min(1),
});

export const EnsurePhasePageSchema = z.object({
  accountId: z.string().uuid(),
  phaseId: z.string().uuid(),
});

export const GetPhaseDetailSchema = z.object({
  accountId: z.string().uuid(),
  phaseId: z.string().uuid(),
});

const taskPriority = z.enum(['low', 'medium', 'high', 'urgent']);
const taskStatus = z.enum([
  'todo',
  'in_progress',
  'client_review',
  'done',
  'cancelled',
]);

export const CreateJobTaskSchema = z.object({
  ...accountJobSlugFields,
  phaseId: z.string().uuid().nullable(),
  title: z.string().min(1).max(500),
  priority: taskPriority.optional().default('medium'),
  assigneeUserId: z.string().uuid().optional(),
  dueDate: optionalNullableDate,
  sortOrder: z.number().int().min(0).optional(),
});

export const UpdateJobTaskSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  jobId: z.string().uuid(),
  taskId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueDate: optionalNullableDate,
});

export const SavePhasePageDocSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  jobId: z.string().uuid(),
  phaseId: z.string().uuid(),
  docId: z.string().uuid(),
  title: z.string().max(500).optional(),
  content: z.string(),
});

export const AddPhaseNoteSchema = z.object({
  ...accountJobSlugFields,
  phaseId: z.string().uuid(),
  content: z.string().min(1),
  title: z.string().max(500).optional(),
});

export const UpdatePhaseNoteSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  jobId: z.string().uuid(),
  phaseId: z.string().uuid(),
  noteId: z.string().uuid(),
  title: z.string().max(500).optional(),
  content: z.string().optional(),
  isPinned: z.boolean().optional(),
});

const PhaseTemplatePhaseSchema = z.object({
  name: z.string().min(1).max(200),
  colour: z.string().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  is_milestone: z.boolean().optional(),
});

export const ListPhaseTemplatesSchema = z.object({
  accountId: z.string().uuid(),
});

export const ApplyPhaseTemplateSchema = z.object({
  ...accountJobSlugFields,
  templateId: z.string().uuid(),
});

export type PhaseTemplatePhase = z.infer<typeof PhaseTemplatePhaseSchema>;

export type CreatePhaseInput = z.infer<typeof CreatePhaseSchema>;
export type UpdatePhaseInput = z.infer<typeof UpdatePhaseSchema>;
export type DeletePhaseInput = z.infer<typeof DeletePhaseSchema>;
export type ReorderPhasesInput = z.infer<typeof ReorderPhasesSchema>;
export type ListPhasesForJobInput = z.infer<typeof ListPhasesForJobSchema>;
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>;
export type ListJobBoardInput = z.infer<typeof ListJobBoardSchema>;
export type EnsurePhasePageInput = z.infer<typeof EnsurePhasePageSchema>;
export type GetPhaseDetailInput = z.infer<typeof GetPhaseDetailSchema>;
export type CreateJobTaskInput = z.infer<typeof CreateJobTaskSchema>;
export type UpdateJobTaskInput = z.infer<typeof UpdateJobTaskSchema>;
export type SavePhasePageDocInput = z.infer<typeof SavePhasePageDocSchema>;
export type AddPhaseNoteInput = z.infer<typeof AddPhaseNoteSchema>;
export type UpdatePhaseNoteInput = z.infer<typeof UpdatePhaseNoteSchema>;
export type ListPhaseTemplatesInput = z.infer<typeof ListPhaseTemplatesSchema>;
export type ApplyPhaseTemplateInput = z.infer<typeof ApplyPhaseTemplateSchema>;

export type PhaseTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  phaseCount: number;
};

export type TaskStatusCount = {
  todo: number;
  in_progress: number;
  client_review: number;
  done: number;
  cancelled: number;
};

export type PhaseListItem = {
  id: string;
  account_id: string;
  job_id: string;
  name: string;
  description: string | null;
  status: PhaseStatus;
  is_milestone: boolean;
  colour: string | null;
  sort_order: number;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  taskCountsByStatus: TaskStatusCount;
  progressPct: number;
  pageDocId: string | null;
  noteCount: number;
};

export type JobBoardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  sort_order: number | null;
  phase_id: string | null;
  job_id: string | null;
  user_id: string | null;
};

export type JobBoardAssignee = {
  user_id: string;
  role_on_job: string | null;
  name: string | null;
  email: string | null;
  picture_url: string | null;
};

export type JobBoardResult = {
  job: Record<string, unknown>;
  client: Record<string, unknown> | null;
  assignees: JobBoardAssignee[];
  phases: PhaseListItem[];
  tasksByPhase: Record<string, JobBoardTask[]>;
  valuePence: number | null;
  costPence: number | null;
  progressPct: number;
};
