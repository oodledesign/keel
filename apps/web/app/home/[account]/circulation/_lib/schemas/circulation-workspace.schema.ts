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
