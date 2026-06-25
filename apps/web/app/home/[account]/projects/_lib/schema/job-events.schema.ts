import { z } from 'zod';

const optionalString = z.string().optional();
const optionalNullableString = z.string().nullable().optional();
const optionalNullableDate = z
  .union([z.coerce.date(), z.string().datetime(), z.null()])
  .optional();

const eventType = z.enum(['site_visit', 'meeting']);

// --- List job events (returns { upcoming, previous }) ---
export const ListJobEventsSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
});

// --- Get single event ---
export const GetJobEventSchema = z.object({
  accountId: z.string().uuid(),
  eventId: z.string().uuid(),
});

// --- Create event (Owner/Admin/Staff only) ---
export const CreateJobEventSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1, 'Title is required'),
  event_type: eventType,
  scheduled_start_at: z.coerce.date(),
  scheduled_end_at: optionalNullableDate,
  location: optionalString,
  prep_notes: optionalString,
  outcome_notes: optionalString,
  follow_up_required: z.boolean().optional().default(false),
  follow_up_at: optionalNullableDate,
});

// --- Update event (Staff full; Contractor notes-only enforced in service) ---
export const UpdateJobEventSchema = z.object({
  accountId: z.string().uuid(),
  eventId: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).optional(),
  event_type: eventType.optional(),
  scheduled_start_at: optionalNullableDate,
  scheduled_end_at: optionalNullableDate,
  location: optionalNullableString,
  prep_notes: optionalNullableString,
  outcome_notes: optionalNullableString,
  follow_up_required: z.boolean().optional(),
  follow_up_at: optionalNullableDate,
});

// --- Delete event (Owner/Admin/Staff only) ---
export const DeleteJobEventSchema = z.object({
  accountId: z.string().uuid(),
  eventId: z.string().uuid(),
});

// --- Event assignments ---
export const ListJobEventAssignmentsSchema = z.object({
  accountId: z.string().uuid(),
  eventId: z.string().uuid(),
});

// --- All event assignments for a job (for list view) ---
export const ListJobEventAssignmentsForJobSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export const AddJobEventAssignmentSchema = z.object({
  accountId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
  role_on_event: optionalString,
});

export const RemoveJobEventAssignmentSchema = z.object({
  accountId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
});

// --- Replace all assignments for an event (used on Save) ---
export const SetJobEventAssignmentsSchema = z.object({
  accountId: z.string().uuid(),
  eventId: z.string().uuid(),
  assignments: z.array(
    z.object({
      userId: z.string().uuid(),
      role_on_event: optionalString,
    }),
  ),
});

export type ListJobEventsInput = z.infer<typeof ListJobEventsSchema>;
export type GetJobEventInput = z.infer<typeof GetJobEventSchema>;
export type CreateJobEventInput = z.infer<typeof CreateJobEventSchema>;
export type UpdateJobEventInput = z.infer<typeof UpdateJobEventSchema>;
export type DeleteJobEventInput = z.infer<typeof DeleteJobEventSchema>;
export type ListJobEventAssignmentsInput = z.infer<typeof ListJobEventAssignmentsSchema>;
export type ListJobEventAssignmentsForJobInput = z.infer<typeof ListJobEventAssignmentsForJobSchema>;
export type AddJobEventAssignmentInput = z.infer<typeof AddJobEventAssignmentSchema>;
export type RemoveJobEventAssignmentInput = z.infer<typeof RemoveJobEventAssignmentSchema>;
export type SetJobEventAssignmentsInput = z.infer<typeof SetJobEventAssignmentsSchema>;
