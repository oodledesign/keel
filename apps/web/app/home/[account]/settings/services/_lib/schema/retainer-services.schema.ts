import { z } from 'zod';

import { TASK_STATUS_VALUES } from '~/lib/retainers/constants';

export const UpsertRetainerServiceSchema = z.object({
  accountId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  creditCost: z.number().int().min(1).max(1_000_000),
  defaultStatus: z.enum(TASK_STATUS_VALUES).nullable().optional(),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
  defaultDurationMinutes: z
    .number()
    .int()
    .min(1)
    .max(10080)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
  isVisible: z.boolean().default(true),
  categoryId: z.string().uuid().nullable().optional(),
  requestTypeId: z.string().uuid().nullable().optional(),
});

export const PatchRetainerServiceSchema = z.object({
  accountId: z.string().uuid(),
  id: z.string().uuid(),
  isVisible: z.boolean().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const UpsertRetainerServiceCategorySchema = z.object({
  accountId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const DeleteRetainerServiceCategorySchema = z.object({
  accountId: z.string().uuid(),
  id: z.string().uuid(),
});

export const ReorderRetainerServiceCategoriesSchema = z.object({
  accountId: z.string().uuid(),
  ids: z.array(z.string().uuid()).max(100),
});

export const ListRetainerServiceCategoriesSchema = z.object({
  accountId: z.string().uuid(),
});

export const SeedDefaultRetainerServicesSchema = z.object({
  accountId: z.string().uuid(),
});

export const DeleteRetainerServiceSchema = z.object({
  accountId: z.string().uuid(),
  id: z.string().uuid(),
});

export const ListRetainerServicesSchema = z.object({
  accountId: z.string().uuid(),
  activeOnly: z.boolean().optional(),
});

export type UpsertRetainerServiceInput = z.infer<
  typeof UpsertRetainerServiceSchema
>;
export type PatchRetainerServiceInput = z.infer<
  typeof PatchRetainerServiceSchema
>;
export type UpsertRetainerServiceCategoryInput = z.infer<
  typeof UpsertRetainerServiceCategorySchema
>;
