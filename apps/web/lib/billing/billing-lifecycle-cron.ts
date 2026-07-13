import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import {
  applyAccountBillingTransition,
  claimBillingEmailEvent,
  releaseBillingEmailEvent,
} from './account-billing-lifecycle';
import {
  BILLING_CANCEL_AFTER_SUSPEND_DAYS,
  BILLING_GRACE_PERIOD_DAYS,
  BILLING_SUSPEND_AFTER_DAYS,
  type AccountBillingRow,
  type AccountBillingStatus,
  type BillingEmailKind,
} from './account-billing-types';
import { BILLING_TRIAL_DAYS } from './billing-config-prices';
import { flushBillingEmailJobs } from './billing-email-outbox';
import { sendBillingLifecycleEmail } from './billing-lifecycle-emails';

type AnyClient = SupabaseClient<any>;

const MS_DAY = 24 * 60 * 60 * 1000;

export type BillingLifecycleCronResult = {
  emailsSent: number;
  emailsSkipped: number;
  transitions: number;
  errors: string[];
};

type CronBillingRow = AccountBillingRow & {
  accounts: { id: string; name: string | null; slug: string | null } | null;
};

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / MS_DAY);
}

function subscriptionKey(row: AccountBillingRow) {
  return row.stripe_subscription_id ?? `account:${row.account_id}`;
}

function accountLabel(row: CronBillingRow) {
  const slug = row.accounts?.slug;
  if (!slug) return null;
  return {
    slug,
    name: row.accounts?.name?.trim() || slug,
  };
}

async function sendMilestoneEmail(
  admin: AnyClient,
  row: CronBillingRow,
  emailKind: BillingEmailKind,
): Promise<'sent' | 'skipped'> {
  const meta = accountLabel(row);
  if (!meta) return 'skipped';

  const claimed = await claimBillingEmailEvent(admin, {
    accountId: row.account_id,
    emailKind,
    status: row.subscription_status,
  });

  if (!claimed) {
    return 'skipped';
  }

  try {
    return await sendBillingLifecycleEmail(admin, {
      accountId: row.account_id,
      emailKind,
      accountName: meta.name,
      accountSlug: meta.slug,
      subscriptionId: subscriptionKey(row),
      trialEndsAt: row.trial_ends_at,
    });
  } catch (err) {
    await releaseBillingEmailEvent(admin, row.account_id, emailKind);
    throw err;
  }
}

async function transitionAndEmail(
  admin: AnyClient,
  row: CronBillingRow,
  input: {
    toStatus: AccountBillingStatus;
    emailKind: BillingEmailKind;
    cronKey: string;
  },
): Promise<{ transitioned: boolean; email: 'sent' | 'skipped' | 'queued' }> {
  const result = await applyAccountBillingTransition(admin, {
    stripeEventId: `cron:${row.account_id}:${input.cronKey}`,
    accountId: row.account_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    trialEndsAt: row.trial_ends_at,
    toStatus: input.toStatus,
    emailKind: input.emailKind,
  });

  if (result.emailJobIds.length > 0) {
    await flushBillingEmailJobs(admin, result.emailJobIds);
    return {
      transitioned: result.applied,
      email: result.applied ? 'queued' : 'skipped',
    };
  }

  return {
    transitioned: result.applied,
    email: 'skipped',
  };
}

async function loadBillingRows(
  admin: AnyClient,
  statuses: NonNullable<AccountBillingRow['subscription_status']>[],
): Promise<CronBillingRow[]> {
  const { data, error } = await admin
    .from('account_billing')
    .select(
      'account_id, subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, grace_period_ends_at, restricted_at, suspended_at, canceled_at, updated_at, accounts!inner(id, name, slug)',
    )
    .in('subscription_status', statuses);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Array<
    AccountBillingRow & {
      accounts:
        | { id: string; name: string | null; slug: string | null }
        | Array<{ id: string; name: string | null; slug: string | null }>
        | null;
    }
  >).map((row) => ({
    ...row,
    accounts: Array.isArray(row.accounts) ? (row.accounts[0] ?? null) : row.accounts,
  }));
}

/**
 * Trial cadence: day 7 value, 3 days left, 1 day left, expired → trial_expired.
 */
export async function runBillingTrialLifecycleCron(
  admin: AnyClient,
): Promise<BillingLifecycleCronResult> {
  const logger = await getLogger();
  const result: BillingLifecycleCronResult = {
    emailsSent: 0,
    emailsSkipped: 0,
    transitions: 0,
    errors: [],
  };

  const sender = process.env.EMAIL_SENDER?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!sender || !siteUrl) {
    result.errors.push('EMAIL_SENDER or NEXT_PUBLIC_SITE_URL not configured');
    return result;
  }

  let rows: CronBillingRow[];
  try {
    rows = await loadBillingRows(admin, ['trialing', 'trial_expired']);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }

  const now = new Date();

  for (const row of rows) {
    if (!row.trial_ends_at || !accountLabel(row)) continue;

    const trialEnds = new Date(row.trial_ends_at);
    const trialStarts = new Date(
      trialEnds.getTime() - BILLING_TRIAL_DAYS * MS_DAY,
    );
    const daysLeft = daysBetween(now, trialEnds);
    const daysIntoTrial = daysBetween(trialStarts, now);

    try {
      // Day 14 / expired
      if (
        row.subscription_status === 'trialing' &&
        trialEnds.getTime() <= now.getTime()
      ) {
        const outcome = await transitionAndEmail(admin, row, {
          toStatus: 'trial_expired',
          emailKind: 'trial_ended',
          cronKey: 'trial_expired',
        });
        if (outcome.transitioned) result.transitions++;
        if (outcome.email === 'queued' || outcome.email === 'sent') {
          result.emailsSent++;
        } else {
          result.emailsSkipped++;
        }
        continue;
      }

      if (row.subscription_status !== 'trialing') continue;

      // Day 13 — 1 day left (catch-up: daysLeft <= 1 while still > 0)
      if (daysLeft <= 1 && daysLeft >= 0) {
        const email = await sendMilestoneEmail(admin, row, 'trial_ending_1d');
        if (email === 'sent') result.emailsSent++;
        else result.emailsSkipped++;
        continue;
      }

      // Day 11 — 3 days left
      if (daysLeft <= 3) {
        const email = await sendMilestoneEmail(admin, row, 'trial_ending_3d');
        if (email === 'sent') result.emailsSent++;
        else result.emailsSkipped++;
        continue;
      }

      // Day 7 value recap (catch-up until 3-day window)
      if (daysIntoTrial >= 7 && daysLeft > 3) {
        const email = await sendMilestoneEmail(admin, row, 'trial_day_7');
        if (email === 'sent') result.emailsSent++;
        else result.emailsSkipped++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${row.account_id}: ${message}`);
      logger.error(
        { err, accountId: row.account_id },
        '[billing-lifecycle-cron] trial step failed',
      );
    }
  }

  return result;
}

/**
 * Dunning: grace reminder (3d), restrict (7d), suspend (14d unpaid), cancel (30d suspended).
 * Cancel sets status only — no data deletion (confirm retention with Dan before delete).
 */
export async function runBillingDunningLifecycleCron(
  admin: AnyClient,
): Promise<BillingLifecycleCronResult> {
  const logger = await getLogger();
  const result: BillingLifecycleCronResult = {
    emailsSent: 0,
    emailsSkipped: 0,
    transitions: 0,
    errors: [],
  };

  const sender = process.env.EMAIL_SENDER?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!sender || !siteUrl) {
    result.errors.push('EMAIL_SENDER or NEXT_PUBLIC_SITE_URL not configured');
    return result;
  }

  let rows: CronBillingRow[];
  try {
    rows = await loadBillingRows(admin, [
      'past_due_grace',
      'past_due_restricted',
      'suspended',
    ]);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }

  const now = new Date();

  for (const row of rows) {
    if (!accountLabel(row)) continue;

    try {
      if (row.subscription_status === 'past_due_grace') {
        const graceEnds = row.grace_period_ends_at
          ? new Date(row.grace_period_ends_at)
          : null;
        const graceStarted = graceEnds
          ? new Date(graceEnds.getTime() - BILLING_GRACE_PERIOD_DAYS * MS_DAY)
          : row.updated_at
            ? new Date(row.updated_at)
            : null;

        if (!graceStarted) continue;

        const daysInGrace = daysBetween(graceStarted, now);

        // 7+ days → restricted
        if (
          daysInGrace >= BILLING_GRACE_PERIOD_DAYS ||
          (graceEnds && graceEnds.getTime() <= now.getTime())
        ) {
          const outcome = await transitionAndEmail(admin, row, {
            toStatus: 'past_due_restricted',
            emailKind: 'account_restricted',
            cronKey: 'past_due_restricted',
          });
          if (outcome.transitioned) result.transitions++;
          if (outcome.email === 'queued' || outcome.email === 'sent') {
            result.emailsSent++;
          } else {
            result.emailsSkipped++;
          }
          continue;
        }

        // 3+ days reminder, no state change
        if (daysInGrace >= 3) {
          const email = await sendMilestoneEmail(
            admin,
            row,
            'payment_reminder_3d',
          );
          if (email === 'sent') result.emailsSent++;
          else result.emailsSkipped++;
        }
        continue;
      }

      if (row.subscription_status === 'past_due_restricted') {
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

        if (!unpaidSince) continue;

        const daysUnpaid = daysBetween(unpaidSince, now);
        if (daysUnpaid >= BILLING_SUSPEND_AFTER_DAYS) {
          const outcome = await transitionAndEmail(admin, row, {
            toStatus: 'suspended',
            emailKind: 'account_suspended',
            cronKey: 'suspended',
          });
          if (outcome.transitioned) result.transitions++;
          if (outcome.email === 'queued' || outcome.email === 'sent') {
            result.emailsSent++;
          } else {
            result.emailsSkipped++;
          }
        }
        continue;
      }

      if (row.subscription_status === 'suspended') {
        if (!row.suspended_at) continue;
        const daysSuspended = daysBetween(new Date(row.suspended_at), now);
        if (daysSuspended >= BILLING_CANCEL_AFTER_SUSPEND_DAYS) {
          // Status → canceled + final warning. No delete / purge.
          const outcome = await transitionAndEmail(admin, row, {
            toStatus: 'canceled',
            emailKind: 'cancel_warning',
            cronKey: 'canceled_after_suspend',
          });
          if (outcome.transitioned) result.transitions++;
          if (outcome.email === 'queued' || outcome.email === 'sent') {
            result.emailsSent++;
          } else {
            result.emailsSkipped++;
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${row.account_id}: ${message}`);
      logger.error(
        { err, accountId: row.account_id },
        '[billing-lifecycle-cron] dunning step failed',
      );
    }
  }

  return result;
}

/** Combined daily run (trial + dunning). */
export async function runBillingLifecycleCron(
  admin: AnyClient,
): Promise<{
  trial: BillingLifecycleCronResult;
  dunning: BillingLifecycleCronResult;
}> {
  const trial = await runBillingTrialLifecycleCron(admin);
  const dunning = await runBillingDunningLifecycleCron(admin);
  return { trial, dunning };
}

