import { z } from 'zod';

export const FetchSlotsSchema = z.object({
  pageSlug: z.string().min(1).max(64),
  eventSlug: z.string().min(1).max(64),
  durationMinutes: z.number().int().min(5).max(480),
  inviteeTimezone: z.string().min(1).max(100),
  /** Inclusive local week start (YYYY-MM-DD) in invitee timezone for UI; server expands to UTC range */
  rangeStartIso: z.string().datetime({ offset: true }),
  rangeEndIso: z.string().datetime({ offset: true }),
  /** When rescheduling, exclude this booking from conflict checks */
  excludeManagementToken: z.string().uuid().optional(),
});

export const FormResponseInputSchema = z.object({
  formFieldId: z.string().uuid(),
  value: z.unknown().optional(),
});

export const GuestInputSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  email: z.string().email(),
});

export const CreatePublicBookingSchema = z.object({
  pageSlug: z.string().min(1).max(64),
  eventSlug: z.string().min(1).max(64),
  durationMinutes: z.number().int().min(5).max(480),
  startAtIso: z.string().datetime({ offset: true }),
  inviteeName: z.string().min(1).max(120),
  inviteeEmail: z.string().email(),
  inviteeTimezone: z.string().min(1).max(100),
  guests: z.array(GuestInputSchema).max(10).default([]),
  formResponses: z.array(FormResponseInputSchema).default([]),
  inviteeNotes: z.string().max(2000).nullable().optional(),
});

export const CancelPublicBookingSchema = z.object({
  managementToken: z.string().uuid(),
  cancellationReason: z.string().max(1000).nullable().optional(),
});

export const ReschedulePublicBookingSchema = z.object({
  managementToken: z.string().uuid(),
  durationMinutes: z.number().int().min(5).max(480),
  startAtIso: z.string().datetime({ offset: true }),
  inviteeTimezone: z.string().min(1).max(100),
});

export type CreatePublicBookingInput = z.infer<typeof CreatePublicBookingSchema>;
export type FetchSlotsInput = z.infer<typeof FetchSlotsSchema>;
