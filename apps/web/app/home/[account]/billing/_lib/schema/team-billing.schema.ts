import { z } from 'zod';

export const TeamBillingPortalSchema = z.object({
  accountId: z.string().uuid(),
  slug: z.string().min(1),
  /** Deep-link Customer Portal to update card (payment recovery v1). */
  intent: z.enum(['manage', 'recover']).optional().default('manage'),
});

export const TeamCheckoutSchema = z.object({
  slug: z.string().min(1),
  productId: z.string().min(1),
  planId: z.string().min(1),
  accountId: z.string().uuid(),
});
