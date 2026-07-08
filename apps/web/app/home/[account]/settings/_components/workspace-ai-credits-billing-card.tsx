'use client';

import { AiCreditsBillingCard } from '~/components/billing/ai-credits-billing-card';

import { createTeamAccountCheckoutSession } from '~/home/[account]/billing/_lib/server/server-actions';

export function WorkspaceAiCreditsBillingCard(props: {
  accountId: string;
  accountSlug: string;
  canManageBilling: boolean;
}) {
  return (
    <AiCreditsBillingCard
      accountId={props.accountId}
      mode="workspace"
      accountSlug={props.accountSlug}
      canManageBilling={props.canManageBilling}
      createCheckout={async ({ productId, planId }) =>
        createTeamAccountCheckoutSession({
          accountId: props.accountId,
          slug: props.accountSlug,
          productId,
          planId,
        })
      }
    />
  );
}
