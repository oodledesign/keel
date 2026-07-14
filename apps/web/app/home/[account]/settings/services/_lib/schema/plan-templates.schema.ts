import { z } from 'zod';

export const PlanTemplateKindSchema = z.enum([
  'hosting',
  'retainer',
  'care_plan',
  'custom',
]);

export const PlanBillingIntervalSchema = z.enum(['month', 'year']);

export const UpsertPlanTemplateSchema = z.object({
  accountId: z.string().uuid(),
  id: z.string().uuid().optional(),
  kind: PlanTemplateKindSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  amount: z.number().int().min(0).max(10_000_000),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toLowerCase())
    .default('gbp'),
  interval: PlanBillingIntervalSchema.default('month'),
  active: z.boolean().default(true),
});

export const ListPlanTemplatesSchema = z.object({
  accountId: z.string().uuid(),
  kind: PlanTemplateKindSchema.optional(),
  activeOnly: z.boolean().optional(),
});

export const DeletePlanTemplateSchema = z.object({
  accountId: z.string().uuid(),
  id: z.string().uuid(),
});

export const AttachHostingPlanSchema = z.object({
  accountId: z.string().uuid(),
  websiteId: z.string().uuid(),
  planTemplateId: z.string().uuid().optional(),
  /** Inline create when attaching without a pre-existing template */
  newTemplate: UpsertPlanTemplateSchema.omit({
    accountId: true,
    id: true,
  }).optional(),
});

export const AttachRetainerPlanSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  planTemplateId: z.string().uuid().optional(),
  newTemplate: UpsertPlanTemplateSchema.omit({
    accountId: true,
    id: true,
  }).optional(),
});

export const CancelClientSubscriptionSchema = z.object({
  accountId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
});

export const ListClientSubscriptionsSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  websiteId: z.string().uuid().optional(),
});

export const ResendClientSubscriptionPaymentLinkSchema = z.object({
  accountId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
});

export type UpsertPlanTemplateInput = z.infer<typeof UpsertPlanTemplateSchema>;
export type AttachHostingPlanInput = z.infer<typeof AttachHostingPlanSchema>;
export type AttachRetainerPlanInput = z.infer<typeof AttachRetainerPlanSchema>;
