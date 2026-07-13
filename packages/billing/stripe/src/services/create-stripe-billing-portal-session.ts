import type { Stripe } from 'stripe';
import { z } from 'zod';

import type { CreateBillingPortalSessionSchema } from '@kit/billing/schema';

/**
 * @name createStripeBillingPortalSession
 * @description Create a Stripe billing portal session for a user
 */
export async function createStripeBillingPortalSession(
  stripe: Stripe,
  params: z.infer<typeof CreateBillingPortalSessionSchema>,
) {
  const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
    customer: params.customerId,
    return_url: params.returnUrl,
  };

  if (params.flowData?.type === 'payment_method_update') {
    sessionParams.flow_data = {
      type: 'payment_method_update',
    };
  }

  return stripe.billingPortal.sessions.create(sessionParams);
}
