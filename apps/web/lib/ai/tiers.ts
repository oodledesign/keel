import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  aiCreditsForBillableSeats,
  clampBillableSeats,
} from '~/lib/billing/business-graduated-pricing';
import { findPlanByStripePriceId } from '~/lib/billing/ozer-plan-catalog';

/**
 * Monthly AI credit pools by plan.
 * Paid Business uses seat-scaled shared pools via aiCreditsForBillableSeats.
 */
export const TIER_CREDIT_LIMITS: Record<string, number> = {
  free: 200,
  trial: 200,
  'business-lite-free': 200,
  /** Base for graduated Business when quantity cannot be resolved (1 seat). */
  business: 3_000,
  /** Commercial Property — flat monthly pool */
  'commercial-property': 12_000,
  /** Legacy agency key — align with Commercial pool */
  agency: 12_000,
};

export const DEFAULT_CREDITS = 200;

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);

function mapPlanIdToTierKey(planId: string | null | undefined): string | null {
  if (!planId) return null;
  if (planId in TIER_CREDIT_LIMITS) return planId;

  if (planId === 'business-lite-free' || planId.startsWith('business-lite')) {
    return 'business-lite-free';
  }
  if (
    planId === 'business-monthly' ||
    planId === 'business-yearly' ||
    planId.startsWith('business-')
  ) {
    return 'business';
  }
  if (
    planId.startsWith('commercial-property') ||
    planId.includes('commercial')
  ) {
    return 'commercial-property';
  }
  if (planId.includes('agency')) return 'agency';
  return null;
}

async function billableSeatsForAccount(
  accountId: string,
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('status, items:subscription_items(variant_id, product_id, quantity)')
    .eq('account_id', accountId);

  for (const subscription of subscriptions ?? []) {
    const status = String((subscription as { status?: string }).status ?? '');
    if (!ACTIVE_SUB_STATUSES.has(status)) continue;

    const items =
      (subscription as {
        items?: Array<{
          variant_id?: string | null;
          quantity?: number | null;
        }>;
      }).items ?? [];

    for (const item of items) {
      const variantId = item.variant_id;
      if (!variantId) continue;
      const plan = findPlanByStripePriceId(variantId);
      if (plan?.family === 'business') {
        return clampBillableSeats(item.quantity ?? 1);
      }
    }
  }

  // Fallback: max_members on graduated Business equals billable seats.
  const { data: limits } = await supabase
    .from('account_plan_limits')
    .select('plan_family, max_members')
    .eq('account_id', accountId)
    .maybeSingle();

  const row = limits as {
    plan_family?: string | null;
    max_members?: number | null;
  } | null;

  if (row?.plan_family === 'business' && row.max_members != null) {
    return clampBillableSeats(row.max_members);
  }

  return null;
}

export async function getAccountCreditsLimit(
  accountId: string,
  supabase: SupabaseClient,
): Promise<number> {
  const { data: planLimits } = await supabase
    .from('account_plan_limits')
    .select('plan_id, plan_family')
    .eq('account_id', accountId)
    .maybeSingle();

  const limitsRow = planLimits as {
    plan_id?: string | null;
    plan_family?: string | null;
  } | null;

  if (limitsRow?.plan_family === 'business') {
    const seats = await billableSeatsForAccount(accountId, supabase);
    if (seats != null) {
      return aiCreditsForBillableSeats(seats);
    }
  }

  const planTier = mapPlanIdToTierKey(limitsRow?.plan_id);
  if (planTier === 'business') {
    const seats = await billableSeatsForAccount(accountId, supabase);
    if (seats != null) {
      return aiCreditsForBillableSeats(seats);
    }
    return TIER_CREDIT_LIMITS.business!;
  }
  if (planTier && TIER_CREDIT_LIMITS[planTier] != null) {
    return TIER_CREDIT_LIMITS[planTier]!;
  }

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('status, items:subscription_items(variant_id, product_id, quantity)')
    .eq('account_id', accountId);

  for (const subscription of subscriptions ?? []) {
    const status = String((subscription as { status?: string }).status ?? '');
    if (!ACTIVE_SUB_STATUSES.has(status)) continue;

    if (status === 'trialing') {
      // Graduated Business trials still get seat-scaled credits.
      const items =
        (subscription as {
          items?: Array<{
            variant_id?: string | null;
            quantity?: number | null;
          }>;
        }).items ?? [];
      for (const item of items) {
        if (!item.variant_id) continue;
        const plan = findPlanByStripePriceId(item.variant_id);
        if (plan?.family === 'business') {
          return aiCreditsForBillableSeats(item.quantity ?? 1);
        }
      }
      return TIER_CREDIT_LIMITS.trial ?? DEFAULT_CREDITS;
    }

    const items =
      (subscription as {
        items?: Array<{
          variant_id?: string | null;
          quantity?: number | null;
        }>;
      }).items ?? [];

    for (const item of items) {
      const variantId = item.variant_id;
      if (!variantId) continue;
      const plan = findPlanByStripePriceId(variantId);
      if (plan?.family === 'business') {
        return aiCreditsForBillableSeats(item.quantity ?? 1);
      }
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
  options?: { refillRemaining?: boolean },
): Promise<{ previous: number; current: number; changed: boolean }> {
  const nextLimit = await getAccountCreditsLimit(accountId, supabase);

  const { data: balance } = await supabase
    .from('ai_credit_balances')
    .select('credits_monthly_limit, credits_remaining, credits_purchased')
    .eq('account_id', accountId)
    .maybeSingle();

  const previous =
    (balance as { credits_monthly_limit?: number } | null)
      ?.credits_monthly_limit ?? DEFAULT_CREDITS;

  const refill = Boolean(options?.refillRemaining);
  const alreadySynced = previous === nextLimit && !refill;

  if (alreadySynced && balance) {
    return { previous, current: nextLimit, changed: false };
  }

  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  if (balance) {
    const patch: Record<string, unknown> = {
      credits_monthly_limit: nextLimit,
      updated_at: now.toISOString(),
    };
    if (refill) {
      patch.credits_remaining = nextLimit;
      patch.period_start = periodStart.toISOString();
      patch.period_end = periodEnd.toISOString();
      patch.credit_alerts_sent = 0;
      patch.credit_alert_period_start = periodStart.toISOString();
    } else if (nextLimit > previous) {
      // Seat bump: raise the ceiling and grant the delta without resetting usage.
      const remaining =
        (balance as { credits_remaining?: number }).credits_remaining ?? 0;
      const purchased =
        (balance as { credits_purchased?: number }).credits_purchased ?? 0;
      patch.credits_remaining = Math.min(
        remaining + (nextLimit - previous),
        nextLimit + purchased,
      );
    }

    const { error } = await supabase
      .from('ai_credit_balances')
      .update(patch)
      .eq('account_id', accountId);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from('ai_credit_balances').insert({
      account_id: accountId,
      credits_monthly_limit: nextLimit,
      credits_remaining: nextLimit,
      credits_purchased: 0,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      credit_alerts_sent: 0,
      credit_alert_period_start: periodStart.toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    previous,
    current: nextLimit,
    changed: previous !== nextLimit || refill,
  };
}
