import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { checkAccountAccess } from '~/lib/billing/check-account-access';
import { hasActiveWorkspaceSubscription } from '~/lib/billing/entitlements';

import { BillingAccessBanner } from '../_components/billing-access-banner';
import { BillingExemptConversionBanner } from '../_components/billing-exempt-conversion-banner';

/**
 * Server wrapper: loads account_billing access and renders the owner banner
 * when the workspace is not in full_access, or a soft conversion banner when
 * the workspace is billing-exempt without a paid subscription.
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

  const billingPath = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  // Soft conversion CTA for complimentary / exempt workspaces without a sub.
  if (access.exempt && access.reason === 'billing_exempt') {
    const hasPaidSub = await hasActiveWorkspaceSubscription(client, accountId);
    if (!hasPaidSub) {
      return (
        <BillingExemptConversionBanner
          accountId={accountId}
          billingPath={billingPath}
        />
      );
    }
  }

  if (access.level === 'full_access') {
    return null;
  }

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
