import { z } from 'zod';

export const LoadProjectRetainerSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const UpdateProjectRetainerSettingsSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
  autoMatchEnabled: z.boolean().optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  allowedServiceIds: z.array(z.string().uuid()).max(200).optional(),
});

export const AdjustProjectRetainerBalanceSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
  delta: z.number().int().min(-1_000_000).max(1_000_000),
  reason: z.string().trim().max(200).optional(),
});

export const UndoTaskRetainerBurnSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  taskId: z.string().uuid(),
});
