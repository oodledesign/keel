import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  applyAccountBillingTransition,
  mapStripeSubscriptionStatus,
} from './account-billing-lifecycle';

type AnyClient = SupabaseClient<any>;

/**
 * Best-effort reconcile of account_billing from MakerKit subscriptions.
 * Used by admin at-risk so trials show even when webhook sync was missed.
 * Skips accounts already matching the latest subscription status.
 */
export async function reconcileAccountBillingFromSubscriptions(
  admin: AnyClient,
): Promise<{ synced: number }> {
  const [{ data: subscriptions, error }, { data: billingRows }] =
    await Promise.all([
      admin
        .from('subscriptions')
        .select(
          'id, account_id, status, trial_ends_at, updated_at, billing_customer:billing_customers(customer_id)',
        )
        .eq('billing_provider', 'stripe')
        .order('updated_at', { ascending: false }),
      admin
        .from('account_billing')
        .select(
          'account_id, subscription_status, stripe_subscription_id, trial_ends_at',
        ),
    ]);

  if (error) {
    console.error(
      '[account-billing] reconcile list failed:',
      error.message,
    );
    return { synced: 0 };
  }

  const billingByAccount = new Map<
    string,
    {
      subscription_status: string | null;
      stripe_subscription_id: string | null;
      trial_ends_at: string | null;
    }
  >();

  for (const row of (billingRows ?? []) as Array<{
    account_id: string;
    subscription_status: string | null;
    stripe_subscription_id: string | null;
    trial_ends_at: string | null;
  }>) {
    billingByAccount.set(row.account_id, {
      subscription_status: row.subscription_status,
      stripe_subscription_id: row.stripe_subscription_id,
      trial_ends_at: row.trial_ends_at,
    });
  }

  const latestByAccount = new Map<
    string,
    {
      id: string;
      account_id: string;
      status: string;
      trial_ends_at: string | null;
      customer_id: string | null;
    }
  >();

  for (const row of (subscriptions ?? []) as Array<{
    id: string;
    account_id: string;
    status: string;
    trial_ends_at: string | null;
    billing_customer?:
      | { customer_id?: string | null }
      | Array<{ customer_id?: string | null }>
      | null;
  }>) {
    if (latestByAccount.has(row.account_id)) continue;
    const customer = Array.isArray(row.billing_customer)
      ? row.billing_customer[0]
      : row.billing_customer;
    latestByAccount.set(row.account_id, {
      id: row.id,
      account_id: row.account_id,
      status: row.status,
      trial_ends_at: row.trial_ends_at,
      customer_id: customer?.customer_id ?? null,
    });
  }

  let synced = 0;

  for (const sub of latestByAccount.values()) {
    const mapped = mapStripeSubscriptionStatus(sub.status, null);
    if (!mapped) continue;

    const existing = billingByAccount.get(sub.account_id);
    if (
      existing &&
      existing.subscription_status === mapped &&
      existing.stripe_subscription_id === sub.id &&
      (existing.trial_ends_at ?? null) === (sub.trial_ends_at ?? null)
    ) {
      continue;
    }

    const result = await applyAccountBillingTransition(admin, {
      stripeEventId: `admin-reconcile:${sub.id}:${mapped}:${sub.trial_ends_at ?? 'none'}`,
      accountId: sub.account_id,
      stripeCustomerId: sub.customer_id,
      stripeSubscriptionId: sub.id,
      trialEndsAt: sub.trial_ends_at,
      toStatus: mapped,
      forceEvent: true,
      emailKind: null,
    });

    if (result.applied) {
      synced += 1;
    }
  }

  return { synced };
}
