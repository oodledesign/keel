import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type AdminBillingPastDueRow = {
  subscriptionId: string;
  accountId: string;
  accountName: string;
  accountSlug: string;
  status: string;
  updatedAt: string;
};

export type AdminBillingCancelledRow = {
  subscriptionId: string;
  accountName: string;
  accountSlug: string;
  cancelledAt: string;
};

export type AdminBillingAnalytics = {
  estimatedMrrMinor: number;
  currency: string;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  cancelledLast30Days: number;
  pastDue: AdminBillingPastDueRow[];
  recentlyCancelled: AdminBillingCancelledRow[];
  statusBreakdown: Array<{ status: string; count: number }>;
};

export const loadAdminBillingAnalytics = cache(
  async (): Promise<AdminBillingAnalytics> => {
    const client = getSupabaseServerClient();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [statusRows, pastDueRows, cancelledRows, activeSubs] =
      await Promise.all([
        client.from('subscriptions').select('status'),
        client
          .from('subscriptions')
          .select(
            'id, status, updated_at, account_id, accounts!inner(name, slug)',
          )
          .in('status', ['past_due', 'unpaid'])
          .order('updated_at', { ascending: true })
          .limit(25),
        client
          .from('subscriptions')
          .select('id, updated_at, accounts!inner(name, slug)')
          .eq('status', 'canceled')
          .gte('updated_at', thirtyDaysAgo)
          .order('updated_at', { ascending: false })
          .limit(15),
        client
          .from('subscriptions')
          .select('id, currency')
          .in('status', ['active', 'trialing']),
      ]);

    const activeSubIds = (activeSubs.data ?? []).map(
      (s) => (s as { id: string }).id,
    );
    const currencyBySub = new Map(
      (activeSubs.data ?? []).map((s) => [
        (s as { id: string }).id,
        (s as { currency: string }).currency,
      ]),
    );

    const mrrRows =
      activeSubIds.length > 0
        ? await client
            .from('subscription_items')
            .select(
              'price_amount, quantity, interval, interval_count, subscription_id',
            )
            .in('subscription_id', activeSubIds)
        : { data: [] };

    const statusCounts = new Map<string, number>();
    for (const row of statusRows.data ?? []) {
      const status = String((row as { status: string }).status);
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }

    let estimatedMrrMinor = 0;
    let currency = 'gbp';

    for (const item of mrrRows.data ?? []) {
      const subscriptionId = (item as { subscription_id: string })
        .subscription_id;
      currency = currencyBySub.get(subscriptionId) ?? currency;
      const priceAmount = Number(
        (item as { price_amount: number | null }).price_amount ?? 0,
      );
      const quantity = Number((item as { quantity: number }).quantity ?? 1);
      const interval = String((item as { interval: string }).interval);
      const intervalCount = Number(
        (item as { interval_count: number }).interval_count ?? 1,
      );

      if (!priceAmount) continue;

      let monthly = priceAmount * quantity;
      if (interval === 'year') {
        monthly = monthly / (12 * intervalCount);
      } else if (interval === 'month') {
        monthly = monthly / intervalCount;
      } else if (interval === 'week') {
        monthly = (monthly * 52) / (12 * intervalCount);
      }

      estimatedMrrMinor += monthly;
    }

    const pastDue = (pastDueRows.data ?? []).map((row) => {
      const account = (
        row as { accounts: { name: string | null; slug: string | null } }
      ).accounts;
      const slug = account.slug ?? '';
      return {
        subscriptionId: (row as { id: string }).id,
        accountId: (row as { account_id: string }).account_id,
        accountName: account.name ?? slug,
        accountSlug: slug,
        status: (row as { status: string }).status,
        updatedAt: (row as { updated_at: string }).updated_at,
      };
    });

    const recentlyCancelled = (cancelledRows.data ?? []).map((row) => {
      const account = (
        row as { accounts: { name: string | null; slug: string | null } }
      ).accounts;
      const slug = account.slug ?? '';
      return {
        subscriptionId: (row as { id: string }).id,
        accountName: account.name ?? slug,
        accountSlug: slug,
        cancelledAt: (row as { updated_at: string }).updated_at,
      };
    });

    return {
      estimatedMrrMinor: Math.round(estimatedMrrMinor),
      currency,
      activeSubscriptions: statusCounts.get('active') ?? 0,
      trialingSubscriptions: statusCounts.get('trialing') ?? 0,
      pastDueSubscriptions:
        (statusCounts.get('past_due') ?? 0) + (statusCounts.get('unpaid') ?? 0),
      cancelledLast30Days: recentlyCancelled.length,
      pastDue,
      recentlyCancelled,
      statusBreakdown: [...statusCounts.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
);

export function formatMoneyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
