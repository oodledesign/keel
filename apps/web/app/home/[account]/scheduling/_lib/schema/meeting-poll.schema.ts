import { z } from 'zod';

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date');

const slotInputSchema = z.object({
  startAtIso: z.string().datetime({ offset: true }),
  source: z.enum(['suggested', 'manual']),
});

const inviteeInputSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(120).optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
});

export const SuggestMeetingPollSlotsSchema = z
  .object({
    accountId: z.string().uuid(),
    accountSlug: z.string().min(1),
    timezone: z.string().min(1).max(100),
    durationMinutes: z.number().int().min(5).max(480),
    rangeStartYmd: ymdSchema,
    rangeEndYmd: ymdSchema,
  })
  .refine((value) => value.rangeEndYmd >= value.rangeStartYmd, {
    message: 'The end date must be on or after the start date',
    path: ['rangeEndYmd'],
  });

export const ResolveManualPollSlotSchema = z.object({
  accountId: z.string().uuid(),
  timezone: z.string().min(1).max(100),
  dateYmd: ymdSchema,
  timeHm: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm'),
  durationMinutes: z.number().int().min(5).max(480),
});

export const SaveMeetingPollSchema = z
  .object({
    accountId: z.string().uuid(),
    accountSlug: z.string().min(1),
    pollId: z.string().uuid().optional(),
    title: z.string().trim().min(1, 'Title is required').max(160),
    description: z.string().max(2000).optional().nullable(),
    location: z.string().max(500).optional().nullable(),
    durationMinutes: z.number().int().min(5).max(480),
    rangeStartYmd: ymdSchema,
    rangeEndYmd: ymdSchema,
    timezone: z.string().min(1).max(100),
    showVoterNames: z.boolean(),
    clientId: z.string().uuid().optional().nullable(),
    projectId: z.string().uuid().optional().nullable(),
    slots: z.array(slotInputSchema).max(20),
    invitees: z.array(inviteeInputSchema).max(50),
    send: z.boolean(),
  })
  .refine((value) => value.rangeEndYmd >= value.rangeStartYmd, {
    message: 'The end date must be on or after the start date',
    path: ['rangeEndYmd'],
  })
  .superRefine((value, ctx) => {
    if (value.slots.length < 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add at least one time',
        path: ['slots'],
      });
    }
    if (value.send && value.invitees.length < 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Add at least one invitee before sending',
        path: ['invitees'],
      });
    }
  });

export const MeetingPollIdSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  pollId: z.string().uuid(),
});

export const ConfirmMeetingPollSchema = MeetingPollIdSchema.extend({
  slotId: z.string().uuid(),
  acknowledgeConflict: z.boolean().default(false),
});

export const PreviewMeetingPollSlotSchema = MeetingPollIdSchema.extend({
  slotId: z.string().uuid(),
});
