import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { AccountBillingStatus } from '~/lib/billing/account-billing-types';
import {
  BILLING_CANCEL_AFTER_SUSPEND_DAYS,
  BILLING_GRACE_PERIOD_DAYS,
  BILLING_SUSPEND_AFTER_DAYS,
} from '~/lib/billing/account-billing-types';
import { reconcileAccountBillingFromSubscriptions } from '~/lib/billing/reconcile-account-billing';

const MS_DAY = 24 * 60 * 60 * 1000;

const WATCH_STATUSES = [
  'suspended',
  'past_due_restricted',
  'past_due_grace',
  'trialing',
] as const satisfies readonly AccountBillingStatus[];

export type AdminAtRiskAccountRow = {
  accountId: string;
  accountName: string;
  accountSlug: string;
  accountEmail: string | null;
  status: (typeof WATCH_STATUSES)[number];
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  restrictedAt: string | null;
  suspendedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Days remaining on trial (trialing only). */
  trialDaysRemaining: number | null;
  /** Human urgency label for the list. */
  urgencyLabel: string;
  /** Sort key — higher = more urgent. */
  urgencyScore: number;
  lastEvent: {
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
    stripeEventId: string | null;
  } | null;
};

type AnyClient = SupabaseClient<any>;

function emptyCounts(): Record<(typeof WATCH_STATUSES)[number], number> {
  return {
    suspended: 0,
    past_due_restricted: 0,
    past_due_grace: 0,
    trialing: 0,
  };
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / MS_DAY);
}

function computeUrgency(
  status: (typeof WATCH_STATUSES)[number],
  row: {
    trial_ends_at: string | null;
    grace_period_ends_at: string | null;
    restricted_at: string | null;
    suspended_at: string | null;
  },
  now: Date,
): { score: number; label: string; trialDaysRemaining: number | null } {
  switch (status) {
    case 'suspended': {
      const since = row.suspended_at ? new Date(row.suspended_at) : now;
      const daysSuspended = Math.max(0, daysBetween(since, now));
      const daysToCancel = Math.max(
        0,
        BILLING_CANCEL_AFTER_SUSPEND_DAYS - daysSuspended,
      );
      return {
        score: 4000 + daysSuspended,
        label:
          daysToCancel === 0
            ? `Suspended ${daysSuspended}d — cancel window`
            : `Suspended ${daysSuspended}d · ${daysToCancel}d to cancel`,
        trialDaysRemaining: null,
      };
    }
    case 'past_due_restricted': {
      const graceEnds = row.grace_period_ends_at
        ? new Date(row.grace_period_ends_at)
        : null;
      const unpaidSince = graceEnds
        ? new Date(graceEnds.getTime() - BILLING_GRACE_PERIOD_DAYS * MS_DAY)
        : row.restricted_at
          ? new Date(
              new Date(row.restricted_at).getTime() -
                BILLING_GRACE_PERIOD_DAYS * MS_DAY,
            )
          : null;
      const daysUnpaid = unpaidSince
        ? Math.max(0, daysBetween(unpaidSince, now))
        : BILLING_GRACE_PERIOD_DAYS;
      const daysToSuspend = Math.max(
        0,
        BILLING_SUSPEND_AFTER_DAYS - daysUnpaid,
      );
      return {
        score: 3000 + (BILLING_SUSPEND_AFTER_DAYS - daysToSuspend),
        label:
          daysToSuspend === 0
            ? 'Restricted — suspend due'
            : `Restricted · ~${daysToSuspend}d to suspend`,
        trialDaysRemaining: null,
      };
    }
    case 'past_due_grace': {
      const graceEnds = row.grace_period_ends_at
        ? new Date(row.grace_period_ends_at)
        : null;
      const daysLeft = graceEnds
        ? Math.max(0, daysBetween(now, graceEnds))
        : BILLING_GRACE_PERIOD_DAYS;
      return {
        score: 2000 + (BILLING_GRACE_PERIOD_DAYS - daysLeft),
        label:
          daysLeft === 0
            ? 'Grace ending — restrict due'
            : `Grace · ${daysLeft}d left`,
        trialDaysRemaining: null,
      };
    }
    case 'trialing': {
      const ends = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
      const daysLeft = ends ? Math.max(0, daysBetween(now, ends)) : null;
      const nearness = daysLeft == null ? 0 : Math.max(0, 14 - daysLeft);
      return {
        score: 1000 + nearness,
        label:
          daysLeft == null
            ? 'Trialing'
            : daysLeft === 0
              ? 'Trial ends today'
              : `Trial · ${daysLeft}d left`,
        trialDaysRemaining: daysLeft,
      };
    }
    default:
      return { score: 0, label: status, trialDaysRemaining: null };
  }
}

/**
 * Accounts in trial / dunning for manual outreach (super-admin ops view).
 */
export const loadAdminAtRiskAccounts = cache(
  async (): Promise<{
    rows: AdminAtRiskAccountRow[];
    counts: Record<(typeof WATCH_STATUSES)[number], number>;
  }> => {
    const authClient = getSupabaseServerClient();
    if (!(await isSuperAdmin(authClient))) {
      return { rows: [], counts: emptyCounts() };
    }

    // account_billing / billing_events may not be in generated Database types yet
    const admin = getSupabaseServerAdminClient() as AnyClient;
    const now = new Date();

    // Pull any MakerKit trials/active subs that never wrote account_billing
    // (e.g. webhooks before lifecycle sync). Idempotent via stripe_event_id.
    try {
      await reconcileAccountBillingFromSubscriptions(admin);
    } catch (error) {
      console.error(
        '[admin] reconcileAccountBillingFromSubscriptions failed',
        error,
      );
    }

    const { data, error } = await admin
      .from('account_billing')
      .select(
        `
        account_id,
        subscription_status,
        trial_ends_at,
        grace_period_ends_at,
        restricted_at,
        suspended_at,
        stripe_customer_id,
        stripe_subscription_id,
        accounts!inner (
          id,
          name,
          slug,
          email
        )
      `,
      )
      .in('subscription_status', [...WATCH_STATUSES]);

    if (error) {
      console.error('[admin] loadAdminAtRiskAccounts:', error.message);
      return { rows: [], counts: emptyCounts() };
    }

    const accountIds = ((data ?? []) as Array<{ account_id: string }>).map(
      (row) => row.account_id,
    );

    const lastEventByAccount = new Map<
      string,
      AdminAtRiskAccountRow['lastEvent']
    >();

    if (accountIds.length > 0) {
      const { data: events } = await admin
        .from('billing_events')
        .select(
          'account_id, from_status, to_status, created_at, stripe_event_id',
        )
        .in('account_id', accountIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(accountIds.length * 5, 500));

      for (const event of (events ?? []) as Array<{
        account_id: string;
        from_status: string | null;
        to_status: string;
        created_at: string;
        stripe_event_id: string | null;
      }>) {
        if (lastEventByAccount.has(event.account_id)) continue;
        lastEventByAccount.set(event.account_id, {
          fromStatus: event.from_status,
          toStatus: event.to_status,
          createdAt: event.created_at,
          stripeEventId: event.stripe_event_id,
        });
      }
    }

    const counts = emptyCounts();

    const rows: AdminAtRiskAccountRow[] = (
      (data ?? []) as Array<{
        account_id: string;
        subscription_status: (typeof WATCH_STATUSES)[number];
        trial_ends_at: string | null;
        grace_period_ends_at: string | null;
        restricted_at: string | null;
        suspended_at: string | null;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        accounts:
          | {
              id: string;
              name: string | null;
              slug: string | null;
              email: string | null;
            }
          | Array<{
              id: string;
              name: string | null;
              slug: string | null;
              email: string | null;
            }>;
      }>
    ).map((row) => {
      const account = Array.isArray(row.accounts)
        ? row.accounts[0]
        : row.accounts;
      const slug = account?.slug ?? '';
      const status = row.subscription_status;
      counts[status] = (counts[status] ?? 0) + 1;

      const urgency = computeUrgency(status, row, now);

      return {
        accountId: row.account_id,
        accountName: account?.name?.trim() || slug || 'Workspace',
        accountSlug: slug,
        accountEmail: account?.email ?? null,
        status,
        trialEndsAt: row.trial_ends_at,
        gracePeriodEndsAt: row.grace_period_ends_at,
        restrictedAt: row.restricted_at,
        suspendedAt: row.suspended_at,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        trialDaysRemaining: urgency.trialDaysRemaining,
        urgencyLabel: urgency.label,
        urgencyScore: urgency.score,
        lastEvent: lastEventByAccount.get(row.account_id) ?? null,
      };
    });

    rows.sort((a, b) => b.urgencyScore - a.urgencyScore);

    return { rows, counts };
  },
);
