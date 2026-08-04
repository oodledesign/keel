'use client';

import { MediaUnitsBillingCard } from '~/components/billing/media-units-billing-card';
import { createTeamAccountCheckoutSession } from '~/home/[account]/billing/_lib/server/server-actions';

export function WorkspaceMediaUnitsBillingCard(props: {
  accountId: string;
  accountSlug: string;
  canManageBilling: boolean;
}) {
  return (
    <MediaUnitsBillingCard
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
