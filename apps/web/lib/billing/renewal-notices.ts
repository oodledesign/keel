import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import pathsConfig from '~/config/paths.config';
import {
  escapeEmailHtml,
  renderOzerTransactionalEmail,
} from '~/lib/email/ozer-transactional-shell';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import {
  loadWorkspaceOwnerEmail,
  markNotificationSent,
  notificationAlreadySent,
} from './billing-lifecycle-emails';
import {
  formatChargeAmount,
  isWithinRenewalNoticeWindow,
} from './renewal-notices.shared';

type AnyClient = SupabaseClient;

export type RenewalNoticeCronResult = {
  sent: number;
  skipped: number;
  errors: string[];
};

type RenewalCandidate = {
  subscriptionId: string;
  accountId: string;
  accountName: string;
  accountSlug: string;
  periodEndsAt: string;
  currency: string;
  amountMinor: number;
};

function periodKey(periodEndsAt: string): string {
  return new Date(periodEndsAt).toISOString();
}

async function loadRenewalCandidates(
  admin: AnyClient,
): Promise<RenewalCandidate[]> {
  const { data, error } = await admin
    .from('subscriptions')
    .select(
      'id, account_id, period_ends_at, currency, cancel_at_period_end, status, active, accounts!inner(name, slug), subscription_items(price_amount, quantity, type)',
    )
    .eq('active', true)
    .eq('cancel_at_period_end', false)
    .in('status', ['active']);

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    account_id: string;
    period_ends_at: string;
    currency: string;
    accounts:
      | { name: string | null; slug: string | null }
      | Array<{ name: string | null; slug: string | null }>
      | null;
    subscription_items: Array<{
      price_amount: number | null;
      quantity: number | null;
      type: string | null;
    }> | null;
  }>;

  const candidates: RenewalCandidate[] = [];

  for (const row of rows) {
    const account = Array.isArray(row.accounts)
      ? row.accounts[0]
      : row.accounts;
    if (!account?.slug || !row.period_ends_at) continue;

    const amountMinor = (row.subscription_items ?? []).reduce((sum, item) => {
      if (item.type === 'metered') return sum;
      const unit = Number(item.price_amount ?? 0);
      const qty = Number(item.quantity ?? 1);
      return sum + unit * qty;
    }, 0);

    candidates.push({
      subscriptionId: row.id,
      accountId: row.account_id,
      accountName: account.name?.trim() || account.slug,
      accountSlug: account.slug,
      periodEndsAt: row.period_ends_at,
      currency: row.currency || 'gbp',
      amountMinor,
    });
  }

  return candidates;
}

export async function runBillingRenewalNoticeCron(
  admin: AnyClient,
  now = new Date(),
): Promise<RenewalNoticeCronResult> {
  const logger = await getLogger();
  const result: RenewalNoticeCronResult = {
    sent: 0,
    skipped: 0,
    errors: [],
  };

  const sender = process.env.EMAIL_SENDER?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || 'Ozer';

  if (!sender || !siteUrl) {
    result.errors.push('EMAIL_SENDER or NEXT_PUBLIC_SITE_URL not configured');
    return result;
  }

  let candidates: RenewalCandidate[];
  try {
    candidates = await loadRenewalCandidates(admin);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }

  for (const row of candidates) {
    const ends = new Date(row.periodEndsAt);
    if (!isWithinRenewalNoticeWindow(ends, now)) {
      continue;
    }

    const key = periodKey(row.periodEndsAt);
    try {
      if (
        await notificationAlreadySent(
          admin,
          row.subscriptionId,
          'renewal_notice',
          key,
        )
      ) {
        result.skipped += 1;
        continue;
      }

      const ownerEmail = await loadWorkspaceOwnerEmail(admin, row.accountId);
      if (!ownerEmail) {
        result.skipped += 1;
        continue;
      }

      const billingUrl = new URL(
        pathsConfig.app.accountBilling.replace('[account]', row.accountSlug),
        siteUrl,
      ).toString();
      const amount = formatChargeAmount(row.amountMinor, row.currency);
      const when = ends.toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const name = escapeEmailHtml(row.accountName);

      const html = renderOzerTransactionalEmail({
        title: 'Your plan renews soon',
        preview: `We’ll take ${amount} when your ${productName} plan renews on ${when}.`,
        heading: 'Your plan renews soon',
        bodyHtml: `<p>Your <strong>${name}</strong> subscription renews on <strong>${escapeEmailHtml(when)}</strong>.</p>
          <p>We’ll charge <strong>${escapeEmailHtml(amount)}</strong> unless you cancel before then from billing.</p>`,
        cta: { label: 'Manage billing', href: billingUrl },
        footerNote: `You’re receiving this because you own a ${escapeEmailHtml(productName)} workspace.`,
        productName,
      });

      await sendPlatformEmail({
        type: 'billing',
        accountId: row.accountId,
        mail: {
          to: ownerEmail,
          from: sender,
          subject: `${row.accountName} renews ${when} — ${amount}`,
          html,
        },
        metadata: {
          notification_type: 'renewal_notice',
          subscription_id: row.subscriptionId,
          period_key: key,
          amount_minor: row.amountMinor,
        },
      });

      await markNotificationSent(admin, {
        accountId: row.accountId,
        subscriptionId: row.subscriptionId,
        notificationType: 'renewal_notice',
        periodKey: key,
      });

      result.sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${row.accountId}: ${message}`);
      logger.error(
        { err, accountId: row.accountId },
        '[billing-renewal-notice] send failed',
      );
    }
  }

  return result;
}
