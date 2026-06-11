import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export const loadAdminAccountBillingState = cache(
  async (accountId: string) => {
    const client = getSupabaseServerClient();

    const [entitlements, exempt] = await Promise.all([
      client
        .from('account_entitlements')
        .select('entitlement_key, source, expires_at')
        .eq('account_id', accountId)
        .order('entitlement_key'),
      client
        .from('account_billing_exempt')
        .select('account_id')
        .eq('account_id', accountId)
        .maybeSingle(),
    ]);

    return {
      entitlements: (entitlements.data ?? []) as Array<{
        entitlement_key: string;
        source: string;
        expires_at: string | null;
      }>,
      billingExempt: Boolean(exempt.data),
    };
  },
);
