import { z } from 'zod';

export const CreateBillingPortalSessionSchema = z.object({
  returnUrl: z.string().url(),
  customerId: z.string().min(1),
  /**
   * Stripe Customer Portal deep-link. Ozer recovery uses payment_method_update.
   * Ignored by non-Stripe gateways.
   */
  flowData: z
    .object({
      type: z.enum(['payment_method_update']),
    })
    .optional(),
});
