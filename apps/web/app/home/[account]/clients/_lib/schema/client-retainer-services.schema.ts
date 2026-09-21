import { z } from 'zod';

const ServiceDraftSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  creditCost: z.number().int().min(1).max(1_000_000),
  requestTypeId: z.string().uuid().nullable().optional(),
  isActive: z.boolean(),
  isVisible: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
});

export const LoadClientRetainerServicesSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const ReplaceClientRetainerServicesSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  services: z.array(ServiceDraftSchema).max(200),
});

export const ResetClientRetainerServicesSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const AddCustomClientRetainerServiceSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  creditCost: z.number().int().min(1).max(1_000_000),
  requestTypeId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  isVisible: z.boolean().optional(),
});

export type ReplaceClientRetainerServicesInput = z.infer<
  typeof ReplaceClientRetainerServicesSchema
>;
