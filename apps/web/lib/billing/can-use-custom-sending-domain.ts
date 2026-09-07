import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ACCOUNT_SENDING_DOMAINS_TABLE } from '~/lib/sending-domains/types';

import { isCustomSendingDomainAllowed } from './custom-sending-domain-access';
import { isAccountBillingExempt, loadAccountPlanLimits } from './entitlements';

export {
  CUSTOM_SENDING_DOMAIN_ENTITLEMENT,
  CUSTOM_SENDING_DOMAIN_PLAN_ENTITLEMENTS,
  isCustomSendingDomainAllowed,
} from './custom-sending-domain-access';

/**
 * Custom sending domain (and per-feature From toggles).
 *
 * Starter/Pro keep access. Commercial property, property, billing-exempt
 * founding-partner grants, and an explicit `custom_sending_domain`
 * entitlement also unlock it. Free/Lite without one of those paths
 * continues to send from Ozer.
 *
 * `businessType` is accepted for call-site compatibility; lite is no
 * longer a hard deny so leftover `businesses.type = lite` cannot hide
 * a commercial or admin grant.
 */
export async function canUseCustomSendingDomain(
  client: SupabaseClient,
  accountId: string,
  _businessType?: string | null,
): Promise<boolean> {
  const [billingExempt, entitlementKeys, planLimits, hasExistingSendingDomain] =
    await Promise.all([
      isAccountBillingExempt(client, accountId),
      loadActiveEntitlementKeys(client, accountId),
      loadAccountPlanLimits(client, accountId),
      hasExistingAccountSendingDomain(client, accountId),
    ]);

  return isCustomSendingDomainAllowed({
    billingExempt,
    entitlementKeys,
    planFamily: planLimits?.plan_family,
    hasExistingSendingDomain,
  });
}

async function loadActiveEntitlementKeys(
  client: SupabaseClient,
  accountId: string,
): Promise<string[]> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('account_entitlements')
    .select('entitlement_key')
    .eq('account_id', accountId)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error) {
    console.error(
      '[billing] canUseCustomSendingDomain entitlements:',
      error.message,
    );
    return [];
  }

  return (data ?? [])
    .map((row) =>
      String((row as { entitlement_key?: string }).entitlement_key ?? ''),
    )
    .filter(Boolean);
}

/**
 * Read-only existence check. Never insert, update, or delete SES identities.
 */
async function hasExistingAccountSendingDomain(
  client: SupabaseClient,
  accountId: string,
): Promise<boolean> {
  // Table types land after typegen; same untyped access as SendingDomainService.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from(ACCOUNT_SENDING_DOMAINS_TABLE)
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    const message = String(error.message ?? '');
    const missingTable =
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      /account_sending_domains/i.test(message);
    if (!missingTable) {
      console.error(
        '[billing] canUseCustomSendingDomain existing domain:',
        message,
      );
    }
    return false;
  }

  return Boolean(data?.id);
}
