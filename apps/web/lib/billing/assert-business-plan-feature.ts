import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  isBusinessFreeFeatureBlocked,
  resolveBusinessFree,
} from '~/home/[account]/_lib/business-free-access';
import {
  isBusinessLiteType,
  resolveWorkspaceProfile,
} from '~/home/[account]/_lib/workspace-profile';

const FEATURE_LABELS: Record<string, string> = {
  proposals: 'Proposals',
  contracts: 'Contracts',
  retainers: 'Retainers',
};

/**
 * Server-action guard: RLS lets Free members write proposals, contracts and
 * retainers (they share invoice and client permissions), so check the plan.
 */
export async function assertBusinessPlanFeature(
  client: SupabaseClient,
  accountId: string,
  featureKey: keyof typeof FEATURE_LABELS,
): Promise<void> {
  const now = new Date().toISOString();
  const [accountResult, businessResult, entitlementResult] = await Promise.all([
    client.from('accounts').select('space_type').eq('id', accountId).single(),
    client
      .from('businesses')
      .select('type')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    client
      .from('account_entitlements')
      .select('entitlement_key')
      .eq('account_id', accountId)
      .in('entitlement_key', [
        'workspace_business_lite',
        'workspace_business',
        'workspace_business_starter',
      ])
      .or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);

  if (accountResult.error) {
    throw new Error('Workspace not found');
  }

  const businessType =
    (businessResult.data as { type?: string | null } | null)?.type ?? null;
  const profile = resolveWorkspaceProfile({
    space_type: (accountResult.data as { space_type?: string | null })
      .space_type,
    business_type: businessType,
  });

  if (profile !== 'work_design') {
    return;
  }

  const businessFree = resolveBusinessFree({
    businessTypeIsLite: isBusinessLiteType(businessType),
    entitlementKeys: (entitlementResult.data ?? []).map(
      (row) => (row as { entitlement_key: string }).entitlement_key,
    ),
  });

  if (businessFree && isBusinessFreeFeatureBlocked(featureKey, null)) {
    throw new Error(
      `${FEATURE_LABELS[featureKey]} are not included on the Free plan. Upgrade to Starter or Pro to use them.`,
    );
  }
}
