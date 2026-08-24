import { z } from 'zod';

import { PlanSchema } from '../create-billing-schema';

export const CreateBillingCheckoutSchema = z.object({
  returnUrl: z.string().url(),
  accountId: z.string().uuid(),
  plan: PlanSchema,
  customerId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  enableDiscountField: z.boolean().optional(),
  variantQuantities: z.array(
    z.object({
      variantId: z.string().min(1),
      quantity: z.number(),
    }),
  ),
  metadata: z.record(z.string()).optional(),
  /** Stripe coupon id for referral discount (mutually exclusive with promotion codes). */
  referralDiscountCouponId: z.string().optional(),
});
