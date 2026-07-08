import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { findPlanByStripePriceId } from '~/lib/billing/ozer-plan-catalog';

export const TIER_CREDIT_LIMITS: Record<string, number> = {
  free: 200,
  trial: 200,
  'business-lite-free': 500,
  business: 2000,
  agency: 10000,
};

export const DEFAULT_CREDITS = 200;

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);

function mapPlanIdToTierKey(planId: string | null | undefined): string | null {
  if (!planId) return null;
  if (planId in TIER_CREDIT_LIMITS) return planId;
  if (planId === 'business-lite-free') return 'business-lite-free';
  if (planId.startsWith('business-')) return 'business';
  if (planId.includes('agency')) return 'agency';
  return null;
}

export async function getAccountCreditsLimit(
  accountId: string,
  supabase: SupabaseClient,
): Promise<number> {
  const { data: planLimits } = await supabase
    .from('account_plan_limits')
    .select('plan_id')
    .eq('account_id', accountId)
    .maybeSingle();

  const planTier = mapPlanIdToTierKey(
    (planLimits as { plan_id?: string | null } | null)?.plan_id,
  );
  if (planTier && TIER_CREDIT_LIMITS[planTier] != null) {
    return TIER_CREDIT_LIMITS[planTier]!;
  }

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('status, items:subscription_items(variant_id, product_id)')
    .eq('account_id', accountId);

  for (const subscription of subscriptions ?? []) {
    const status = String((subscription as { status?: string }).status ?? '');
    if (!ACTIVE_SUB_STATUSES.has(status)) continue;

    if (status === 'trialing') {
      return TIER_CREDIT_LIMITS.trial ?? DEFAULT_CREDITS;
    }

    const items =
      (subscription as { items?: Array<{ variant_id?: string | null }> }).items ??
      [];

    for (const item of items) {
      const variantId = item.variant_id;
      if (!variantId) continue;
      const plan = findPlanByStripePriceId(variantId);
      const tier = mapPlanIdToTierKey(plan?.planId);
      if (tier && TIER_CREDIT_LIMITS[tier] != null) {
        return TIER_CREDIT_LIMITS[tier]!;
      }
    }
  }

  return DEFAULT_CREDITS;
}

export async function syncAccountCreditLimit(
  accountId: string,
  supabase: SupabaseClient,
): Promise<{ previous: number; current: number; changed: boolean }> {
  const nextLimit = await getAccountCreditsLimit(accountId, supabase);

  const { data: balance } = await supabase
    .from('ai_credit_balances')
    .select('credits_monthly_limit')
    .eq('account_id', accountId)
    .maybeSingle();

  const previous =
    (balance as { credits_monthly_limit?: number } | null)?.credits_monthly_limit ??
    DEFAULT_CREDITS;

  if (previous === nextLimit) {
    return { previous, current: nextLimit, changed: false };
  }

  const { error } = await supabase
    .from('ai_credit_balances')
    .update({
      credits_monthly_limit: nextLimit,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }

  return { previous, current: nextLimit, changed: true };
}
