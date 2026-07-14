import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  hasEntitlement,
  isAccountBillingExempt,
} from '~/lib/billing/entitlements';
import { findPlanByStripePriceId } from '~/lib/billing/ozer-plan-catalog';

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);

type SubscriptionAddonRow = {
  id: string;
  status: string | null;
  items: Array<{ variant_id: string | null }> | null;
};

/**
 * Whether this workspace may see unlocked Site Studio tabs.
 *
 * Checks entitlement (`addon_site_studio`, including Super Admin grants),
 * billing exemption, or an active Stripe line item for the add-on.
 *
 * Deliberately does **not** auto-unlock every Super Admin user — that would
 * prevent verifying locked tabs during development. Server mutations still
 * use `canUseAddon` (super-admin bypass) separately.
 */
export async function hasSiteStudio(accountId: string): Promise<boolean> {
  const client = getSupabaseServerClient();

  if (await isAccountBillingExempt(client, accountId)) {
    return true;
  }

  if (await hasEntitlement(client, accountId, 'addon_site_studio')) {
    return true;
  }

  const { data: subs } = await client
    .from('subscriptions')
    .select('id, status, items: subscription_items(variant_id)')
    .eq('account_id', accountId)
    .returns<SubscriptionAddonRow[]>();

  for (const sub of subs ?? []) {
    if (!ACTIVE_SUB_STATUSES.has(sub.status ?? '')) {
      continue;
    }

    for (const row of sub.items ?? []) {
      const variantId = row.variant_id;
      if (!variantId) continue;
      const plan = findPlanByStripePriceId(variantId);
      if (plan?.entitlementKey === 'addon_site_studio') {
        return true;
      }
    }
  }

  return false;
}
