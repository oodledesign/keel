'use client';

import { AiCreditsBillingCard } from '~/components/billing/ai-credits-billing-card';

import { createPersonalAccountCheckoutSession } from '../_lib/server/server-actions';

export function PersonalAiCreditsBillingCard(props: { accountId: string }) {
  return (
    <AiCreditsBillingCard
      accountId={props.accountId}
      mode="personal"
      createCheckout={async ({ productId, planId }) =>
        createPersonalAccountCheckoutSession({ productId, planId })
      }
    />
  );
}
