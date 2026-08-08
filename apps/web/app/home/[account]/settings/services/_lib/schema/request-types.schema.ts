import { z } from 'zod';

export const UpsertRequestTypeSchema = z.object({
  accountId: z.string().uuid(),
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(120),
  creditCost: z.number().int().min(0).max(1_000_000).default(0),
  isBillable: z.boolean().default(true),
  isSupport: z.boolean().default(false),
  categoryGroup: z.string().trim().max(80).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

export const DeleteRequestTypeSchema = z.object({
  accountId: z.string().uuid(),
  id: z.string().uuid(),
});

export const ReorderRequestTypesSchema = z.object({
  accountId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
});

export const ListRequestTypesSchema = z.object({
  accountId: z.string().uuid(),
  activeOnly: z.boolean().optional(),
});

export type UpsertRequestTypeInput = z.infer<typeof UpsertRequestTypeSchema>;
