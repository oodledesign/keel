'use client';

import { CampaignsBillingCard } from '~/components/billing/campaigns-billing-card';
import { createTeamAccountCheckoutSession } from '~/home/[account]/billing/_lib/server/server-actions';
import type { CampaignCreditPool } from '~/lib/campaigns/campaign.types';

export function WorkspaceCampaignsBillingCard(props: {
  accountId: string;
  accountSlug: string;
  canManageBilling: boolean;
  subscriberCount: number;
  usage: CampaignCreditPool;
}) {
  return (
    <CampaignsBillingCard
      accountId={props.accountId}
      accountSlug={props.accountSlug}
      canManageBilling={props.canManageBilling}
      subscriberCount={props.subscriberCount}
      usage={props.usage}
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
