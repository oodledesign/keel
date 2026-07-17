import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { checkAccountAccess } from '~/lib/billing/check-account-access';

import { BillingAccessBanner } from '../_components/billing-access-banner';

/**
 * Server wrapper: loads account_billing access and renders the owner banner
 * when the workspace is not in full_access.
 */
export async function BillingAccessBannerHost({
  accountId,
  accountSlug,
  canManageBilling,
}: {
  accountId: string;
  accountSlug: string;
  canManageBilling: boolean;
}) {
  // Prompt: show to account owners / billing managers — not client-facing roles.
  if (!canManageBilling) {
    return null;
  }

  const client = getSupabaseServerClient();
  const access = await checkAccountAccess(client, accountId);

  if (access.level === 'full_access') {
    return null;
  }

  const billingPath = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  return (
    <BillingAccessBanner
      accountId={accountId}
      accountSlug={accountSlug}
      billingPath={billingPath}
      level={access.level}
      status={access.status}
      hasStripeCustomer={Boolean(access.billing?.stripe_customer_id)}
    />
  );
}
