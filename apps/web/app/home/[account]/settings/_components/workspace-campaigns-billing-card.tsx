'use client';

import { CampaignsBillingCard } from '~/components/billing/campaigns-billing-card';
import { createTeamAccountCheckoutSession } from '~/home/[account]/billing/_lib/server/server-actions';

export function WorkspaceCampaignsBillingCard(props: {
  accountId: string;
  accountSlug: string;
  canManageBilling: boolean;
}) {
  return (
    <CampaignsBillingCard
      accountId={props.accountId}
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
