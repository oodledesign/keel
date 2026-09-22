import { z } from 'zod';

import { BOARD_NOTIFY_STATUSES } from '~/lib/commercial/board-company-settings';

const AccountListingSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
});

export const PrepareBoardNotifySchema = AccountListingSchema.extend({
  status: z.enum(BOARD_NOTIFY_STATUSES),
  accountSlug: z.string().min(1).max(100).optional(),
});

export const SendBoardNotifySchema = AccountListingSchema.extend({
  status: z.enum(BOARD_NOTIFY_STATUSES),
  to: z
    .array(z.string().trim().email('Enter a valid email'))
    .min(1, 'Add at least one recipient')
    .max(20),
  cc: z.string().trim().max(1000).optional().default(''),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(8000),
});

export const SkipBoardNotifySchema = AccountListingSchema.extend({
  status: z.enum(BOARD_NOTIFY_STATUSES),
});
