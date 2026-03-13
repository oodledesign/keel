import { z } from 'zod';

const jobStatus = z.enum([
  'pending',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
]);
const jobPriority = z.enum(['low', 'medium', 'high', 'urgent']);

const optionalString = z.string().optional();
const optionalNullableString = z.string().nullable().optional();
const optionalInt = z.number().int().optional();
const optionalNullableInt = z.number().int().nullable().optional();
const optionalDate = z.coerce.date().optional();
const optionalNullableDate = z
  .union([z.coerce.date(), z.null()])
  .optional();

// --- List jobs ---
export const ListJobsSchema = z.object({
  accountId: z.string().uuid(),
  tab: z.enum(['active', 'completed']),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  query: z.string().optional(),
  status: jobStatus.optional(),
  priority: jobPriority.optional(),
});

// --- Get job ---
export const GetJobSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
});

// --- Create job (Owner/Admin/Staff only) ---
export const CreateJobSchema = z.object({
  accountId: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  description: optionalString,
  status: jobStatus.optional().default('pending'),
  priority: jobPriority.optional().default('medium'),
  start_date: optionalDate,
  due_date: optionalDate,
  estimated_minutes: optionalInt,
  actual_minutes: optionalInt,
  value_pence: optionalInt,
  cost_pence: optionalInt,
});

// --- Update job (Staff full; Contractor status + actual_minutes only) ---
export const UpdateJobSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).optional(),
  description: optionalNullableString,
  status: jobStatus.optional(),
  priority: jobPriority.optional(),
  start_date: optionalNullableDate,
  due_date: optionalNullableDate,
  estimated_minutes: optionalNullableInt,
  actual_minutes: optionalNullableInt,
  value_pence: optionalNullableInt,
  cost_pence: optionalNullableInt,
});

// --- Delete job (Owner/Admin only) ---
export const DeleteJobSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
});

// --- Account members (for assignment dropdown) ---
export const ListAccountMembersSchema = z.object({
  accountSlug: z.string().min(1),
});

// --- Assignments ---
export const ListJobAssignmentsSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export const AddJobAssignmentSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
  userId: z.string().uuid(),
  role_on_job: optionalString,
});

export const RemoveJobAssignmentSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
  userId: z.string().uuid(),
});

// --- Notes ---
export const ListJobNotesSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export const AddJobNoteSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
  note: z.string().min(1, 'Note cannot be empty'),
});

export const DeleteJobNoteSchema = z.object({
  accountId: z.string().uuid(),
  noteId: z.string().uuid(),
});

export type ListJobsInput = z.infer<typeof ListJobsSchema>;
export type GetJobInput = z.infer<typeof GetJobSchema>;
export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
export type DeleteJobInput = z.infer<typeof DeleteJobSchema>;
export type ListJobAssignmentsInput = z.infer<typeof ListJobAssignmentsSchema>;
export type AddJobAssignmentInput = z.infer<typeof AddJobAssignmentSchema>;
export type RemoveJobAssignmentInput = z.infer<typeof RemoveJobAssignmentSchema>;
export type ListJobNotesInput = z.infer<typeof ListJobNotesSchema>;
export type AddJobNoteInput = z.infer<typeof AddJobNoteSchema>;
export type DeleteJobNoteInput = z.infer<typeof DeleteJobNoteSchema>;
