import { z } from 'zod';

export const CirculationAutoSendSchema = z.object({
  accountId: z.string().uuid(),
  enabled: z.boolean(),
});

export const CirculationContactAutoSendSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
  enabled: z.boolean(),
});

export const CirculationRunSchema = z.object({
  accountId: z.string().uuid(),
  dryRun: z.boolean().optional(),
});

export const CirculationMinGapSchema = z.object({
  accountId: z.string().uuid(),
  minGapDays: z.number().int().min(0).max(60),
});

export const CirculationRematchSchema = z
  .object({
    accountId: z.string().uuid(),
    onPriceDrop: z.boolean().optional(),
    onRelist: z.boolean().optional(),
  })
  .refine(
    (value) => value.onPriceDrop !== undefined || value.onRelist !== undefined,
    {
      message: 'Choose a setting to change',
    },
  );

export const CirculationDismissUnsubscribeReviewSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
});
