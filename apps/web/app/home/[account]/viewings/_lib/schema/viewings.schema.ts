import { z } from 'zod';

import { VIEWING_STATUSES } from '~/lib/commercial/commercial-constants';

export const ListViewingsSchema = z.object({
  accountId: z.string().uuid(),
});

export const CreateViewingSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  enquiryId: z.string().uuid().optional().nullable(),
  requirementId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  feedback: z.string().optional().nullable(),
  status: z.enum(VIEWING_STATUSES).default('upcoming'),
});

export const UpdateViewingSchema = CreateViewingSchema.omit({
  accountId: true,
  listingId: true,
})
  .partial()
  .extend({
    viewingId: z.string().uuid(),
    accountId: z.string().uuid(),
    listingId: z.string().uuid().optional(),
  });

export const DeleteViewingSchema = z.object({
  viewingId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export type CreateViewingInput = z.infer<typeof CreateViewingSchema>;
export type UpdateViewingInput = z.infer<typeof UpdateViewingSchema>;
