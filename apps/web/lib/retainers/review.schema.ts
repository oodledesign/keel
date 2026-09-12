import { z } from 'zod';

export const ApplyRetainerMatchSchema = z.object({
  suggestionId: z.string().uuid(),
  accountSlug: z.string().optional(),
  serviceId: z.string().uuid().nullable().optional(),
  addServiceToProject: z.boolean().optional(),
});

export const SkipRetainerMatchSchema = z.object({
  suggestionId: z.string().uuid(),
  accountSlug: z.string().optional(),
});

export const AddProposedRetainerServiceSchema = z.object({
  suggestionId: z.string().uuid(),
  accountSlug: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  creditCost: z.number().int().min(1).max(1_000_000),
  applyAfter: z.boolean().default(true),
});
