import { z } from 'zod';

export const UpdateSubscriptionParamsSchema = z.object({
  subscriptionId: z.string().min(1),
  subscriptionItemId: z.string().min(1),
  quantity: z.number().min(1),
  /**
   * Upgrade: charge now and restart the billing cycle.
   * Downgrade at period end: schedule quantity via Stripe subscription schedule.
   */
  timing: z.enum(['immediate', 'period_end']).optional().default('immediate'),
  /** When timing is immediate and true, reset billing_cycle_anchor to now. */
  restartBillingCycle: z.boolean().optional().default(false),
});
