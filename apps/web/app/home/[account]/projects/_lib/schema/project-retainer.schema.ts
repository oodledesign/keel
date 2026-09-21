import { z } from 'zod';

export const LoadProjectRetainerSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
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

const ServiceDraftSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  creditCost: z.number().int().min(1).max(1_000_000),
  requestTypeId: z.string().uuid().nullable().optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
});

export const ReplaceProjectRetainerServicesSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
  services: z.array(ServiceDraftSchema).max(200),
});

export const ResetProjectRetainerServicesSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
});

export const AddCustomProjectRetainerServiceSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  creditCost: z.number().int().min(1).max(1_000_000),
  requestTypeId: z.string().uuid().nullable().optional(),
});
